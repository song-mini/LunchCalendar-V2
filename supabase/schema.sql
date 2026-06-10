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

-- ===========================================================
-- 6) 회식 (team dinner) — dinners / dinner_places / dinner_votes
--    설정 패널에서 회식 날짜를 잡고, 전용 화면에서 장소 후보에 투표.
--    기존 배포에 추가하려면 이 파일 전체를 SQL Editor 에서 다시 실행 (idempotent).
-- ===========================================================

-- 6-1) dinners: one row = one team dinner event (날짜 + 선택적 이름)
CREATE TABLE IF NOT EXISTS public.dinners (
  id          bigserial PRIMARY KEY,
  year        int       NOT NULL CHECK (year >= 2020 AND year <= 2100),
  month       int       NOT NULL CHECK (month >= 1 AND month <= 12),
  day         int       NOT NULL CHECK (day >= 1 AND day <= 31),
  title       text      DEFAULT ''   CHECK (char_length(title) <= 30),
  created_by  text      DEFAULT ''   CHECK (char_length(created_by) <= 64),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dinners_ymd_idx ON public.dinners (year, month, day);

-- 6-2) dinner_places: 장소 후보 (회식 삭제 시 함께 삭제)
CREATE TABLE IF NOT EXISTS public.dinner_places (
  id          bigserial PRIMARY KEY,
  dinner_id   bigint    NOT NULL REFERENCES public.dinners(id) ON DELETE CASCADE,
  name        text      NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 30),
  memo        text      DEFAULT ''   CHECK (char_length(memo) <= 60),
  created_by  text      DEFAULT ''   CHECK (char_length(created_by) <= 64),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dinner_places_dinner_idx ON public.dinner_places (dinner_id);

-- 6-3) dinner_votes: one row = (장소, 투표자) pair
CREATE TABLE IF NOT EXISTS public.dinner_votes (
  place_id  bigint NOT NULL REFERENCES public.dinner_places(id) ON DELETE CASCADE,
  voter_id  text   NOT NULL CHECK (char_length(voter_id) >= 1 AND char_length(voter_id) <= 64),
  voted_at  timestamptz DEFAULT now(),
  PRIMARY KEY (place_id, voter_id)
);

-- 6-4) Realtime publication
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.dinners;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.dinner_places;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.dinner_votes;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 6-5) RLS + Data API grants (entries/votes 와 동일한 정책)
ALTER TABLE public.dinners       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dinner_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dinner_votes  ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dinners       TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dinner_places TO anon, authenticated, service_role;
GRANT SELECT, INSERT,         DELETE ON public.dinner_votes  TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.dinners_id_seq        TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE public.dinner_places_id_seq  TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "anyone reads dinners"         ON public.dinners;
DROP POLICY IF EXISTS "anyone inserts dinners"       ON public.dinners;
DROP POLICY IF EXISTS "anyone updates dinners"       ON public.dinners;
DROP POLICY IF EXISTS "anyone deletes dinners"       ON public.dinners;
DROP POLICY IF EXISTS "anyone reads dinner places"   ON public.dinner_places;
DROP POLICY IF EXISTS "anyone inserts dinner places" ON public.dinner_places;
DROP POLICY IF EXISTS "anyone updates dinner places" ON public.dinner_places;
DROP POLICY IF EXISTS "anyone deletes dinner places" ON public.dinner_places;
DROP POLICY IF EXISTS "anyone reads dinner votes"    ON public.dinner_votes;
DROP POLICY IF EXISTS "anyone inserts dinner votes"  ON public.dinner_votes;
DROP POLICY IF EXISTS "anyone deletes dinner votes"  ON public.dinner_votes;

CREATE POLICY "anyone reads dinners"         ON public.dinners       FOR SELECT USING (true);
CREATE POLICY "anyone inserts dinners"       ON public.dinners       FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone updates dinners"       ON public.dinners       FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anyone deletes dinners"       ON public.dinners       FOR DELETE USING (true);

CREATE POLICY "anyone reads dinner places"   ON public.dinner_places FOR SELECT USING (true);
CREATE POLICY "anyone inserts dinner places" ON public.dinner_places FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone updates dinner places" ON public.dinner_places FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "anyone deletes dinner places" ON public.dinner_places FOR DELETE USING (true);

CREATE POLICY "anyone reads dinner votes"    ON public.dinner_votes  FOR SELECT USING (true);
CREATE POLICY "anyone inserts dinner votes"  ON public.dinner_votes  FOR INSERT WITH CHECK (true);
CREATE POLICY "anyone deletes dinner votes"  ON public.dinner_votes  FOR DELETE USING (true);

-- Verify with:  SELECT count(*) FROM public.entries;
