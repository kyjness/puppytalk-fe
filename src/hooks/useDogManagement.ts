// 반려견 관리 로직: user.dogs 로드, 로컬 state, PATCH /users/me에 dogs만 반영.
import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import { apiGet, apiPatch } from '../api/typed.js';
import { useAuth } from '../context/AuthContext.jsx';
import { getApiErrorMessage, unwrapApiData } from '../utils/index.js';

export interface FormDog {
  id: string | null;
  name: string;
  breed: string;
  gender: 'male' | 'female';
  birthDate: string;
  isRepresentative: boolean;
  profileImageId?: string;
}

interface DogPayloadRow {
  id?: string;
  name: string;
  breed: string;
  /** 서버 enum과 일치해야 한다 — string으로 두면 잘못된 값이 런타임 422로만 드러난다. */
  gender: 'male' | 'female';
  birthDate: string;
  isRepresentative: boolean;
  profileImageId?: string;
}

interface RawDog {
  id?: string | null;
  name?: string;
  breed?: string;
  gender?: string;
  birthDate?: string;
  isRepresentative?: boolean;
  profileImageId?: string | null;
}

interface UpdatedUser {
  id?: string;
  dogs?: unknown[];
  [key: string]: unknown;
}

function emptyDog(): FormDog {
  return {
    id: null,
    name: '',
    breed: '',
    gender: 'male',
    birthDate: '',
    isRepresentative: false,
  };
}

/** API(camelCase) → 폼 상태 */
function toFormDog(raw: unknown): FormDog {
  const d = (raw ?? {}) as RawDog;
  const pid = d?.profileImageId;
  return {
    id: d?.id ?? null,
    name: (d?.name ?? '').trim(),
    breed: (d?.breed ?? '').trim(),
    gender: d?.gender === 'female' ? 'female' : 'male',
    birthDate: (d?.birthDate ?? '').trim().slice(0, 10),
    isRepresentative: !!d?.isRepresentative,
    ...(pid != null && pid !== '' ? { profileImageId: String(pid) } : {}),
  };
}

