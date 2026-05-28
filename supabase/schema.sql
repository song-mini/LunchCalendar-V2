-- ===========================================================
-- Team GTL Lunch Calendar - Supabase schema
-- Supabase Dashboard -> SQL Editor -> New query -> paste all -> Run
-- Safe to re-run; every statement is idempotent.
-- ===========================================================

-- 1) entries table: one row = one restaurant suggestion
CREATE TABLE IF NOT EXISTS public.entries (
  id          bigserial PRIMARY KEY,
  year        int       NOT NULL CHECK (year >= 2020 AND year <= 2100),
  month       int       NOT NULL CHECK (month >= 1 AND month <= 12),
  day         int       NOT NULL CHECK (day >= 1 AND day <= 31),
  name        text      NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 30),
  memo        text      DEFAULT ''   CHECK (char_length(memo) <= 60),
  created_by  text      DEFAULT ''   CHECK (char_length(created_by) <= 64),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS entries_ym_idx ON public.entries (year, month);

-- 2) votes table: one row = (entry, voter) pair
--    voter_id is a UUID stored in browser localStorage
CREATE TABLE IF NOT EXISTS public.votes (
  entry_id  bigint NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  voter_id  text   NOT NULL CHECK (char_length(voter_id) >= 1 AND char_length(voter_id) <= 64),
  voted_at  timestamptz DEFAULT now(),
  PRIMARY KEY (entry_id, voter_id)
);

-- 3) Realtime publication (so other clients see changes instantly).
--    Wrapped in DO blocks because ALTER PUBLICATION has no IF NOT EXISTS.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.entries;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 4) RLS - internal tool, full access via anon key
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes   ENABLE ROW LEVEL SECURITY;

-- 5) Explicit Data API grants.
--    Supabase는 2026-05-30 부터 public 스키마의 새 테이블에 대해 anon/authenticated/
--    service_role 자동 GRANT를 중단합니다 (Discussion #45329). 기존 테이블은 영향
--    없지만, 마이그레이션이나 새 환경에 schema.sql 을 그대로 돌릴 때 API 접근이
--    막히지 않도록 명시적으로 GRANT 를 적어둡니다. GRANT 는 idempotent.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entries TO anon, authenticated, service_role;
GRANT SELECT, INSERT,         DELETE ON public.votes   TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.entries_id_seq TO anon, authenticated, service_role;

-- Drop-then-create so re-runs reset to known policies.
DROP POLICY IF EXISTS "anyone reads entries"   ON public.entries;
DROP POLICY IF EXISTS "anyone inserts entries" ON public.entries;
DROP POLICY IF EXISTS "anyone updates entries" ON public.entries;
DROP POLICY IF EXISTS "anyone deletes entries" ON public.entries;
DROP POLICY IF EXISTS "anyone reads votes"     ON public.votes;
DROP POLICY IF EXISTS "anyone inserts votes"   ON public.votes;
DROP POLICY IF EXISTS "anyone deletes votes"   ON public.votes;

CREATE POLICY "anyone reads entries"   ON public.entries FOR SELECT USING (true);
CREATE POLICY "anyone inserts entries" ON public.entries FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone updates entries" ON public.entries FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anyone deletes entries" ON public.entries FOR DELETE USING (true);

CREATE POLICY "anyone reads votes"     ON public.votes   FOR SELECT USING (true);
CREATE POLICY "anyone inserts votes"   ON public.votes   FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone deletes votes"   ON public.votes   FOR DELETE USING (true);

-- Verify with:  SELECT count(*) FROM public.entries;
