-- ===========================================================
-- 팀 GTL 캘린더 — Supabase 스키마
-- Supabase Dashboard → SQL Editor → New query → 전체 붙여넣기 → Run
--
-- ⚠️  주의: 이 파일을 복사하기 전에 브라우저의 페이지 번역(Chrome
--     "한국어로 번역" / Safari Translate)을 반드시 끄세요. 켜져 있으면
--     SQL 키워드 "and" 가 한국어 "및" 으로 번역되어 syntax error 가
--     발생합니다. GitHub 의 "Raw" 버튼으로 받는 것이 가장 안전합니다.
-- ===========================================================

-- 1) entries 테이블: 한 row = 한 식당 기록
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

-- 빠른 월별 조회용 인덱스
CREATE INDEX IF NOT EXISTS entries_ym_idx ON public.entries (year, month);

-- 2) votes 테이블: 한 row = (entry, 투표자) 쌍
--    voter_id 는 브라우저별로 localStorage 에 저장된 UUID
CREATE TABLE IF NOT EXISTS public.votes (
  entry_id  bigint NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  voter_id  text   NOT NULL CHECK (char_length(voter_id) >= 1 AND char_length(voter_id) <= 64),
  voted_at  timestamptz DEFAULT now(),
  PRIMARY KEY (entry_id, voter_id)
);

-- 3) Realtime publication 에 추가 (다른 팀원의 변경이 즉시 푸시됨)
ALTER PUBLICATION supabase_realtime ADD TABLE public.entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;

-- 4) RLS (Row Level Security) — 내부 도구라 anon 키로 전부 허용
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes   ENABLE ROW LEVEL SECURITY;

-- 기존 정책이 남아 있을 수 있으니 idempotent 하게 다시 만듦
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

-- 끝. SELECT 1 으로 확인:
-- SELECT count(*) FROM public.entries;
