/**
 * openapi.json으로부터 TypeScript 타입 생성.
 * 백엔드가 OpenAPI 스펙을 이미 camelCase로 노출하므로 별도 변환 없이 사용.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const specPath = path.join(root, 'openapi.json');

if (!fs.existsSync(specPath)) {
  console.error('openapi.json not found. Run: npm run fetch-openapi (with backend up)');
  process.exit(1);
}

const outDir = path.join(root, 'src', 'api', 'generated');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'schema.d.ts');

// --default-non-nullable=false: 기본값이 있는 필드를 필수로 만들지 않는다.
// 응답에는 항상 채워져 오지만 **요청 본문에서는 생략 가능**하므로, 켜두면 호출부가
// 서버 기본값을 매번 손으로 넘기게 된다(예: UpdateUserRequest.clearProfileImage).
execSync(`npx openapi-typescript "${specPath}" --default-non-nullable false -o "${outFile}"`, {
  cwd: root,
  stdio: 'inherit',
});
console.log(`Generated: ${outFile}`);
