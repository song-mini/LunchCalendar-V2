-- ============================================================
-- Render 웨이크업 핑 — Supabase pg_cron + pg_net
--
-- 왜 필요한가:
--   GitHub Actions 의 schedule 은 best-effort 라 실제로는 대부분 버려진다.
--   (실측: 평일 하루 36번 요청 → 실제 실행 2~3번, 첫 실행이 10~11시, 08시대는 0번)
--   그 사이 Render Free 는 15분 무요청이면 잠들어서 첫 접속이 수십 초 걸렸다.
--   pg_cron 은 DB 안에서 분 단위로 정확히 돌기 때문에 이걸 주 스케줄러로 쓴다.
--   (.github/workflows/keepalive.yml 은 백업으로 남겨둠)
--
-- 동작: 평일 08:07 ~ 13:57 (KST) 10분 간격으로 /healthz 를 GET 한다.
--   · 주말은 cron 식에서, 매달 마지막 금요일(공동 휴무)은 함수에서 건너뛴다.
--   · 공휴일은 거르지 않는다 (DB 에서 공휴일 API 를 동기로 부를 수 없어서).
--     공휴일에 깨어 있어도 Render 무료 750시간/월 안에서 몇 시간 더 쓰는 정도.
--
-- 적용: Supabase 대시보드 → SQL Editor 에 이 파일 전체를 붙여넣고 Run (한 번이면 됨).
--   다시 실행해도 안전하다 (idempotent — 같은 이름의 잡은 덮어씀).
--   배포 주소가 바뀌면 아래 URL 만 고쳐서 다시 실행.
--
-- 확인:
--   select jobname, schedule, active from cron.job where jobname like 'gtl-keepalive%';
--   select status, return_message, start_time from cron.job_run_details
--     order by start_time desc limit 5;
--   select status_code, created from net._http_response order by created desc limit 5;
--
-- 끄기:
--   select cron.unschedule('gtl-keepalive-0800');
--   select cron.unschedule('gtl-keepalive-0900-1300');
-- ============================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net  with schema extensions;

create or replace function public.gtl_keepalive_ping()
returns void
language plpgsql
set search_path = ''
as $$
declare
  d date := (now() at time zone 'Asia/Seoul')::date;
begin
  -- 매달 마지막 금요일 = 공동 휴무 → 쉰다 (일주일 뒤가 다음 달이면 마지막 금요일)
  if extract(isodow from d) = 5 and extract(month from d + 7) <> extract(month from d) then
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
revoke execute on function public.gtl_keepalive_ping() from public, anon, authenticated;

-- cron 은 UTC 기준 (KST = UTC+9)
--   월~금 08:07~08:57 KST = 일~목 23:07~23:57 UTC
--   월~금 09:07~13:57 KST = 월~금 00:07~04:57 UTC
select cron.schedule('gtl-keepalive-0800',      '7,17,27,37,47,57 23 * * 0-4',  'select public.gtl_keepalive_ping()');
select cron.schedule('gtl-keepalive-0900-1300', '7,17,27,37,47,57 0-4 * * 1-5', 'select public.gtl_keepalive_ping()');