export function useDogManagement() {
  const { user, setUser } = useAuth();
  const initialDogs = Array.isArray(user?.dogs) ? user.dogs.map(toFormDog) : [];
  const [dogs, setDogs] = useState<FormDog[]>(initialDogs.length > 0 ? initialDogs : [emptyDog()]);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const dogsRef = useRef(dogs);
  dogsRef.current = dogs;
  const initializedRef = useRef(false);
  const previousUserIdRef = useRef<string | undefined>(undefined);

  const initialDogsSnapshot =
    Array.isArray(user?.dogs) && user.dogs.length > 0 ? user.dogs.map(toFormDog) : [emptyDog()];
  const dogsChanged = JSON.stringify(dogs) !== JSON.stringify(initialDogsSnapshot);

  useEffect(() => {
    const uid = user?.userId ?? user?.id;
    if (uid !== previousUserIdRef.current) {
      previousUserIdRef.current = uid;
      initializedRef.current = false;
    }
    if (initializedRef.current || user == null) return;
    initializedRef.current = true;
    setDogs(
      Array.isArray(user.dogs) && user.dogs.length > 0 ? user.dogs.map(toFormDog) : [emptyDog()]
    );
  }, [user]);

  useEffect(() => {
    const uid = user?.userId ?? user?.id;
    if (uid == null) return;
    const hasDogs = Array.isArray(user?.dogs) && user.dogs.length > 0;
    if (hasDogs) return;

    let cancelled = false;
    apiGet('/v1/users/me', {})
      .then((res) => {
        if (cancelled) return;
        const payload = unwrapApiData<UpdatedUser>(res);
        if (!payload) return;
        const mappedDogs =
          Array.isArray(payload.dogs) && payload.dogs.length > 0
            ? payload.dogs.map(toFormDog)
            : [emptyDog()];
        setUser({
          ...user,
          ...payload,
          userId: payload.id ?? uid,
          accessToken: user?.accessToken,
          dogs: mappedDogs,
        });
        setDogs(mappedDogs);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId ?? user?.id]);

  const setDogAt = useCallback((index: number, patch: Partial<FormDog>) => {
    setDogs((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }, []);

  const addDog = useCallback(() => {
    setDogs((prev) => [...prev, emptyDog()]);
  }, []);

  const removeDog = useCallback((index: number) => {
    setDogs((prev) => (prev.length <= 1 ? [emptyDog()] : prev.filter((_, i) => i !== index)));
  }, []);

  const setRepresentative = useCallback((index: number) => {
    const current = dogsRef.current[index]?.isRepresentative;
    if (current) {
      if (dogsRef.current.length === 1) {
        alert('등록된 강아지가 한 마리일 경우, 반드시 대표 강아지로 지정되어야 합니다.');
      } else {
        alert(
          '대표 강아지는 해제할 수 없습니다.\n변경을 원하시면 다른 강아지의 [대표로 설정] 버튼을 눌러주세요.'
        );
      }
      return;
    }
    setDogs((prev) => prev.map((d, i) => ({ ...d, isRepresentative: i === index })));
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      setFormError('');
      if (!dogsChanged) {
        setFormError('변경된 내용이 없습니다.');
        return;
      }

      const dogsPayload: DogPayloadRow[] = dogs
        .filter((d) => d.name.trim() && d.breed.trim() && d.birthDate.trim())
        .map((d, i, arr) => {
          const row: DogPayloadRow = {
            id: d.id != null && d.id !== '' ? String(d.id) : undefined,
            name: d.name.trim(),
            breed: d.breed.trim(),
            gender: d.gender,
            birthDate: d.birthDate.trim().slice(0, 10),
            isRepresentative:
              arr.filter((x) => x.isRepresentative).length > 0 ? !!d.isRepresentative : i === 0,
          };
          if (d.profileImageId != null && d.profileImageId !== '')
            row.profileImageId = String(d.profileImageId);
          return row;
        });

      if (dogsPayload.length === 0) {
        setFormError('최소 한 마리의 강아지 정보(이름, 품종, 생년월일)를 입력해주세요.');
        return;
      }

      setSubmitting(true);
      try {
        const payload = {
          nickname: (user?.nickname ?? '').trim(),
          dogs: dogsPayload,
        };
        await apiPatch('/v1/users/me', { body: payload });
        let updated: UpdatedUser | null = null;
        try {
          updated = unwrapApiData<UpdatedUser>(await apiGet('/v1/users/me', {}));
        } catch (_) {
          /* ignore */
        }
        if (updated) {
          const mappedDogs =
            Array.isArray(updated.dogs) && updated.dogs.length > 0
              ? updated.dogs.map(toFormDog)
              : [emptyDog()];
          setUser({
            ...user,
            ...updated,
            userId: updated.id ?? user?.userId,
            accessToken: user?.accessToken,
            dogs: mappedDogs,
          });
          setDogs(mappedDogs);
        }
        alert('반려견 정보가 저장되었습니다.');
        setFormError('');
      } catch (err) {
        const e2 = err as { code?: string; message?: string; status?: number };
        const code = e2?.code ?? e2?.message;
        const status = e2?.status;
        if (status === 403 || code === 'FORBIDDEN') {
          setFormError('유효하지 않은 반려견 정보가 포함되어 저장할 수 없습니다.');
          return;
        }
        setFormError(getApiErrorMessage(code, '반려견 정보 저장에 실패했습니다. 다시 시도해주세요.'));
      } finally {
        setSubmitting(false);
      }
    },
    [user, dogs, dogsChanged, setUser, submitting]
  );

  return {
    dogs,
    setDogAt,
    addDog,
    removeDog,
    setRepresentative,
    formError,
    submitting,
    handleSubmit,
  };
}
