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

const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const SUPABASE_URL      = process.env.SUPABASE_URL      || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️  환경 변수 SUPABASE_URL / SUPABASE_ANON_KEY 가 설정되지 않았습니다.');
  console.warn('    Render → Environment 에서 두 값을 추가해주세요.');
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

  // 메인 페이지
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    const htmlPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(htmlPath, 'utf8'));
    } else {
      res.writeHead(404); res.end('index.html not found');
    }
    return;
  }

  // 헬스체크 (Render UptimeRobot 등에서 사용)
  if (req.method === 'GET' && req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('ok');
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
  console.log('');
});
