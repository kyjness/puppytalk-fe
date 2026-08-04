/**
 * openapi.json으로부터 TypeScript 타입 생성.
 * 백엔드가 OpenAPI 스펙을 이미 camelCase로 노출하므로 별도 변환 없이 사용.
 * 생성 플래그는 scripts/lib/openapi.mjs 한 곳에서 정의한다.
 */
import fs from 'node:fs';
import path from 'node:path';

import { generateTypes, generatedTypesPath, specPath } from './lib/openapi.mjs';

if (!fs.existsSync(specPath)) {
  console.error('openapi.json not found. Run: npm run fetch-openapi (with backend up)');
  process.exit(1);
}

fs.mkdirSync(path.dirname(generatedTypesPath), { recursive: true });
generateTypes(specPath, generatedTypesPath);
console.log(`Generated: ${generatedTypesPath}`);
