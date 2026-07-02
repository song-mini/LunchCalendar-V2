# 팀 GTL 캘린더

> "오늘 뭐 먹지?" 를 하루 30분씩 고민하는 팀을 위한 실시간 점심 달력

날짜 칸에 식당을 올리고, 👍 로 투표하고, 그래도 못 정하겠으면 주사위한테 맡깁니다.
팀원 누가 뭘 올리든 새로고침 없이 바로 보입니다.

의존성 0개짜리 Node 서버 하나 + 단일 `index.html` — 데이터와 실시간 동기화는 전부
브라우저가 Supabase 와 직접 주고받습니다.

<br/>

## 뭘 할 수 있나

**점심**
- 날짜 칸을 클릭해 식당 후보 등록 (메모, 이전 입력 자동완성 지원)
- 후보마다 👍 투표 — 한 디바이스 1표, 1위엔 왕관 👑
- 오전엔 왼쪽 "오늘의 점심" 카드에 오늘 후보와 현재 1위가 정리됨
- **메뉴 정해줘!** 버튼 — 셔플 스포트라이트 후 랜덤 당첨, 김 나는 이펙트 + 음식 콘페티 🎲

**회식**
- 설정(⚙️)에서 미니 캘린더로 날짜를 잡으면 달력에 🍻 배지 + D-day 배너 생성
- 배너를 눌러 장소 후보를 올리고 투표로 결정 (여기도 주사위 있음)

**보는 재미**
- 컬러 팔레트 6종 (살구 · 라떼 · 피스타치오 · 베리 · 잉크 · 로즈) + 다크 모드
- 제목 폰트 5종 (Geist 기본 · 함렛 · 고운바탕 · 송명 · 고운돋움)
- 레이아웃 2종 (사이드바 / 상단 카드), FHD 화면에선 스크롤 없이 꽉 차게
- 한국 공휴일 자동 표시 (KASI 특일 정보 API), 매달 마지막 금요일은 공동 휴무로 표시

**조작**
| 동작 | 방법 |
| --- | --- |
| 월 이동 | `←` `→` 키, 마우스 휠, 모바일 스와이프 |
| 오늘로 점프 | `T` 또는 `Home` |
| 다크 모드 토글 | `D` |
| 설정 열기 | 좌측 상단 ●●● 또는 우하단 ⚙️ |

<br/>

## 바로 돌려보기

```bash
node server.js
```

이게 전부입니다. `npm install` 필요 없음 (의존성 0개).
Supabase 환경 변수가 없으면 시드 데이터가 들어간 인메모리 mock 으로 떠서,
`http://localhost:3000` 에서 모든 기능을 그대로 만져볼 수 있습니다.

실제 데이터로 붙이려면:

```bash
cp .env.example .env        # SUPABASE_URL, SUPABASE_ANON_KEY 채우기
node --env-file=.env server.js
```

<br/>

## 배포 (Render + Supabase, 둘 다 무료)

요약하면 ① Supabase 프로젝트 만들고 ② 스키마 넣고 ③ Render 에 리포 연결 + 환경 변수 두 개.

<details>
<summary><b>따라하기 (처음이면 펼치세요)</b></summary>

### 1. Supabase 프로젝트

1. [supabase.com](https://supabase.com) → New project
2. Region 은 `Northeast Asia (Seoul)`, Plan 은 Free
3. 프로비저닝이 끝나면 **SQL Editor** → `supabase/schema.sql` 내용 전체 붙여넣고 Run
4. Table Editor 에 `entries` `votes` `dinners` `dinner_places` `dinner_votes` 가 보이면 성공

이미 운영 중인 DB 에 새 테이블만 추가할 때도 `schema.sql` 을 통째로 다시 실행하면
됩니다 — 전부 idempotent 라 기존 데이터는 건드리지 않습니다.

### 2. 키 복사

Project Settings → API 에서 두 값을 복사합니다.

- **Project URL** (`https://xxxx.supabase.co`)
- **anon public** key

`service_role` 키는 브라우저에 노출되면 안 되므로 절대 쓰지 않습니다.

### 3. Render

1. [dashboard.render.com](https://dashboard.render.com) → New → Web Service → 이 리포 연결
2. Branch `main` / Build Command 비움 / Start Command `node server.js` / Free
3. Environment Variables:

   | Key | Value |
   | --- | --- |
   | `SUPABASE_URL` | 위에서 복사한 URL |
   | `SUPABASE_ANON_KEY` | 위에서 복사한 anon key |
   | `HOLIDAY_API_KEY` | 공공데이터포털 "특일 정보" 서비스키 *(선택 — 없으면 공휴일 표시만 꺼짐)* |

4. 배포 후 우측 상단 표시가 **"서버에 저장됨"** 으로 바뀌면 끝.
   다른 브라우저에서 열어 실시간으로 같이 움직이는지 확인해보세요.

</details>

<br/>

## 파일 구성

| 파일 | 역할 |
| --- | --- |
| `index.html` | 앱 전체. UI·로직·CSS 가 한 파일에 들어있는 SPA |
| `server.js` | 정적 서빙 + `/config.js`(env 주입) + `/api/holidays/:year`(공휴일 프록시) |
| `supabase/schema.sql` | 테이블 + RLS. SQL Editor 에 붙여넣기용, 재실행 안전 |
| `.env.example` | 로컬 개발용 환경 변수 템플릿 |

<br/>

## 자주 막히는 부분

| 증상 | 확인할 것 |
| --- | --- |
| "설정 누락" 표시 | Render Environment 에 `SUPABASE_URL` / `SUPABASE_ANON_KEY` 둘 다 있는지. env 를 바꿨으면 Manual Deploy 한 번 더 |
| "연결 오류 · 재시도" | 스키마를 적용했는지, anon key 를 썼는지 (`service_role` 아님). 표시줄 클릭 시 재연결 시도 |
| 설정에 "회식 기능을 켜려면…" 안내 | `schema.sql` 재실행 필요 (dinners 테이블이 아직 없음) |
| 추가는 되는데 남에게 안 보임 | Supabase → Database → Replication 에서 `supabase_realtime` publication 에 테이블들이 들어있는지 |
| 첫 접속이 5~10초 느림 | Render Free 의 sleep. 신경 쓰이면 UptimeRobot 으로 `/healthz` 를 5분마다 핑 |

투표는 계정 없이 localStorage 의 익명 id 로 구분합니다. 시크릿 모드나 캐시 삭제 후엔
새 사람으로 취급되는데, 점심 정하는 용도엔 이 정도가 적당하다고 판단했습니다.

데이터 백업은 Supabase 가 무료 플랜에서도 일일 백업 7일치를 자동 보관하고,
급하면 SQL Editor 에서 `select * from entries;` 찍고 Download CSV 하면 됩니다.
