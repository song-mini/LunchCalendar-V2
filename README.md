# 팀 GTL 캘린더 — Supabase 실시간 버전

기존 `data.json` 파일 저장 방식에서 **Supabase Postgres + Realtime** 으로 교체한 버전입니다.

| 항목 | 변경 전 | 변경 후 |
| --- | --- | --- |
| 저장소 | `data.json` (디스크) | Supabase Postgres |
| 영구성 | Render 재시작 시 ❌ 사라짐 | ✅ 영구 보관 |
| 실시간 반영 | ❌ (새로고침 필요) | ✅ 자동 (postgres_changes) |
| 동시 편집 | ⚠️ 전체 덮어쓰기 (한쪽 사라짐) | ✅ 안전 (row 단위) |
| 비용 | Render 무료 | Render 무료 + Supabase 무료 |

---

## 0. 준비물

- Supabase 계정 (무료) — https://supabase.com
- 기존 Render 계정
- 이 폴더 (`lunch-calendar-supabase/`)

---

## 1. GitHub 에 새 리포지토리 만들기

기존 `lunch-calendar` 리포가 있더라도, 이 폴더를 **새 리포로 올리는 게 권장**입니다. (구버전은 백업 차원에서 그대로 두세요.)

### 방법 A — GitHub 웹 UI 에 그냥 드래그
1. https://github.com/new 에서 새 리포지토리 생성 (예: `lunch-calendar-v2`)
2. "uploading an existing file" 링크 클릭
3. 이 폴더 안의 파일을 **전부** 드래그해서 올림
   - `index.html`, `server.js`, `package.json`, `.gitignore`, `.env.example`, `README.md`, `supabase/schema.sql`
4. Commit

### 방법 B — 터미널
```bash
cd lunch-calendar-supabase
git init
git add .
git commit -m "Initial commit (Supabase realtime version)"
git branch -M main
git remote add origin https://github.com/<your-username>/lunch-calendar-v2.git
git push -u origin main
```

---

## 2. Supabase 프로젝트 만들기

1. https://supabase.com 접속 → **Start your project** → GitHub 로 로그인
2. **New project** 클릭
3. 입력:
   - **Name**: `lunch-calendar` (아무거나)
   - **Database Password**: 적당히 강한 비밀번호 (어차피 직접 쓸 일 없음, 어딘가 메모만)
   - **Region**: **`Northeast Asia (Seoul)`** 선택 — 한국에서 가장 빠름
   - **Pricing Plan**: `Free`
4. **Create new project** → 약 2분 대기 (DB 프로비저닝)

## 3. 스키마 적용 (테이블 만들기)

1. 프로비저닝 끝나면 좌측 메뉴에서 **SQL Editor** 클릭
2. **New query** 버튼
3. 이 폴더의 `supabase/schema.sql` 파일 전체 내용을 복사해서 붙여넣기
4. 우측 하단 **Run** 클릭 (또는 `Ctrl+Enter`)
5. "Success. No rows returned" 같은 메시지가 뜨면 OK

확인: 좌측 **Table Editor** 클릭 → `entries`, `votes`, `dinners`, `dinner_places`, `dinner_votes` 테이블이 보여야 함.

> 💡 **이미 운영 중인 프로젝트에 회식 기능을 추가하려면** — `supabase/schema.sql` 전체를 SQL Editor 에서 한 번 더 실행하면 됩니다 (모든 구문이 idempotent 라 기존 데이터는 안전). 실행 전까지는 회식 기능만 비활성화되고 점심 캘린더는 정상 작동합니다.

## 4. URL + Anon Key 복사

1. 좌측 메뉴 맨 아래 **Project Settings** (⚙️ 아이콘) 클릭
2. **API** 탭
3. 두 값을 메모장에 복사:
   - **Project URL** — `https://xxxxxxxxxxxxxxxxxxxx.supabase.co` 형태
   - **anon public** key — `eyJ...` 로 시작하는 긴 문자열

> 💡 `service_role` key 는 **절대 복사하지 마세요**. 그건 슈퍼유저 권한이라 브라우저에 노출되면 안 됩니다. `anon public` 만 사용합니다.

---

## 5. Render 에 배포

### 5-1. 새 웹 서비스로 다시 만들기 (권장)
1. https://dashboard.render.com → **New** → **Web Service**
2. GitHub 연결 후 방금 만든 `lunch-calendar-v2` 리포 선택
3. 설정:
   - **Name**: `lunch-calendar-v2`
   - **Region**: `Singapore` (한국에서 가장 가까움)
   - **Branch**: `main`
   - **Build Command**: 비워둠
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`
4. **Environment Variables** 섹션에서 추가:
   | Key | Value |
   | --- | --- |
   | `SUPABASE_URL` | (4번에서 복사한 URL) |
   | `SUPABASE_ANON_KEY` | (4번에서 복사한 anon key) |
   | `HOLIDAY_API_KEY` | (공공데이터포털 "특일 정보" Decoding 서비스키, 선택) |

   > `HOLIDAY_API_KEY`는 공휴일 자동 동기화용입니다. 비워두면 캘린더는 정상 작동하지만 공휴일 표시가 비활성화됩니다. 발급: https://www.data.go.kr → "특일 정보" 검색 → 활용신청 → 마이페이지 → 인증키.
5. **Create Web Service** → 자동 배포 (약 1~2분)

### 5-2. 기존 서비스의 리포만 바꾸고 싶다면
- 기존 서비스의 **Settings** → **Repository** → 새 리포 URL 로 변경
- **Environment** 탭에서 위 두 환경 변수 추가
- **Manual Deploy** → **Deploy latest commit**

---

## 6. 테스트

1. Render 가 준 URL 접속 (예: `https://lunch-calendar-v2.onrender.com`)
2. 우측 상단 동기 표시줄 확인:
   - **"불러오는 중…"** → **"서버에 저장됨"** 으로 바뀌면 ✅ Supabase 연결 성공
   - **"설정 누락"** 이면 환경 변수가 안 잡힌 것 → Render Environment 다시 확인
   - **"연결 오류"** 면 SQL 스키마가 적용 안 됐거나 anon key 가 틀린 것 (표시줄 클릭 시 재시도)
