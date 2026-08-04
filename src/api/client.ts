// 공통 API 클라이언트: Axios, 401 시 refresh 후 재시도, onUnauthorized 콜백.
// Refresh Token은 HttpOnly 쿠키로만 전달되며, localStorage에 저장하지 않습니다.
// `/auth/refresh`, `/auth/logout` 포함 모든 요청에 쿠키를 실으려면 withCredentials가 필요합니다.
import axios, {
  type AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { BASE_URL } from '../config.js';
import { ApiError } from './errors.js';

// 재시도·멱등성 제어용으로 요청 config에 부착하는 내부 플래그.
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _retry?: boolean;
    _refreshRetry?: number;
    __idempotencyKey?: string;
  }
}

/** 서버 에러 응답 바디의 관용 형태(code/message/detail). */
interface ErrorResponseBody {
  code?: string;
  message?: string;
  detail?: string | { code?: string };
}

const USER_STORAGE_KEY = 'user';
const REFRESH_ENDPOINT = '/auth/refresh';

function getAccessToken(): string | null {
  try {
    const raw = typeof window !== 'undefined' && localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data?.accessToken ?? null;
  } catch (_) {
    return null;
  }
}

/** SSE 등 Axios 외 클라이언트와 동일한 액세스 토큰 소스(로컬 user JSON). */
export function getStoredAccessToken(): string | null {
  return getAccessToken();
}

function setAccessToken(accessToken: string): void {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    data.accessToken = accessToken;
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data));
  } catch (_) {}
}

/** 로그인/회원가입/비로그인 이미지 업로드 등 401 시 refresh 시도 생략 */
function shouldSkip401Refresh(url: string | undefined): boolean {
  if (!url || typeof url !== 'string') return true;
  return /auth\/login|auth\/signup|media\/images\/signup\/(presign|confirm)/.test(url);
}

function isRefreshRequest(url: string | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.includes('auth/refresh');
}

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;
export function setUnauthorizedHandler(fn: UnauthorizedHandler | null): void {
  onUnauthorized = fn;
}

type RefreshSubscriber = (newToken: string | null) => void;
let isRefreshing = false;
let refreshSubscribers: RefreshSubscriber[] = [];
let refreshAttemptPromise: Promise<string | null> | null = null;
const MAX_REFRESH_RETRY = 1;

function subscribeTokenRefresh(cb: RefreshSubscriber): void {
  refreshSubscribers.push(cb);
}

function onRefreshed(newToken: string | null): void {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
}

function onRefreshFailed(): void {
  refreshSubscribers.forEach((cb) => cb(null));
  refreshSubscribers = [];
}

function waitForTokenFromRefresh(timeoutMs = 1500): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(getAccessToken());
    }, timeoutMs);
    subscribeTokenRefresh((newToken) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(newToken ?? getAccessToken());
    });
  });
}

async function requestRefreshToken(): Promise<string | null> {
  const res = await axios.post<{ data?: { accessToken?: string }; accessToken?: string }>(
    `${BASE_URL}${REFRESH_ENDPOINT}`,
    null,
    {
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' },
    }
  );
  return res?.data?.data?.accessToken ?? res?.data?.accessToken ?? null;
}

function clearUserAndRedirect(): void {
  try {
    const path = typeof window !== 'undefined' && window.location.pathname;
    if (path && path !== '/login' && path !== '/signup') {
      sessionStorage.setItem('login_return_path', path);
    }
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch (_) {}
  if (typeof onUnauthorized === 'function') {
    onUnauthorized();
  }
}

/** 백엔드 멱등성: 게시글 생성 POST에만 사용 */
function normalizeRequestPath(url: string | undefined): string {
  if (!url || typeof url !== 'string') return '';
  const pathOnly = url.split('?')[0];
  const withSlash = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  return withSlash.replace(/\/+$/, '') || '/';
}

function postNeedsIdempotencyKey(url: string | undefined): boolean {
  const p = normalizeRequestPath(url);
  return p === '/posts';
}

function readIdempotencyHeader(headers: InternalAxiosRequestConfig['headers']): string | undefined {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') {
    return (headers.get('X-Idempotency-Key') || headers.get('x-idempotency-key')) as
      | string
      | undefined;
  }
  const raw = headers as Record<string, unknown>;
  const value = raw['X-Idempotency-Key'] ?? raw['x-idempotency-key'];
  return typeof value === 'string' ? value : undefined;
}

