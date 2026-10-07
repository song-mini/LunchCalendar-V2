# 팀 GTL 캘린더 — 작업 가이드

## 워크플로

- **수정사항이 생기면 채팅에서 한 번 확인받고 곧바로 `main` 브랜치에 직접 푸시한다.**
  - PR을 만들지 않는다 (사용자가 GitHub 들어가서 머지하는 두 번 일을 막기 위함).
  - 어떤 변경인지/어디를 만지는지 채팅에서 1줄로 확인한 뒤 push.
  - 절대 destructive 작업(`push --force`, `reset --hard`, 브랜치 삭제 등)은 명시적 허락 없이 하지 않는다.
  - 새 기능 추가가 아닌 명확한 버그/오타/픽스는 굳이 확인 없이 push 해도 된다 (의심스러우면 묻기).

## 리포 구조

- `index.html` — 단일 파일 SPA. 모든 UI/로직/CSS 인라인.
- `server.js` — 의존성 0개 Node HTTP 서버. `index.html` 정적 서빙 + `/config.js` (Supabase env 주입) + `/api/holidays/:year` (KASI 공휴일 프록시) + `/healthz` (정적 ok, Render 헬스체크) + `/healthz/db` (entries 1건 read — Supabase 활동 핑용).
- `supabase/schema.sql` — Supabase Postgres 스키마 (entries / votes + 회식용 dinners / dinner_places / dinner_votes 테이블 + RLS). 테이블이 추가되면 사용자가 Supabase SQL Editor에서 재실행해야 반영됨 (전체 idempotent).
- `.env.example` — 로컬 개발용 환경변수 템플릿.
- `supabase/keepalive.sql` — **Render 웨이크업 핑 (유일한 스케줄러).** Supabase pg_cron + pg_net 으로 공휴일 뺀 평일 08:07~13:55(KST) 12분 간격 `/healthz` GET → 하루 30번 (Render 15분 sleep 기준에 3분 여유). 밤·주말·공휴일은 일부러 잠들게 둠 (사용자 합의). 마지막 금요일·한국 공휴일은 함수에서 건너뜀 — 공휴일은 `http` 확장으로 Nager.Date 를 받아 `gtl_holidays` 테이블에 캐시(30일마다 갱신, 실패 시 기존 캐시 → 없으면 그냥 핑), 임시공휴일은 수동 insert. 사용자가 SQL Editor 에서 한 번 실행해야 적용 (재실행 안전). 배포 URL 이 바뀌면 파일 안 URL 수정 후 재실행. (예전 GitHub Actions keepalive 루프는 schedule 이 best-effort 라 하루 2~3번만 돌고 핑만 중복돼서 제거함)
- `.github/workflows/supabase-keepalive.yml` — Supabase Free 는 7일 무활동 시 프로젝트를 자동 일시중지한다. 웨이크업 핑은 주말·공휴일을 건너뛰므로 연휴가 길면 7일을 넘길 수 있어, 이 워크플로가 **매일 조건 없이** `/healthz/db` 를 쳐서 활동을 남긴다. 대상 URL 은 `KEEPALIVE_URL` 변수에서 유도.

## 환경변수 (Render)

- `SUPABASE_URL`, `SUPABASE_ANON_KEY` — 필수
- `HOLIDAY_API_KEY` — 공휴일 표시용 (공공데이터포털 "특일 정보" 서비스키)
- `PORT` — Render가 자동 주입

## 로컬 미리보기

`SUPABASE_URL`/`SUPABASE_ANON_KEY`가 없으면 `index.html`이 인메모리 mock으로 동작 (시드 데이터 + mock fetch). `node server.js` 만으로도 페이지가 렌더링됨.
