/**
 * 타입 안전 클라이언트 우회 감시.
 *
 * 계약 드리프트(서버는 커서인데 FE는 page/total 사용)는 이제 `src/api/typed.ts`를 통해
 * **컴파일 단계에서** 막힌다 — 이 검사는 그 그물을 빠져나가는 경로, 즉 raw `api.*`로
 * 커서 엔드포인트를 직접 부르는 코드를 잡는다. typed.ts를 쓰면 여기에 걸릴 일이 없다.
 *
 * 사용: node scripts/check-api-drift.mjs   (openapi.json이 최신이어야 한다)
 */
import fs from 'node:fs';
import path from 'node:path';

import { readSpecOrExit, repoRoot } from './lib/openapi.mjs';

const root = repoRoot;
const srcDir = path.join(root, 'src');
const spec = readSpecOrExit();

/** 커서 기반 엔드포인트 = cursor 파라미터가 있거나 응답이 CursorPage인 GET. */
function cursorEndpoints() {
  const out = [];
  for (const [p, ops] of Object.entries(spec.paths ?? {})) {
    const op = ops.get;
    if (!op) continue;
    const hasCursorParam = (op.parameters ?? []).some((x) => x.name === 'cursor');
    const respRef = JSON.stringify(op.responses?.['200'] ?? {});
    if (hasCursorParam || respRef.includes('CursorPage')) {
      // FE는 baseURL('/api/v1')을 붙여 호출하므로 스펙의 /v1 접두사를 뗀다.
      out.push({ specPath: p, fePath: p.replace(/^\/v1/, '') });
    }
  }
  return out;
}

/** 경로 비교용 정규화 — 경로 변수는 형태가 달라도(`{post_id}` vs `${postId}`) 같은 자리다. */
function normalizePath(p) {
  return p
    .split('/')
    .map((seg) => (seg.startsWith('{') || seg.includes('${') ? '*' : seg))
    .join('/')
    .replace(/\/+$/, '');
}

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'generated') continue; // 생성물은 검사 대상이 아니다
      walk(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

// 메서드를 함께 잡는다 — POST /posts(글 작성)를 GET /posts(피드)로 오인하면 안 된다.
const CALL_RE = /api\.(get|post|patch|delete|put)\s*(?:<[^>]*>)?\s*\(\s*[`'"]([^`'"]+)/g;
/** total을 읽는지 볼 범위 — 파일 전체를 보면 다른 엔드포인트(offset 기반 admin 피드)까지 걸린다. */
const CONTEXT_LINES = 15;

const endpoints = cursorEndpoints();
const files = walk(srcDir);
const errors = [];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = path.relative(root, file);

  const lines = text.split('\n');
  for (const m of text.matchAll(CALL_RE)) {
    if (m[1] !== 'get') continue; // 커서 페이지네이션은 GET에만 해당
    const url = m[2];
    const target = normalizePath(url.split('?')[0]);
    const hit = endpoints.find((e) => normalizePath(e.fePath) === target);
    if (!hit) continue;

    const lineNo = text.slice(0, m.index).split('\n').length;
    const near = lines
      .slice(Math.max(0, lineNo - 1 - CONTEXT_LINES), lineNo + CONTEXT_LINES)
      .join('\n');
    const where = `${rel}:${lineNo}`;

    // raw api.*로 커서 엔드포인트를 부르면 타입 검사를 통째로 우회한다.
    errors.push(
      `${where}: ${hit.specPath}를 raw api.get으로 호출한다 — ` +
        `apiGet(src/api/typed.ts)을 쓸 것. 그래야 page/total 같은 계약 위반이 컴파일에서 걸린다.`
    );
    // 우회한 코드가 실제로 드리프트까지 하고 있으면 근거를 함께 보여준다.
    if (/[?&]page=/.test(url)) {
      errors.push(`${where}: '${url}' — 커서 기반 엔드포인트에 page를 보내고 있다.`);
    }
    if (/\b(?:totalCount|total)\b\s*[,;)}\]=:]/.test(near)) {
      errors.push(`${where}: CursorPage 응답에서 total을 읽고 있다 — 항상 0이다.`);
    }
  }
}

const uniq = (xs) => [...new Set(xs)];
for (const e of uniq(errors)) console.error(`ERROR ${e}`);

if (errors.length > 0) {
  console.error(`\n타입 안전 클라이언트를 우회한 호출 ${uniq(errors).length}건.`);
  process.exit(1);
}
console.log(`OK — 커서 엔드포인트 ${endpoints.length}개, 모두 타입 안전 클라이언트 경유.`);
