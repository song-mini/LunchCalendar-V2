-- ============================================================
-- Render 웨이크업 핑 — Supabase pg_cron + pg_net
--
-- 왜 필요한가:
--   Render Free 는 15분 무요청이면 잠들어서 첫 접속이 수십 초 걸린다.
--   팀이 실제로 쓰는 "공휴일 뺀 평일 오전 근무시간"에만 깨워두고,
--   밤 · 주말 · 공휴일엔 잠들게 둔다 (그때 접속하면 콜드 스타트로 열림).
--   GitHub Actions 의 schedule 은 best-effort 라 실측 하루 2~3번만 실행돼서 쓰지 않고,
--   DB 안에서 분 단위로 정확히 도는 pg_cron 하나로만 핑한다.
--
-- 동작: 평일 08:07 ~ 13:55 (KST) 12분 간격으로 /healthz 를 GET 한다 → 하루 30번.
--   · 12분 = Render 의 15분 기준에 3분 여유. 08:07 첫 핑 덕에 08시 10분부터 바로 열리고,
--     마지막 13:55 핑 뒤 15분, 14:10 쯤 잠든다.
--   · 주말은 cron 식에서, 매달 마지막 금요일(공동 휴무)과 한국 공휴일은 함수에서 건너뛴다.
--   · 공휴일 목록은 Nager.Date(대체공휴일 포함, 키 불필요)에서 받아 public.gtl_holidays 에
--     캐시하고 30일마다 다시 받는다. 받기에 실패하면 받아둔 목록으로, 그것도 없으면 그냥 핑한다.
--   · 선거일 같은 임시공휴일이 목록에 없으면 직접 넣으면 된다 (날짜는 예시):
--       insert into public.gtl_holidays (day, name) values ('2027-01-04', '임시공휴일');
--
-- 적용: Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여넣고 Run (한 번이면 됨).
--   다시 실행해도 안전하다 (idempotent — 같은 이름의 잡은 덮어쓰고, 직접 넣은 공휴일은 유지).
--   배포 주소가 바뀌면 아래 URL 만 고쳐서 다시 실행.
--
-- 확인:
--   select jobname, schedule, active from cron.job where jobname like 'gtl-keepalive%';
--   select status, return_message, start_time from cron.job_run_details
--     order by start_time desc limit 5;
--   select status_code, created from net._http_response order by created desc limit 5;
--   select * from public.gtl_holidays order by day;   -- 올해 공휴일이 보이면 공휴일 건너뛰기 OK
--
-- 끄기:
--   select cron.unschedule('gtl-keepalive-0800');
--   select cron.unschedule('gtl-keepalive-0900-1300');
-- ============================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net  with schema extensions;
-- 공휴일 목록 조회용 (동기 HTTP — pg_net 은 비동기라 응답을 그 자리에서 못 쓴다)
create extension if not exists http    with schema extensions;

-- 공휴일 캐시. source = 'nager' 는 자동으로 받은 것, 'manual' 은 직접 넣은 것 (갱신 때 안 지워짐).
create table if not exists public.gtl_holidays (
  day    date primary key,
  name   text not null,
  source text not null default 'manual' check (source in ('nager', 'manual'))
);
create table if not exists public.gtl_holiday_years (
  year       int primary key,
  fetched_at timestamptz not null default now()
);
-- 앱(anon)에서는 안 보이게 — RLS 켜고 정책 없음 + 권한 회수. cron 은 postgres 권한으로 돈다.
alter table public.gtl_holidays      enable row level security;
alter table public.gtl_holiday_years enable row level security;
revoke all on public.gtl_holidays, public.gtl_holiday_years from anon, authenticated;

create or replace function public.gtl_refresh_holidays(y int)
returns void
language plpgsql
set search_path = ''
as $$
declare
  r extensions.http_response;
  n int;
begin
  r := extensions.http_get(   -- http 확장 기본 타임아웃 5초
    'https://date.nager.at/api/v3/PublicHolidays/' || y || '/KR');
  if r.status <> 200 then
    raise exception 'Nager.Date % → HTTP %', y, r.status;
  end if;
  n := jsonb_array_length(r.content::jsonb);
  if n = 0 then
    raise exception 'Nager.Date % → 빈 목록', y;
  end if;

  delete from public.gtl_holidays
   where source = 'nager' and day >= make_date(y, 1, 1) and day < make_date(y + 1, 1, 1);
  insert into public.gtl_holidays (day, name, source)
  select distinct on ((h->>'date')::date)
         (h->>'date')::date, coalesce(h->>'localName', h->>'name'), 'nager'
    from jsonb_array_elements(r.content::jsonb) h
  on conflict (day) do nothing;   -- 직접 넣은 항목이 우선

  insert into public.gtl_holiday_years (year) values (y)
  on conflict (year) do update set fetched_at = now();
end;
$$;

create or replace function public.gtl_keepalive_ping()
returns void
language plpgsql
set search_path = ''
as $$
declare
  d date := (now() at time zone 'Asia/Seoul')::date;
  y int  := extract(year from d)::int;
begin
  -- 매달 마지막 금요일 = 공동 휴무 → 쉰다 (일주일 뒤가 다음 달이면 마지막 금요일)
  if extract(isodow from d) = 5 and extract(month from d + 7) <> extract(month from d) then
    return;
  end if;

  -- 공휴일 → 쉰다. 목록이 없거나 30일 지났으면 먼저 받아온다.
  -- 받기에 실패하면 갖고 있던 목록으로 판단하고, 그것도 없으면 그냥 핑한다.
  if not exists (select 1 from public.gtl_holiday_years
                  where year = y and fetched_at > now() - interval '30 days') then
    begin
      perform public.gtl_refresh_holidays(y);
    exception when others then
      raise warning 'gtl_keepalive_ping: 공휴일 목록 갱신 실패 — %', sqlerrm;
    end;
  end if;
  if exists (select 1 from public.gtl_holidays where day = d) then
    return;
  end if;

  -- 응답은 기다리지 않는다 — 요청이 Render 에 도착하는 순간 인스턴스가 깨어난다.
  perform net.http_get(
    url := 'https://lunchcalendar-v2.onrender.com/healthz',
    timeout_milliseconds := 60000
  );
end;
$$;

-- PostgREST RPC 로 외부에서 호출되지 않게 막는다 (cron 은 postgres 권한으로 돈다)
revoke execute on function public.gtl_keepalive_ping()      from public, anon, authenticated;
revoke execute on function public.gtl_refresh_holidays(int) from public, anon, authenticated;

-- 올해 공휴일을 지금 한 번 받아둔다 (실패해도 스크립트는 계속 — 첫 핑 때 다시 시도)
do $$
begin
  perform public.gtl_refresh_holidays(extract(year from now() at time zone 'Asia/Seoul')::int);
exception when others then
  raise warning '공휴일 목록 미리 받기 실패 (첫 핑 때 다시 시도): %', sqlerrm;
end;
$$;

-- cron 은 UTC 기준 (KST = UTC+9). 12분 간격: 07 · 19 · 31 · 43 · 55분
--   월~금 08:07~08:55 KST = 일~목 23:07~23:55 UTC
--   월~금 09:07~13:55 KST = 월~금 00:07~04:55 UTC
-- (08:55 → 09:07 도 12분이라 시간 경계에서도 간격이 같다)
select cron.schedule('gtl-keepalive-0800',      '7,19,31,43,55 23 * * 0-4',  'select public.gtl_keepalive_ping()');
select cron.schedule('gtl-keepalive-0900-1300', '7,19,31,43,55 0-4 * * 1-5', 'select public.gtl_keepalive_ping()');
