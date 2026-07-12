import { getApiErrorMessage, PASSWORD_POLICY_TEXT, PASSWORD_POLICY_TEXT_CHANGE } from './apiErrors.js';
import type { ValidationResult } from '../api/api-types.js';

const PASSWORD_COMPLEXITY_RE =
  /^(?=.*[a-z])(?=.*[0-9])(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/;

export function isValidEmail(email: unknown): boolean {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validatePassword(value: unknown): ValidationResult {
  if (!value || typeof value !== 'string') return { ok: false, message: '비밀번호를 입력해주세요.' };
  const v = value.trim();
  if (v.length < 8) return { ok: false, message: PASSWORD_POLICY_TEXT };
  if (v.length > 20) return { ok: false, message: PASSWORD_POLICY_TEXT };
  if (!PASSWORD_COMPLEXITY_RE.test(v)) {
    return { ok: false, message: PASSWORD_POLICY_TEXT };
  }
  return { ok: true };
}

export function validatePasswordChangeNew(value: unknown): ValidationResult {
  if (!value || typeof value !== 'string') return { ok: false, message: '비밀번호를 입력해주세요.' };
  const v = value.trim();
  if (v.length < 8) return { ok: false, message: PASSWORD_POLICY_TEXT_CHANGE };
  if (v.length > 128) return { ok: false, message: PASSWORD_POLICY_TEXT_CHANGE };
  if (!PASSWORD_COMPLEXITY_RE.test(v)) {
    return { ok: false, message: PASSWORD_POLICY_TEXT_CHANGE };
  }
  return { ok: true };
}

export function validateNickname(value: unknown): ValidationResult {
  if (!value || typeof value !== 'string') return { ok: false, message: '닉네임을 입력해주세요.' };
  const t = value.trim();
  if (t.length > 10) return { ok: false, message: '닉네임은 10자 이내로 입력해주세요.' };
  if (!/^[가-힣a-zA-Z0-9]{1,10}$/.test(t)) {
    return { ok: false, message: getApiErrorMessage('INVALID_NICKNAME_FORMAT') };
  }
  return { ok: true };
}

export function validatePostTitle(title: string | null | undefined): ValidationResult {
  const t = (title ?? '').trim();
  if (!t) return { ok: false, message: '제목을 입력해주세요.' };
  if (t.length > 26) return { ok: false, message: '제목은 26자 이내로 입력해주세요.' };
  return { ok: true };
}

export function validatePostContent(content: string | null | undefined): ValidationResult {
  if (!(content ?? '').trim()) return { ok: false, message: '내용을 입력해주세요.' };
  return { ok: true };
}
