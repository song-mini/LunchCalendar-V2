-- ===========================================================
-- 팀 GTL 캘린더 — Supabase 스키마
-- Supabase Dashboard → SQL Editor → New query → 전체 붙여넣기 → Run
-- ===========================================================

-- 1) entries 테이블: 한 row = 한 식당 기록
create table if not exists public.entries (
  id          bigserial primary key,
  year        int       not null check (year between 2020 and 2100),
  month       int       not null check (month between 1 and 12),
  day         int       not null check (day between 1 and 31),
  name        text      not null check (char_length(name) between 1 and 30),
  memo        text      default ''   check (char_length(memo) <= 60),
  created_by  text      default ''   check (char_length(created_by) <= 64),
  created_at  timestamptz default now()
);

-- 빠른 월별 조회용 인덱스
create index if not exists entries_ym_idx on public.entries (year, month);

-- 2) votes 테이블: 한 row = (entry, 투표자) 쌍
--    voter_id 는 브라우저별로 localStorage 에 저장된 UUID
create table if not exists public.votes (
  entry_id  bigint not null references public.entries(id) on delete cascade,
  voter_id  text   not null check (char_length(voter_id) between 1 and 64),
  voted_at  timestamptz default now(),
  primary key (entry_id, voter_id)
);

-- 3) Realtime publication 에 추가 (다른 팀원의 변경이 즉시 푸시됨)
alter publication supabase_realtime add table public.entries;
alter publication supabase_realtime add table public.votes;

-- 4) RLS (Row Level Security) — 내부 도구라 anon 키로 전부 허용
alter table public.entries enable row level security;
alter table public.votes   enable row level security;

-- 기존 정책이 남아 있을 수 있으니 idempotent 하게 다시 만듦
drop policy if exists "anyone reads entries"  on public.entries;
drop policy if exists "anyone inserts entries" on public.entries;
drop policy if exists "anyone deletes entries" on public.entries;
drop policy if exists "anyone reads votes"    on public.votes;
drop policy if exists "anyone inserts votes"  on public.votes;
drop policy if exists "anyone deletes votes"  on public.votes;

create policy "anyone reads entries"   on public.entries for select using (true);
create policy "anyone inserts entries" on public.entries for insert with check (true);
create policy "anyone deletes entries" on public.entries for delete using (true);

create policy "anyone reads votes"     on public.votes   for select using (true);
create policy "anyone inserts votes"   on public.votes   for insert with check (true);
create policy "anyone deletes votes"   on public.votes   for delete using (true);

-- 끝. SELECT 1 으로 확인:
-- select count(*) from public.entries;
