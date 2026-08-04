/**
 * API 타입 헬퍼: 생성된 schema + ApiResponse 래퍼 반영.
 * client.js의 toData()가 반환하는 값은 { code, data } 이므로 data 필드 타입을 추출해 사용.
 */
import type { components } from "./generated/schema.js";

export type Schemas = components["schemas"];

/** 백엔드가 내려주는 통일 응답 래퍼 (camelCase) */
export interface ApiResponse<T = unknown> {
  code: string;
  data: T | null;
  message?: string | null;
}

/** ApiResponse.data 추출 (api.get/post 반환값의 payload 타입) */
export type DataOf<T> = T extends ApiResponse<infer D> ? D : T extends { data: infer D } ? D : never;

/** 스키마에서 자주 쓰는 응답 타입 단축 */
export type PostResponse = Schemas["PostResponse"];
export type FileInfo = Schemas["FileInfo"];
export type AuthorInfo = Schemas["AuthorInfo"];
export type ImageUploadResponse = Schemas["ImageUploadResponse"];
export type SignupImageUploadData = Schemas["SignupImageUploadData"];

/** 채팅 메시지 1건 (REST·WS 공통, camelCase UI용) */
export interface ChatMessageRow {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

/** 기존 이미지 1건 (서버 FileInfo에서 매핑; UI는 imageId·fileUrl만 사용) */
export interface ExistingImageItem {
  imageId: string;
  fileUrl: string;
}

/** 신규 업로드 예정 이미지 (클라이언트 전용, API 스키마 아님) */
export interface NewImageItem {
  file: File;
  objectUrl: string;
  imageId: string | null;
}

/** 검증 결과 (validatePostTitle, validatePostContent 등, 프론트 전용) */
export interface ValidationResult {
  ok: boolean;
  message?: string;
}
