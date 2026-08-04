/**
 * OpenAPI 스펙·타입 생성 공용 조각.
 *
 * 생성 플래그가 두 곳에 있으면(생성 스크립트와 최신성 검사) 한쪽만 바뀌는 순간 검사가 영구
 * 불일치로 뜬다 — 정의 지점을 여기 하나로 둔다.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** scripts/lib/ 기준 저장소 루트. */
export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const specPath = path.join(repoRoot, 'openapi.json');
export const generatedTypesPath = path.join(repoRoot, 'src', 'api', 'generated', 'schema.d.ts');

/**
 * --default-non-nullable=false: 기본값이 있는 필드를 필수로 만들지 않는다.
 * 응답에는 항상 채워져 오지만 **요청 본문에서는 생략 가능**하므로, 켜두면 호출부가
 * 서버 기본값을 매번 손으로 넘기게 된다(예: UpdateUserRequest.clearProfileImage).
 */
const GENERATE_FLAGS = ['--default-non-nullable', 'false'];

export function generateTypes(fromSpec, toFile, { quiet = false } = {}) {
  execFileSync('npx', ['openapi-typescript', fromSpec, ...GENERATE_FLAGS, '-o', toFile], {
    cwd: repoRoot,
    stdio: quiet ? ['ignore', 'ignore', 'pipe'] : 'inherit',
  });
}

export function readSpecOrExit() {
  if (!fs.existsSync(specPath)) {
    console.error('openapi.json이 없습니다. 먼저: pnpm fetch-openapi (백엔드 기동 상태)');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(specPath, 'utf8'));
}
