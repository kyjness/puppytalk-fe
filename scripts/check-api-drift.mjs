/**
 * BE↔FE 페이지네이션 계약 드리프트 검사.
 *
 * 왜 필요한가: 같은 형태의 버그를 세 번 잡았다(댓글·차단·알림). 전부 "서버는 커서인데
 * FE는 페이지 번호/총계를 쓴다"였고, 셋 다 각 리포의 diff만 보면 결함이 없어 보인다 —
 * 리포 경계에서 깨지므로 code review로는 잡히지 않는다. 그래서 기계가 본다.
 *
 * 사용: node scripts/check-api-drift.mjs   (openapi.json이 최신이어야 한다)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const specPath = path.join(root, 'openapi.json');
const srcDir = path.join(root, 'src');

if (!fs.existsSync(specPath)) {
  console.error('openapi.json이 없습니다. 먼저: pnpm fetch-openapi (백엔드 기동 상태)');
  process.exit(1);
}
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));

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
const warnings = [];

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

    // 1) 커서 엔드포인트에 page 번호를 보낸다 → 서버가 조용히 무시한다.
    if (/[?&]page=/.test(url)) {
      errors.push(
        `${where}: '${url}' — ${hit.specPath}는 커서 기반이라 page를 무시한다. cursor를 쓸 것.`
      );
    }

    // 2) 호출 근처에서 total/totalCount를 읽는다 → 서버 응답에 없어 항상 0이 된다.
    const totalRead = near.match(/\b(?:totalCount|total)\b\s*[,;)}\]=:]/);
    if (totalRead) {
      errors.push(
        `${where}: ${hit.specPath} 응답에서 '${totalRead[0].trim()}'를 읽는다 — ` +
          `CursorPage에는 total이 없어 항상 0이다. hasMore를 쓸 것.`
      );
    }

    // 3) 커서 엔드포인트인데 근처에서 cursor를 쓰지 않는다 → 첫 페이지에 갇혔을 가능성.
    if (!/cursor/i.test(near)) {
      warnings.push(
        `${where}: ${hit.specPath}를 호출하며 cursor를 쓰지 않는다 — 첫 페이지만 보이는지 확인.`
      );
    }
  }
}

const uniq = (xs) => [...new Set(xs)];
for (const w of uniq(warnings)) console.warn(`warn  ${w}`);
for (const e of uniq(errors)) console.error(`ERROR ${e}`);

if (errors.length > 0) {
  console.error(`\n페이지네이션 계약 드리프트 ${uniq(errors).length}건.`);
  process.exit(1);
}
console.log(`OK — 커서 엔드포인트 ${endpoints.length}개, 드리프트 없음.`);
