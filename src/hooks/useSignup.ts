// 회원가입 페이지 로직: 폼 상태, 유효성 검사, 프로필 이미지 업로드, POST /auth/signup.
import { useState, useRef, useEffect, useCallback, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { uploadImageFile, PRESIGNED_ALLOWED_IMAGE_TYPES } from '../api/media.js';
import {
  getApiErrorMessage,
  isValidEmail,
  validatePassword,
  validateNickname,
  revokeObjectUrlSafely,
} from '../utils/index.js';

const ALLOWED_IMAGE_TYPES: readonly string[] = PRESIGNED_ALLOWED_IMAGE_TYPES;

interface SignupFormData {
  email: string;
  password: string;
  passwordConfirm: string;
  nickname: string;
}

interface SignupErrors {
  profile: string;
  email: string;
  password: string;
  passwordConfirm: string;
  nickname: string;
  form: string;
}

const INITIAL_FORM_DATA: SignupFormData = {
  email: '',
  password: '',
  passwordConfirm: '',
  nickname: '',
};

const INITIAL_ERRORS: SignupErrors = {
  profile: '',
  email: '',
  password: '',
  passwordConfirm: '',
  nickname: '',
  form: '',
};

interface SignupPayload {
  email: string;
  password: string;
  nickname: string;
  profileImageId?: string;
  signupToken?: string;
}

export function useSignup() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<SignupFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<SignupErrors>(INITIAL_ERRORS);
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [profilePreviewUrl, setProfilePreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const clearErrors = useCallback(() => {
    setErrors(INITIAL_ERRORS);
  }, []);

  useEffect(() => {
    return () => {
      if (profilePreviewUrl) revokeObjectUrlSafely(profilePreviewUrl);
    };
  }, [profilePreviewUrl]);

  const handleAvatarClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      setErrors((prev) => ({ ...prev, profile: '' }));
      setProfileFile(null);
      if (profilePreviewUrl) {
        revokeObjectUrlSafely(profilePreviewUrl);
        setProfilePreviewUrl(null);
      }
      if (!file) {
        e.target.value = '';
        return;
      }
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setErrors((prev) => ({ ...prev, profile: getApiErrorMessage('INVALID_FILE_TYPE') }));
        e.target.value = '';
        return;
      }
      setProfileFile(file);
      setProfilePreviewUrl(URL.createObjectURL(file));
      e.target.value = '';
    },
    [profilePreviewUrl]
  );

  const handleFieldChange = useCallback(
    (field: keyof SignupFormData) => (e: ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({ ...prev, [field]: e.target.value }));
      setErrors((prev) => ({ ...prev, [field]: '', form: '' }));
    },
    []
  );

  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault?.();
      if (submitting) return;
      clearErrors();

      const emailTrim = formData.email.trim();
      const pwVal = formData.password ?? '';
      const pwConfirmVal = formData.passwordConfirm ?? '';
      const nickTrim = formData.nickname.trim();

      let emailMsg = '';
      let passwordMsg = '';
      let passwordConfirmMsg = '';
      let nicknameMsg = '';

      if (!emailTrim) {
        emailMsg = '이메일을 입력해주세요.';
      } else if (!isValidEmail(emailTrim)) {
        emailMsg = getApiErrorMessage('INVALID_EMAIL_FORMAT');
      }
      const pwCheck = validatePassword(pwVal);
      if (!pwCheck.ok) {
        passwordMsg = pwCheck.message ?? '';
      }
      if (!pwConfirmVal.trim()) {
        passwordConfirmMsg = '비밀번호 확인을 입력해주세요.';
      } else if (formData.password !== formData.passwordConfirm) {
        passwordConfirmMsg = '비밀번호 확인이 일치하지 않습니다.';
      }
      const nickCheck = validateNickname(nickTrim);
      if (!nickCheck.ok) {
        nicknameMsg = nickCheck.message ?? '';
      }

      setErrors((prev) => ({
        ...prev,
        email: emailMsg,
        password: passwordMsg,
        passwordConfirm: passwordConfirmMsg,
        nickname: nicknameMsg,
        profile: prev.profile,
        form: '',
      }));

      if (emailMsg || passwordMsg || passwordConfirmMsg || nicknameMsg) {
        return;
      }

      setSubmitting(true);
      try {
        let profileImageId: string | null = null;
        let signupToken: string | null = null;

        if (profileFile) {
          const uploadData = await uploadImageFile(profileFile, { purpose: 'signup' });
          const id = uploadData.imageId;
          const token = uploadData.signupToken;
          if (id == null || token == null || String(token).trim() === '') {
            throw new Error('SIGNUP_IMAGE_TOKEN_INVALID');
          }
          profileImageId = String(id);
          signupToken = String(token).trim();
        }

        const payload: SignupPayload = { email: emailTrim, password: pwVal, nickname: nickTrim };
        if (profileImageId != null && signupToken) {
          payload.profileImageId = profileImageId;
          payload.signupToken = signupToken;
        }

        await api.post('/auth/signup', payload);
        alert('회원가입이 완료되었습니다! 로그인해주세요.');
        navigate('/login', { replace: true });
      } catch (err) {
        const e2 = err as { code?: string; message?: string };
        const code = String(e2?.code ?? e2?.message ?? '').trim().toUpperCase();
        const msg = getApiErrorMessage(
          code || undefined,
          '회원가입에 실패했습니다. 다시 시도해주세요.'
        );
        if (['EMAIL_ALREADY_EXISTS', 'INVALID_EMAIL_FORMAT'].includes(code)) {
          setErrors((prev) => ({ ...prev, email: msg }));
        } else if (code === 'INVALID_PASSWORD_FORMAT') {
          setErrors((prev) => ({ ...prev, password: msg }));
        } else if (['NICKNAME_ALREADY_EXISTS', 'INVALID_NICKNAME_FORMAT'].includes(code)) {
          setErrors((prev) => ({ ...prev, nickname: msg }));
        } else if (
          [
            'SIGNUP_IMAGE_TOKEN_INVALID',
            'SIGNUP_IMAGE_TOKEN_ALREADY_USED',
            'FILE_SIZE_EXCEEDED',
            'INVALID_FILE_TYPE',
            'RATE_LIMIT_EXCEEDED',
            'S3_UPLOAD_NETWORK_ERROR',
            'S3_UPLOAD_FAILED',
            'PRESIGN_INVALID_RESPONSE',
          ].includes(code)
        ) {
          setErrors((prev) => ({ ...prev, profile: msg }));
        } else {
          setErrors((prev) => ({ ...prev, form: msg }));
        }
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, formData, profileFile, clearErrors, navigate]
  );

  return {
    formData,
    errors,
    profilePreviewUrl,
    submitting,
    fileInputRef,
    clearErrors,
    handleAvatarClick,
    handleFileChange,
    handleFieldChange,
    handleSubmit,
    navigate,
  };
}
