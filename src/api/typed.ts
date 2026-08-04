/**
 * 타입 안전 API 호출 — 경로·쿼리·요청 본문·응답을 생성 스키마(openapi.json)에서 끌어온다.
 *
 * 왜 있나: "서버는 커서인데 FE는 page를 보내고 total을 읽는다"는 드리프트를 세 번(댓글·차단·
 * 알림) 잡았다. 셋 다 각 리포의 diff만 보면 멀쩡해서 code review로는 안 걸린다 — 리포 경계에서
 * 깨지기 때문이다. 여기를 거치면 그 두 형태가 **컴파일 에러**가 된다:
 *
 *   apiGet('/v1/posts/{post_id}/comments', { query: { page: 1 } })  // ✗ page는 없는 파라미터
 *   (await apiGet('/v1/notifications', {})).data.total              // ✗ CursorPage에 total 없음
 *
 * 전송은 기존 axios 인스턴스(client.ts)를 그대로 쓴다 — 401 silent refresh·멱등키 자동 부여·
 * FormData 처리·ApiError 정규화가 전부 살아 있어야 하므로 여기서 다시 만들지 않는다.
 */
import { api } from './client.js';
import type { paths } from './generated/schema.js';

/** 스펙 경로는 '/v1/...'로 시작하고 BASE_URL('/api/v1')이 이미 그 접두사를 포함한다. */
const SPEC_PREFIX = '/v1';

type Method = 'get' | 'post' | 'patch' | 'delete';

/** 해당 메서드를 실제로 가진 경로만 고른다 — 없는 조합은 경로 이름 단계에서 막힌다. */
type PathsFor<M extends Method> = {
  [P in keyof paths]: paths[P] extends { [K in M]: object } ? P : never;
}[keyof paths];

type OpOf<P extends keyof paths, M extends Method> = NonNullable<paths[P][M]>;

type QueryOf<O> = O extends { parameters: { query?: infer Q } } ? Q : never;
type PathParamsOf<O> = O extends { parameters: { path?: infer PP } } ? PP : never;
type BodyOf<O> = O extends { requestBody?: { content: { 'application/json': infer B } } }
  ? B
  : never;
/**
 * 성공 응답 본문. 이게 곧 호출부가 받는 값이라, 없는 필드를 읽으면 여기서 걸린다.
 * 스펙에 200·201·202가 섞여 있다(생성은 201, 비동기 착수는 202) — 셋 다 훑는다.
 */
type OkOf<O> = O extends { responses: infer R }
  ? R extends { 200: { content: { 'application/json': infer B } } }
    ? B
    : R extends { 201: { content: { 'application/json': infer B } } }
      ? B
      : R extends { 202: { content: { 'application/json': infer B } } }
        ? B
        : never
  : never;

/**
 * 해당 파라미터가 없는 연산(스키마가 `path?: never` 등으로 내는 경우)은 추론 결과가
 * `undefined`라 선택이 되고, 값이 있는 연산은 필수가 된다. 초과 속성 검사가 남아 있어
 * 없는 파라미터를 넘기면 그대로 에러다.
 */
type Slot<K extends string, T> = undefined extends T
  ? { [P in K]?: T }
  : { [P in K]: T };

/**
 * `query`는 항상 선택 — 스펙상 쿼리 파라미터는 전부 optional이라 생략이 곧 "기본값"이다.
 * 쿼리가 없는 연산에는 `QueryOf<O>`가 `undefined`가 되어 어떤 키도 통과하지 못한다.
 */
type RequestOptions<O> = Slot<'path', PathParamsOf<O>> &
  Slot<'body', BodyOf<O>> & { query?: QueryOf<O> };

type AnyOptions = {
  path?: Record<string, string | number>;
  query?: Record<string, unknown>;
  body?: unknown;
};

/**
 * '/v1/posts/{post_id}/comments' + {post_id} + query → '/posts/abc/comments?size=10'
 *
 * 순수 함수로 분리해 테스트한다 — 여기가 틀리면 타입은 통과하는데 런타임만 깨진다.
 * null·undefined 쿼리 값은 보내지 않는다(각 호출부가 손으로 하던 분기를 흡수).
 */
export function buildUrl(
  specPath: string,
  opts: { path?: Record<string, string | number>; query?: Record<string, unknown> } = {}
): string {
  let url = specPath.startsWith(SPEC_PREFIX) ? specPath.slice(SPEC_PREFIX.length) : specPath;

  url = url.replace(/\{([^}]+)\}/g, (_m, key: string) => {
    const value = opts.path?.[key];
    if (value === undefined || value === null || value === '') {
      throw new Error(`경로 파라미터 누락: ${key} (${specPath})`);
    }
    return encodeURIComponent(String(value));
  });

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(opts.query ?? {})) {
    if (value === undefined || value === null) continue;
    qs.set(key, String(value));
  }
  const query = qs.toString();
  return query ? `${url}?${query}` : url;
}

export function apiGet<P extends PathsFor<'get'>>(
  path: P,
  options: RequestOptions<OpOf<P, 'get'>>
): Promise<OkOf<OpOf<P, 'get'>>> {
  const o = options as AnyOptions;
  return api.get(buildUrl(path, o));
}

export function apiPost<P extends PathsFor<'post'>>(
  path: P,
  options: RequestOptions<OpOf<P, 'post'>>,
  init?: { headers?: Record<string, string> }
): Promise<OkOf<OpOf<P, 'post'>>> {
  const o = options as AnyOptions;
  return api.post(buildUrl(path, o), o.body, init);
}

export function apiPatch<P extends PathsFor<'patch'>>(
  path: P,
  options: RequestOptions<OpOf<P, 'patch'>>
): Promise<OkOf<OpOf<P, 'patch'>>> {
  const o = options as AnyOptions;
  return api.patch(buildUrl(path, o), o.body);
}

export function apiDelete<P extends PathsFor<'delete'>>(
  path: P,
  options: RequestOptions<OpOf<P, 'delete'>>
): Promise<OkOf<OpOf<P, 'delete'>>> {
  const o = options as AnyOptions;
  return api.delete(buildUrl(path, o));
}