3. 5월 어느 날 칸 클릭 → 식당 이름 입력 → 추가
4. **다른 브라우저 / 폰** 에서 같은 URL 열어서 — 새로고침 없이 즉시 같은 내용이 보이면 실시간 OK 👍

### 회식 기능 사용법

1. 우측 하단 ⚙️ (또는 좌측 상단 ●●● 점 3개) → 설정 패널의 **🍻 회식** 섹션
2. 날짜 선택 (+ 이름은 선택) → **회식 날짜 잡기**
3. 달력 해당 날짜에 🍻 태그가, 달력 위에는 D-day 배너가 생김
4. 배너/태그 클릭 → **장소 정하기** 화면에서 후보 등록 + 투표 (🎲 골라줘로 랜덤 선택도 가능)
5. 회식이 끝나거나 취소하려면 설정 패널 또는 장소 화면의 **회식 취소**

---

## 7. 비용 / 한도 (참고)

- **Supabase Free**: DB 500MB + Auth + Realtime 200 동시 접속 + Egress 5GB/월. 점심 캘린더 8개월 운영 시 0.01% 도 안 씀.
- **Render Free**: 15분 미사용 시 sleep — **이제 무관**. 자다 깨도 데이터가 Supabase 에 있으므로 안 사라짐. 첫 요청만 5~10초 늦게 응답.
- 둘 다 평생 무료로 충분합니다.

---

## 8. 자주 막히는 부분

| 증상 | 해결 |
| --- | --- |
| "설정 누락" 표시 | Render → Environment → `SUPABASE_URL`, `SUPABASE_ANON_KEY` 둘 다 들어갔는지 확인. 추가 후 **Manual Deploy 한 번 더** (env 바뀌면 재배포 필요). |
| 설정 패널에 "회식 기능을 켜려면…" 안내가 보임 | `supabase/schema.sql` 을 SQL Editor 에서 다시 실행 (dinners 테이블들이 아직 없는 상태). |
| "연결 오류 · 재시도" 표시 | (1) Supabase SQL 스키마 적용했는지 확인 (Table Editor 에 entries/votes 보여야 함). (2) Project Settings → API 의 **anon public** 키를 썼는지 (service_role 아님). 표시줄을 클릭하면 다시 연결을 시도합니다. |
| 추가는 되는데 다른 브라우저에서 안 보임 | Supabase Dashboard → Database → Replication → `supabase_realtime` publication 에 entries, votes 둘 다 들어있는지 확인. schema.sql 이 자동으로 넣어주지만 가끔 빠짐. |
| 같은 사람이 두 번 투표됨 | localStorage 가 비워졌거나, 시크릿 모드. 정상 동작. 한 디바이스 = 1표. |
| Render 가 자다 깨서 첫 응답이 느림 | 무료 플랜 특성. UptimeRobot 으로 5분마다 `/healthz` 핑 보내면 sleep 방지 (선택). |

---

## 9. 데이터 백업

Supabase Dashboard → **Database** → **Backups** → 일일 백업이 자동으로 7일치 보관됩니다 (무료 플랜도).

수동으로 받고 싶으면 SQL Editor 에서:
```sql
select * from entries;
select * from votes;
```
실행 후 우측 상단 **Download CSV**.

---

## 10. 로컬 개발

```bash
cd lunch-calendar-supabase
cp .env.example .env
# .env 에 본인 SUPABASE_URL, SUPABASE_ANON_KEY 채우기

# .env 파일을 자동으로 읽으려면 (선택):
node --env-file=.env server.js     # node 20+
# 또는
SUPABASE_URL=... SUPABASE_ANON_KEY=... node server.js
```

브라우저로 `http://localhost:3000` 접속.

> Node 의존성 0개라서 `npm install` 도 필요 없습니다. 그냥 `node server.js`.

---

## 파일 구성

| 파일 | 역할 |
| --- | --- |
| `index.html` | 메인 UI. 원본의 모든 디자인/인터랙션 유지. 데이터 레이어만 Supabase 로 교체. |
| `server.js` | `index.html` + `/config.js` 만 서빙. 데이터 API 는 없음. |
| `package.json` | start 스크립트만. 의존성 없음. |
| `supabase/schema.sql` | Supabase SQL Editor 에 붙여넣을 스키마. |
| `.env.example` | 로컬 개발용 환경 변수 템플릿. |
| `.gitignore` | `.env`, `data.json`, `node_modules` 제외. |

---

## 다음 단계 아이디어

지금 구조에서 더 발전시키고 싶다면:

- **본인 이름 입력** — 처음 접속 시 이름 한 번 받아서 localStorage 저장 → entries.created_by 에 이름도 넣기 → "이거 누가 추천했지?" 추적
- **자동완성** — 이전에 입력된 식당 목록에서 추천
- **월말 1등 자동 집계** — `select name, count(*) from votes ... group by name`
- **검색** — `select` 에 `.ilike('name', '%검색어%')`
- **공휴일 자동 업데이트** — 공공데이터포털 API 로 매년 1월 자동 fetch
