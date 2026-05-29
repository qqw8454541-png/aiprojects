-- 1. Create user_devices
CREATE TABLE public.user_devices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id           text NOT NULL UNIQUE,
  user_id             uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  platform            text NOT NULL DEFAULT 'web',
  app_version         text DEFAULT '',
  os_version          text DEFAULT '',
  device_model        text DEFAULT '',
  device_manufacturer text DEFAULT '',
  user_agent          text DEFAULT '',
  screen_resolution   text DEFAULT '',
  language            text DEFAULT '',
  timezone            text DEFAULT '',
  is_virtual          boolean DEFAULT false,
  last_seen_at        timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_user_devices_user_id ON public.user_devices(user_id);
CREATE INDEX idx_user_devices_device_id ON public.user_devices(device_id);

-- 2. Business tables structural changes
-- saved_members: add updated_at, deleted_at
ALTER TABLE public.saved_members
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- saved_rooms: add deleted_at
ALTER TABLE public.saved_rooms
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 3. Data migration: device_id + user_id into user_devices
INSERT INTO public.user_devices (device_id, user_id)
  SELECT DISTINCT device_id, user_id FROM public.saved_members
  WHERE device_id IS NOT NULL
  ON CONFLICT (device_id) DO UPDATE
    SET user_id = COALESCE(EXCLUDED.user_id, user_devices.user_id);

INSERT INTO public.user_devices (device_id, user_id)
  SELECT DISTINCT device_id, user_id FROM public.saved_rooms
  WHERE device_id IS NOT NULL
  ON CONFLICT (device_id) DO UPDATE
    SET user_id = COALESCE(EXCLUDED.user_id, user_devices.user_id);

INSERT INTO public.user_devices (device_id, user_id)
  SELECT DISTINCT device_id, user_id FROM public.completed_sessions
  WHERE device_id IS NOT NULL
  ON CONFLICT (device_id) DO UPDATE
    SET user_id = COALESCE(EXCLUDED.user_id, user_devices.user_id);

-- 4. Clear old RLS and write new ones
-- Drop public/auth policies for all business tables
DROP POLICY IF EXISTS "saved_members: public select" ON public.saved_members;
DROP POLICY IF EXISTS "saved_members: public insert" ON public.saved_members;
DROP POLICY IF EXISTS "saved_members: public update" ON public.saved_members;
DROP POLICY IF EXISTS "saved_members: public delete" ON public.saved_members;
DROP POLICY IF EXISTS "saved_members: device owner full access" ON public.saved_members;
DROP POLICY IF EXISTS "saved_members: auth user full access" ON public.saved_members;

DROP POLICY IF EXISTS "saved_rooms: public select" ON public.saved_rooms;
DROP POLICY IF EXISTS "saved_rooms: public insert" ON public.saved_rooms;
DROP POLICY IF EXISTS "saved_rooms: public update" ON public.saved_rooms;
DROP POLICY IF EXISTS "saved_rooms: public delete" ON public.saved_rooms;
DROP POLICY IF EXISTS "saved_rooms: auth user full access" ON public.saved_rooms;

DROP POLICY IF EXISTS "sessions: public select" ON public.completed_sessions;
DROP POLICY IF EXISTS "sessions: public insert" ON public.completed_sessions;
DROP POLICY IF EXISTS "sessions: public update" ON public.completed_sessions;
DROP POLICY IF EXISTS "sessions: public delete" ON public.completed_sessions;
DROP POLICY IF EXISTS "sessions: auth user full access" ON public.completed_sessions;

DROP POLICY IF EXISTS "session_players: public select" ON public.session_players;
DROP POLICY IF EXISTS "session_players: public insert" ON public.session_players;
DROP POLICY IF EXISTS "session_players: public update" ON public.session_players;
DROP POLICY IF EXISTS "session_players: public delete" ON public.session_players;

DROP POLICY IF EXISTS "session_rounds: public select" ON public.session_rounds;
DROP POLICY IF EXISTS "session_rounds: public insert" ON public.session_rounds;
DROP POLICY IF EXISTS "session_rounds: public update" ON public.session_rounds;
DROP POLICY IF EXISTS "session_rounds: public delete" ON public.session_rounds;

