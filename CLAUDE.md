# 팀 GTL 캘린더 — 작업 가이드

## 워크플로

- **수정사항이 생기면 항상 새 PR을 열어서 사용자가 직접 머지하게 한다.**
  - 같은 브랜치(`claude/redo-ui-ux-improvements-aFKBl`)를 계속 써도 되지만, 기존 PR이 머지/닫힘 상태라면 새 PR을 생성한다.
  - 직접 main에 푸시하지 않는다.
  - 머지는 사용자가 GitHub 웹 UI에서 한다.

## 리포 구조

- `index.html` — 단일 파일 SPA. 모든 UI/로직/CSS 인라인.
- `server.js` — 의존성 0개 Node HTTP 서버. `index.html` 정적 서빙 + `/config.js` (Supabase env 주입) + `/api/holidays/:year` (KASI 공휴일 프록시).
- `supabase/schema.sql` — Supabase Postgres 스키마 (entries / votes 테이블 + RLS).
- `.env.example` — 로컬 개발용 환경변수 템플릿.

## 환경변수 (Render)

- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — 필수
- `HOLIDAY_API_KEY` — 공휴일 표시용 (공공데이터포털 "특일 정보" 서비스키)
- `PORT` — Render가 자동 주입

## 로컬 미리보기

`SUPABASE_URL`/`SUPABASE_ANON_KEY`가 없으면 `index.html`이 인메모리 mock으로 동작 (시드 데이터 + mock fetch). `node server.js` 만으로도 페이지가 렌더링됨.
