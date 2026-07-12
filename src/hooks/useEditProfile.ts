// 회원정보 수정 로직(프로필 전용): 닉네임·프로필 이미지, PATCH /users/me·탈퇴. 강아지는 user.dogs 유지.
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { uploadImageFile } from '../api/media.js';
import { useAuth } from '../context/AuthContext.jsx';
import { DEFAULT_PROFILE_IMAGE } from '../config.js';
import {
  getApiErrorMessage,
  validateNickname,
  safeImageUrl,
  revokeObjectUrlSafely,
  unwrapApiData,
} from '../utils/index.js';

interface FormDog {
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
  gender: string;
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
  nickname?: string;
  dogs?: unknown[];
  [key: string]: unknown;
}

interface EditProfilePayload {
  nickname: string;
  profileImageId?: string | null;
  clearProfileImage?: boolean;
  dogs?: DogPayloadRow[];
}

/** GET /users/me 등 API(camelCase) → 폼 상태. snake_case 폴백 없음. */
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

function buildDogsPayload(dogsArray: unknown): DogPayloadRow[] {
  const list = Array.isArray(dogsArray) ? dogsArray.map(toFormDog) : [];
  return list
    .filter((d) => d.name && d.breed && d.birthDate)
    .map((d, i, arr) => {
      const row: DogPayloadRow = {
        id: d.id != null && d.id !== '' ? String(d.id) : undefined,
        name: d.name,
        breed: d.breed,
        gender: d.gender,
        birthDate: d.birthDate.slice(0, 10),
        isRepresentative:
          arr.filter((x) => x.isRepresentative).length > 0 ? !!d.isRepresentative : i === 0,
      };
      if (d.profileImageId != null && d.profileImageId !== '')
        row.profileImageId = String(d.profileImageId);
      return row;
    });
}

