/**
 * 팀 GTL 캘린더 — Supabase 버전 서버
 *
 * 역할이 대폭 줄었음:
 *   - index.html 정적 서빙
 *   - /config.js 로 Supabase URL/anon key 를 브라우저에 주입
 *
 * 데이터 저장/실시간 동기화는 전부 브라우저 ↔ Supabase 가 직접 처리.
 * (따라서 data.json 도, /api/data 도 없음.)
 */

const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const zlib   = require('zlib');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;

const SUPABASE_URL      = process.env.SUPABASE_URL      || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const HOLIDAY_API_KEY   = process.env.HOLIDAY_API_KEY   || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️  환경 변수 SUPABASE_URL / SUPABASE_ANON_KEY 가 설정되지 않았습니다.');
  console.warn('    Render → Environment 에서 두 값을 추가해주세요.');
}
if (!HOLIDAY_API_KEY) {
  console.warn('ℹ️  환경 변수 HOLIDAY_API_KEY 가 비어 있어 공휴일 자동 조회가 비활성화됩니다.');
  console.warn('    공공데이터포털 "특일 정보" 서비스키를 Render 에 추가하면 자동 동기화됩니다.');
}

// 공공데이터포털 KASI 특일 정보 — getRestDeInfo (공휴일 정보 조회)
const HOLIDAY_API_URL = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo';
const HOLIDAY_TTL_MS  = 24 * 60 * 60 * 1000;   // 1 day
const holidayCache    = new Map();              // year -> { fetchedAt, data }

async function fetchHolidaysForYear(year) {
  const cached = holidayCache.get(year);
  if (cached && Date.now() - cached.fetchedAt < HOLIDAY_TTL_MS) return cached.data;

  const url = HOLIDAY_API_URL
    + '?solYear=' + year
    + '&ServiceKey=' + encodeURIComponent(HOLIDAY_API_KEY)
    + '&_type=json&numOfRows=100';

  const res = await fetch(url);
  if (!res.ok) throw new Error('upstream HTTP ' + res.status);
  const json = await res.json();

  const items = json && json.response && json.response.body && json.response.body.items
    ? json.response.body.items.item : null;
  const list = Array.isArray(items) ? items : items ? [items] : [];

  const result = {};
  for (const it of list) {
    const ld = String(it.locdate || '');
    if (ld.length !== 8) continue;
    const m = parseInt(ld.slice(4, 6), 10);
    const d = parseInt(ld.slice(6, 8), 10);
    if (Number.isInteger(m) && Number.isInteger(d)) result[m + '-' + d] = it.dateName || '';
  }

  holidayCache.set(year, { fetchedAt: Date.now(), data: result });
  return result;
}

// index.html 캐시 — mtime 이 바뀔 때만 다시 읽어 gzip 본문과 ETag 를 미리 만들어 둔다.
// (매 요청 readFileSync 제거, 전송량 ~200KB → ~40KB, 재방문은 304 로 즉시 응답)
let htmlCache = null; // { mtimeMs, raw, gz, etag }

function getHtmlCache() {
  const htmlPath = path.join(__dirname, 'index.html');
  const stat = fs.statSync(htmlPath);
  if (!htmlCache || htmlCache.mtimeMs !== stat.mtimeMs) {
    let html = fs.readFileSync(htmlPath, 'utf8');
    // Supabase 도메인 preconnect 주입 — 첫 데이터 요청의 DNS+TLS 핸드셰이크를 앞당김
    if (SUPABASE_URL) {
      html = html.replace(
        '</title>',
        '</title>\n<link rel="preconnect" href="' + SUPABASE_URL + '" crossorigin>'
      );
    }
    const raw = Buffer.from(html, 'utf8');
    htmlCache = {
      mtimeMs: stat.mtimeMs,
      raw,
      gz: zlib.gzipSync(raw, { level: 9 }),
      etag: 'W/"' + crypto.createHash('sha1').update(raw).digest('base64url').slice(0, 16) + '"'
    };
  }
  return htmlCache;
}

function getLocalIP() {
  const { networkInterfaces } = require('os');
  for (const iface of Object.values(networkInterfaces())) {
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) return alias.address;
    }
  }
  return 'localhost';
}

const server = http.createServer((req, res) => {
  // 브라우저에 Supabase 설정 주입
  if (req.method === 'GET' && req.url === '/config.js') {
    res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
    res.end(
      'window.SUPABASE_URL = '      + JSON.stringify(SUPABASE_URL)      + ';\n' +
      'window.SUPABASE_ANON_KEY = ' + JSON.stringify(SUPABASE_ANON_KEY) + ';\n'
    );
    return;
  }

  // 메인 페이지 — no-cache 로 항상 재검증하되, 배포본이 그대로면 304 로 즉시 끝낸다
  // (헤더가 없으면 브라우저 휴리스틱 캐시가 예전 HTML 을 재사용할 수 있음)
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    let cache;
    try { cache = getHtmlCache(); }
    catch (e) { res.writeHead(404); res.end('index.html not found'); return; }

    if (req.headers['if-none-match'] === cache.etag) {
      res.writeHead(304, { 'ETag': cache.etag, 'Vary': 'Accept-Encoding' });
      res.end();
      return;
    }

    const gzipOk = /\bgzip\b/i.test(req.headers['accept-encoding'] || '');
    const body = gzipOk ? cache.gz : cache.raw;
    const headers = {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache, must-revalidate',
      'ETag': cache.etag,
      'Vary': 'Accept-Encoding',
      'Content-Length': body.length
    };
    if (gzipOk) headers['Content-Encoding'] = 'gzip';
    res.writeHead(200, headers);
    res.end(body);
    return;
  }

  // 헬스체크 (Render UptimeRobot 등에서 사용)
  if (req.method === 'GET' && req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
    return;
  }

  // 공휴일 프록시 — /api/holidays/YYYY
  const holidayMatch = req.method === 'GET' && req.url.match(/^\/api\/holidays\/(\d{4})(?:\?.*)?$/);
  if (holidayMatch) {
    const year = parseInt(holidayMatch[1], 10);
    if (!HOLIDAY_API_KEY) {
      res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'HOLIDAY_API_KEY not configured on server' }));
      return;
    }
    fetchHolidaysForYear(year)
      .then(data => {
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=86400'
        });
        res.end(JSON.stringify(data));
      })
      .catch(err => {
        console.error('holiday fetch error', year, err && err.message);
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: String(err && err.message || err) }));
      });
    return;
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('');
  console.log('✅ 팀 GTL 캘린더 (Supabase 모드) 시작');
  console.log('');
  console.log(`   로컬:   http://localhost:${PORT}`);
  console.log(`   같은망: http://${ip}:${PORT}`);
  console.log('');
  console.log('   Supabase URL 설정됨:', SUPABASE_URL ? 'yes' : 'NO ❗');
  console.log('   Anon key 설정됨:    ', SUPABASE_ANON_KEY ? 'yes' : 'NO ❗');
  console.log('   공휴일 API 키 설정됨:', HOLIDAY_API_KEY ? 'yes' : 'no');
  console.log('');
});
