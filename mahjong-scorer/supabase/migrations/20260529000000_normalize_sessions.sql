-- ─────────────────────────────────────────────────────────────────────────
-- 重构：将 completed_sessions 的 JSONB 列拆分为结构化关系表
--
-- 新增：session_rounds, round_player_results, session_players
-- 删除：completed_sessions.rounds (jsonb), completed_sessions.players (jsonb)
-- ─────────────────────────────────────────────────────────────────────────

-- ── 1. session_players: 对局参与玩家（FK → saved_members）────────────
CREATE TABLE public.session_players (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid NOT NULL REFERENCES public.completed_sessions(id) ON DELETE CASCADE,
  player_id       text NOT NULL,             -- 对局内临时 ID
  player_name     text NOT NULL,
  avatar_seed     text NOT NULL DEFAULT '',
  saved_member_id uuid REFERENCES public.saved_members(id) ON DELETE SET NULL,
  seat_index      integer,                   -- 座位顺序 0-3

  UNIQUE (session_id, player_id)
);

CREATE INDEX idx_session_players_session ON public.session_players(session_id);
CREATE INDEX idx_session_players_member  ON public.session_players(saved_member_id);

ALTER TABLE public.session_players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "session_players: public select" ON public.session_players FOR SELECT USING (true);
CREATE POLICY "session_players: public insert" ON public.session_players FOR INSERT WITH CHECK (true);
CREATE POLICY "session_players: public update" ON public.session_players FOR UPDATE USING (true);
CREATE POLICY "session_players: public delete" ON public.session_players FOR DELETE USING (true);


-- ── 2. session_rounds: 对局回合 ──────────────────────────────────────
CREATE TABLE public.session_rounds (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES public.completed_sessions(id) ON DELETE CASCADE,
  round_number  integer NOT NULL,
  status        text NOT NULL DEFAULT 'completed',  -- 'completed' | 'in_progress'
  start_time    bigint NOT NULL,                     -- epoch ms
  end_time      bigint,                              -- epoch ms

  UNIQUE (session_id, round_number)
);

CREATE INDEX idx_session_rounds_session ON public.session_rounds(session_id);

ALTER TABLE public.session_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "session_rounds: public select" ON public.session_rounds FOR SELECT USING (true);
CREATE POLICY "session_rounds: public insert" ON public.session_rounds FOR INSERT WITH CHECK (true);
CREATE POLICY "session_rounds: public update" ON public.session_rounds FOR UPDATE USING (true);
CREATE POLICY "session_rounds: public delete" ON public.session_rounds FOR DELETE USING (true);


-- ── 3. round_player_results: 每局每个玩家的成绩 ──────────────────────
CREATE TABLE public.round_player_results (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id      uuid NOT NULL REFERENCES public.session_rounds(id) ON DELETE CASCADE,
  player_id     text NOT NULL,              -- 对局内临时 ID
  player_name   text NOT NULL,
  wind          text NOT NULL,              -- 'east' | 'south' | 'west' | 'north'
  raw_score     integer NOT NULL,           -- e.g. 35500
  rank          integer NOT NULL,           -- 1-4
  pt            numeric(6,1) NOT NULL,      -- e.g. 45.5

  UNIQUE (round_id, player_id)
);

CREATE INDEX idx_round_results_round  ON public.round_player_results(round_id);
CREATE INDEX idx_round_results_player ON public.round_player_results(player_name);

ALTER TABLE public.round_player_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "round_player_results: public select" ON public.round_player_results FOR SELECT USING (true);
CREATE POLICY "round_player_results: public insert" ON public.round_player_results FOR INSERT WITH CHECK (true);
CREATE POLICY "round_player_results: public update" ON public.round_player_results FOR UPDATE USING (true);
CREATE POLICY "round_player_results: public delete" ON public.round_player_results FOR DELETE USING (true);


-- ── 4. 清空旧数据并删除 JSONB 列 ────────────────────────────────────
-- 清空已有对局数据（用户确认可以全清）
DELETE FROM public.completed_sessions;

-- 删除旧 JSONB 列
ALTER TABLE public.completed_sessions DROP COLUMN IF EXISTS rounds;
ALTER TABLE public.completed_sessions DROP COLUMN IF EXISTS players;