export function useEditProfile() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialNickname = (user?.nickname ?? '').trim();
  const [nickname, setNickname] = useState(initialNickname);
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [profilePreviewUrl, setProfilePreviewUrl] = useState<string | null>(null);
  const [clearProfileImage, setClearProfileImage] = useState(false);
  const [formError, setFormError] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const initializedRef = useRef(false);
  const previousUserIdRef = useRef<string | undefined>(undefined);

  const profileImageDisplay = clearProfileImage
    ? DEFAULT_PROFILE_IMAGE
    : (profilePreviewUrl ??
      safeImageUrl(user?.profileImageUrl, DEFAULT_PROFILE_IMAGE) ??
      DEFAULT_PROFILE_IMAGE);
  const canClearProfileImage = profileImageDisplay !== DEFAULT_PROFILE_IMAGE;
  const nicknameChanged = nickname.trim() !== initialNickname;
  const profileImageChanged = profileFile != null || clearProfileImage;
  const hasUnsavedChanges = nicknameChanged || profileImageChanged;

  useEffect(() => {
    const uid = user?.userId ?? user?.id;
    if (uid !== previousUserIdRef.current) {
      previousUserIdRef.current = uid;
      initializedRef.current = false;
    }
    if (initializedRef.current || user == null) return;
    initializedRef.current = true;
    setNickname((user.nickname ?? '').trim());
  }, [user]);

  useEffect(() => {
    return () => {
      if (profilePreviewUrl) revokeObjectUrlSafely(profilePreviewUrl);
    };
  }, [profilePreviewUrl]);

  const handleProfileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      setProfileFile(null);
      if (profilePreviewUrl) {
        revokeObjectUrlSafely(profilePreviewUrl);
        setProfilePreviewUrl(null);
      }
      if (!file) {
        e.target.value = '';
        return;
      }
      setProfileFile(file);
      setProfilePreviewUrl(URL.createObjectURL(file));
      e.target.value = '';
    },
    [profilePreviewUrl]
  );

  const handleClearProfileImage = useCallback(() => {
    setClearProfileImage(true);
    setProfileFile(null);
    if (profilePreviewUrl) {
      revokeObjectUrlSafely(profilePreviewUrl);
      setProfilePreviewUrl(null);
    }
  }, [profilePreviewUrl]);

  const handleAvatarChangeClick = useCallback((e?: ReactMouseEvent) => {
    if (e) e.stopPropagation();
    setClearProfileImage(false);
    fileInputRef.current?.click();
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setFormError('');
      setNicknameError('');

      if (!hasUnsavedChanges) {
        setFormError('회원정보를 수정해주세요.');
        return;
      }

      const nickTrim = nickname.trim();
      const nickCheck = validateNickname(nickTrim);
      if (!nickCheck.ok) {
        setNicknameError(nickCheck.message ?? '');
        return;
      }

      setSubmitting(true);
      try {
        let profileImageId: string | null = null;
        if (profileFile) {
          const uploadRes = await uploadImageFile(profileFile, { purpose: 'profile' });
          profileImageId = uploadRes.imageId;
        }

        const payload: EditProfilePayload = { nickname: nickTrim };
        if (clearProfileImage) {
          payload.profileImageId = null;
          payload.clearProfileImage = true;
        } else if (profileImageId != null) {
          payload.profileImageId = String(profileImageId);
        }
        payload.dogs = buildDogsPayload(user?.dogs);

        const patchRes = await api.patch('/users/me', payload);
        // PATCH 본문을 우선 반영(GET 실패·리플리카 지연에도 UI 일치). null 프로필 URL은 ?? 로 이전값 복구하면 안 됨.
        let updated = unwrapApiData<UpdatedUser>(patchRes);
        if (!updated) {
          try {
            updated = unwrapApiData<UpdatedUser>(await api.get('/users/me'));
          } catch (_) {
            /* ignore */
          }
        }
        if (updated) {
          setUser({
            ...user,
            ...updated,
            userId: updated.id ?? user?.userId,
            accessToken: user?.accessToken,
          });
          setNickname((updated.nickname ?? nickTrim).trim());
        } else {
          setUser({ ...user, nickname: nickTrim });
          setNickname(nickTrim);
        }

        alert('회원정보가 수정되었습니다.');
        setProfileFile(null);
        setClearProfileImage(false);
        if (profilePreviewUrl) {
          revokeObjectUrlSafely(profilePreviewUrl);
          setProfilePreviewUrl(null);
        }
        setFormError('');
        setNicknameError('');
      } catch (err) {
        const e2 = err as { code?: string; message?: string };
        setFormError(
          getApiErrorMessage(
            e2?.code ?? e2?.message,
            '회원정보 수정에 실패했습니다. 닉네임·프로필 사진을 확인한 뒤 다시 시도해주세요.'
          )
        );
      } finally {
        setSubmitting(false);
      }
    },
    [user, nickname, profileFile, clearProfileImage, hasUnsavedChanges, profilePreviewUrl, setUser]
  );

  const handleEditComplete = useCallback(() => {
    setFormError('');
    if (hasUnsavedChanges) {
      setFormError('수정하기 버튼을 눌러주세요.');
      return;
    }
    navigate('/posts');
  }, [hasUnsavedChanges, navigate]);

  const handleDeleteAccount = useCallback(async () => {
    try {
      await api.delete('/users/me');
      setUser(null);
      setDeleteModalOpen(false);
      alert('회원 탈퇴가 완료되었습니다.');
      navigate('/posts', { replace: true });
    } catch (err) {
      const e2 = err as { code?: string; message?: string };
      setDeleteModalOpen(false);
      setFormError(
        getApiErrorMessage(
          e2?.code ?? e2?.message,
          '회원 탈퇴에 실패했습니다. 잠시 후 다시 시도해주세요.'
        )
      );
    }
  }, [setUser, navigate]);

  return {
    user,
    fileInputRef,
    nickname,
    setNickname,
    nicknameError,
    setNicknameError,
    profileImageDisplay,
    canClearProfileImage,
    formError,
    submitting,
    deleteModalOpen,
    setDeleteModalOpen,
    handleProfileChange,
    handleClearProfileImage,
    handleAvatarChangeClick,
    handleSubmit,
    handleEditComplete,
    handleDeleteAccount,
  };
}
