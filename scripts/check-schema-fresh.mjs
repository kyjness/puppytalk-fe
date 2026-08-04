/**
 * 커밋된 schema.d.ts가 백엔드 현재 스펙과 일치하는지 검사.
 *
 * 왜 필요한가: 타입 안전 클라이언트(src/api/typed.ts)의 방어력은 **생성 타입이 최신일 때만**
 * 유효하다. BE를 고치고 `pnpm generate-api`를 잊으면 낡은 타입으로 조용히 컴파일이 통과하고,
 * 막으려던 계약 드리프트가 그대로 되돌아온다. 그 창을 닫는다.
 *
 * 서버를 띄우지 않는다 — BE의 app.openapi()를 직접 호출해 스펙을 얻는다(라우터 등록·camelize
 * 후처리까지 그대로 거치므로 /v1/openapi.json 응답과 동일하다).
 *
 * 사용: node scripts/check-schema-fresh.mjs
 * BE 가상환경을 못 찾으면 검사를 건너뛴다(FE만 받은 환경에서 빌드를 막지 않기 위해).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const beDir = path.resolve(root, '..', 'puppytalk-be');
const venvPython = path.join(beDir, '.venv', 'bin', 'python');
const committed = path.join(root, 'src', 'api', 'generated', 'schema.d.ts');

function skip(reason) {
  console.log(`skip — ${reason}`);
  process.exit(0);
}

if (!fs.existsSync(venvPython)) skip(`백엔드 가상환경 없음 (${venvPython})`);
if (!fs.existsSync(committed)) skip('생성된 schema.d.ts 없음');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'schema-fresh-'));
const tmpSpec = path.join(tmpDir, 'openapi.json');
const tmpTypes = path.join(tmpDir, 'schema.d.ts');

try {
  execFileSync(
    venvPython,
    [
      '-c',
      [
        'import json, sys',
        'from app.main import app',
        `open(${JSON.stringify(tmpSpec)}, "w", encoding="utf8").write(`,
        '    json.dumps(app.openapi(), indent=2, ensure_ascii=False))',
      ].join('\n'),
    ],
    { cwd: beDir, stdio: ['ignore', 'ignore', 'pipe'] }
  );
} catch (e) {
  skip(`백엔드 스펙 생성 실패 (${String(e.stderr ?? e).trim().split('\n').pop()})`);
}

// 생성 옵션은 transform-and-generate.mjs와 동일해야 한다 — 다르면 항상 불일치로 뜬다.
execFileSync(
  'npx',
  ['openapi-typescript', tmpSpec, '--default-non-nullable', 'false', '-o', tmpTypes],
  { cwd: root, stdio: ['ignore', 'ignore', 'pipe'] }
);

const fresh = fs.readFileSync(tmpTypes, 'utf8');
const current = fs.readFileSync(committed, 'utf8');
fs.rmSync(tmpDir, { recursive: true, force: true });

if (fresh !== current) {
  console.error('ERROR schema.d.ts가 백엔드 현재 스펙과 다릅니다.');
  console.error('       BE 변경 후 타입을 다시 생성하지 않으면 낡은 계약으로 컴파일이 통과합니다.');
  console.error('       해결: 백엔드를 띄운 뒤 `pnpm fetch-openapi && pnpm generate-api`');
  process.exit(1);
}
console.log('OK — schema.d.ts가 백엔드 스펙과 일치.');