DROP POLICY IF EXISTS "round_player_results: public select" ON public.round_player_results;
DROP POLICY IF EXISTS "round_player_results: public insert" ON public.round_player_results;
DROP POLICY IF EXISTS "round_player_results: public update" ON public.round_player_results;
DROP POLICY IF EXISTS "round_player_results: public delete" ON public.round_player_results;

DROP POLICY IF EXISTS "room_members: public select" ON public.room_members;
DROP POLICY IF EXISTS "room_members: public insert" ON public.room_members;
DROP POLICY IF EXISTS "room_members: public update" ON public.room_members;
DROP POLICY IF EXISTS "room_members: public delete" ON public.room_members;

DROP POLICY IF EXISTS "profiles: public select" ON public.profiles;
DROP POLICY IF EXISTS "profiles: public insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles: public update" ON public.profiles;
DROP POLICY IF EXISTS "profiles: select own" ON public.profiles;

-- 5. Drop user_id from business tables
ALTER TABLE public.saved_members DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.saved_rooms DROP COLUMN IF EXISTS user_id;
ALTER TABLE public.completed_sessions DROP COLUMN IF EXISTS user_id;

-- 6. Cleanup profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS device_id;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS avatar_url;
DROP INDEX IF EXISTS idx_profiles_device_id;

-- 7. Rebuild ai_usage_log foreign key
ALTER TABLE public.ai_usage_log DROP CONSTRAINT IF EXISTS ai_usage_log_user_id_fkey;
ALTER TABLE public.ai_usage_log ALTER COLUMN user_id TYPE uuid USING user_id::uuid;
ALTER TABLE public.ai_usage_log
  ADD CONSTRAINT ai_usage_log_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- New RLS
CREATE POLICY "user_devices: own or unclaimed"
  ON public.user_devices FOR ALL
  USING (user_id = auth.uid() OR user_id IS NULL)
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "profiles: own"
  ON public.profiles FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "saved_members: own device"
  ON public.saved_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_devices ud
      WHERE ud.device_id = saved_members.device_id
      AND (ud.user_id = auth.uid() OR ud.user_id IS NULL)
    )
  );

CREATE POLICY "saved_rooms: own device"
  ON public.saved_rooms FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_devices ud
      WHERE ud.device_id = saved_rooms.device_id
      AND (ud.user_id = auth.uid() OR ud.user_id IS NULL)
    )
  );

CREATE POLICY "completed_sessions: own device"
  ON public.completed_sessions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_devices ud
      WHERE ud.device_id = completed_sessions.device_id
      AND (ud.user_id = auth.uid() OR ud.user_id IS NULL)
    )
  );

CREATE POLICY "session_players: via session"
  ON public.session_players FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.completed_sessions cs
      JOIN public.user_devices ud ON ud.device_id = cs.device_id
      WHERE cs.id = session_players.session_id
      AND (ud.user_id = auth.uid() OR ud.user_id IS NULL)
    )
  );

CREATE POLICY "session_rounds: via session"
  ON public.session_rounds FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.completed_sessions cs
      JOIN public.user_devices ud ON ud.device_id = cs.device_id
      WHERE cs.id = session_rounds.session_id
      AND (ud.user_id = auth.uid() OR ud.user_id IS NULL)
    )
  );

CREATE POLICY "round_player_results: via round"
  ON public.round_player_results FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.session_rounds sr
      JOIN public.completed_sessions cs ON cs.id = sr.session_id
      JOIN public.user_devices ud ON ud.device_id = cs.device_id
      WHERE sr.id = round_player_results.round_id
      AND (ud.user_id = auth.uid() OR ud.user_id IS NULL)
    )
  );

CREATE POLICY "room_members: via room"
  ON public.room_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.saved_rooms sr
      JOIN public.user_devices ud ON ud.device_id = sr.device_id
      WHERE sr.id = room_members.room_id
      AND (ud.user_id = auth.uid() OR ud.user_id IS NULL)
    )
  );