function newIdempotencyKey(): string {
  try {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
  } catch (_) {}
  return `idemp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

const instance = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

/** 기본 Axios 인스턴스 (Bearer + credentials + 401 시 쿠키 기반 silent refresh) */
export const apiClient = instance;

instance.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    if (typeof config.headers?.delete === 'function') {
      config.headers.delete('Content-Type');
    } else {
      delete (config.headers as Record<string, unknown>)['Content-Type'];
    }
  }
  const method = (config.method || 'get').toLowerCase();
  if (
    method === 'post' &&
    postNeedsIdempotencyKey(config.url || '') &&
    !readIdempotencyHeader(config.headers)
  ) {
    if (!config.__idempotencyKey) {
      config.__idempotencyKey = newIdempotencyKey();
    }
    if (typeof config.headers?.set === 'function') {
      config.headers.set('X-Idempotency-Key', config.__idempotencyKey);
    } else {
      (config.headers as Record<string, unknown>)['X-Idempotency-Key'] = config.__idempotencyKey;
    }
  }
  return config;
});

instance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ErrorResponseBody>) => {
    const originalRequest = error.config;
    const url = originalRequest?.url ?? originalRequest?.baseURL ?? '';
    const status = error.response?.status;
    const body = error.response?.data;
    const refreshTry = Number(originalRequest?._refreshRetry || 0);

    const bodyDetailCode =
      body?.detail && typeof body.detail === 'object' ? body.detail.code : undefined;

    if (status !== 401) {
      const serverMessage =
        typeof body?.message === 'string' && body.message.trim() ? body.message.trim() : null;
      const code =
        body?.code ??
        (typeof body?.detail === 'string' ? body.detail : null) ??
        bodyDetailCode ??
        `HTTP ${status}`;
      return Promise.reject(
        new ApiError(serverMessage ?? code, { code: body?.code ?? bodyDetailCode ?? null, status })
      );
    }

    if (isRefreshRequest(url)) {
      clearUserAndRedirect();
      return Promise.reject(new ApiError(body?.code ?? 'UNAUTHORIZED', { code: body?.code ?? null, status: 401 }));
    }

    if (shouldSkip401Refresh(url)) {
      return Promise.reject(
        new ApiError(body?.code ?? bodyDetailCode ?? 'UNAUTHORIZED', {
          code: body?.code ?? bodyDetailCode ?? null,
          status: 401,
        })
      );
    }

    if (originalRequest && !originalRequest._retry) {
      if (!isRefreshing) {
        isRefreshing = true;
        originalRequest._retry = true;
        originalRequest._refreshRetry = refreshTry;
        try {
          refreshAttemptPromise = requestRefreshToken();
          let newToken = await refreshAttemptPromise;
          if (!newToken && getAccessToken()) {
            newToken = getAccessToken();
          }
          if (newToken) {
            setAccessToken(newToken);
            onRefreshed(newToken);
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return instance(originalRequest);
          }
        } catch (refreshErr) {
          const refreshStatus = (refreshErr as AxiosError)?.response?.status;
          const canRetry409 = refreshStatus === 409 && refreshTry < MAX_REFRESH_RETRY;
          if (canRetry409) {
            // 다른 요청(선행 refresh) 완료를 잠시 대기한 뒤 원요청을 1회 재시도.
            const waitedToken = await waitForTokenFromRefresh();
            const tokenAfterWait = waitedToken || getAccessToken();
            if (tokenAfterWait) {
              setAccessToken(tokenAfterWait);
              onRefreshed(tokenAfterWait);
              originalRequest._refreshRetry = refreshTry + 1;
              originalRequest.headers.Authorization = `Bearer ${tokenAfterWait}`;
              return instance(originalRequest);
            }
          }
          onRefreshFailed();
          clearUserAndRedirect();
          const refreshBody = (refreshErr as AxiosError<ErrorResponseBody>)?.response?.data;
          return Promise.reject(
            new ApiError(refreshBody?.code ?? body?.code ?? 'UNAUTHORIZED', {
              code: refreshBody?.code ?? body?.code ?? (refreshStatus === 409 ? 'CONFLICT' : null),
              status: refreshStatus ?? 401,
            })
          );
        } finally {
          refreshAttemptPromise = null;
          isRefreshing = false;
        }
      }

      return new Promise((resolve, reject) => {
        subscribeTokenRefresh((newToken) => {
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            instance(originalRequest).then(resolve).catch(reject);
          } else {
            reject(new ApiError(body?.code ?? 'UNAUTHORIZED', { code: body?.code ?? null, status: 401 }));
          }
        });
      });
    }

    return Promise.reject(
      new ApiError(body?.code ?? 'UNAUTHORIZED', { code: body?.code ?? bodyDetailCode ?? null, status: 401 })
    );
  }
);

function toData<T>(response: AxiosResponse<T>): T {
  const res = (response?.data ?? response) as T;
  // 백엔드 표준은 200+JSON이지만, 과거/프록시/예외 케이스에서 204 또는 빈 바디가 올 수 있어 보수적으로 폴백.
  if ((response?.status === 204 || response?.data == null) && res == null) {
    return { code: 'OK', data: null } as T;
  }
  return res;
}

export const api = {
  async get<T = unknown>(endpoint: string): Promise<T> {
    const response = await instance.get<T>(endpoint);
    return toData(response);
  },

  async post<T = unknown>(
    endpoint: string,
    data?: unknown,
    options: { headers?: Record<string, string> } = {}
  ): Promise<T> {
    const config = options.headers ? { headers: options.headers } : {};
    const response = await instance.post<T>(endpoint, data, config);
    return toData(response);
  },

  async patch<T = unknown>(endpoint: string, data?: unknown): Promise<T> {
    const response = await instance.patch<T>(endpoint, data);
    return toData(response);
  },

  async delete<T = unknown>(endpoint: string): Promise<T> {
    const response = await instance.delete<T>(endpoint);
    return toData(response);
  },
};
