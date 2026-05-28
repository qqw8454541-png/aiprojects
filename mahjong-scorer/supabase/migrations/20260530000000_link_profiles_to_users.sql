-- Link profiles to auth.users and automatically create profile rows

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create unique index so we can upsert/lookup by user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);

-- Update RLS policies for profiles so users can read their own profile
DROP POLICY IF EXISTS "profiles: public select" ON public.profiles;
CREATE POLICY "profiles: select own" ON public.profiles FOR SELECT USING (user_id = auth.uid() OR device_id IS NOT NULL);

-- Function to automatically create a profile for a new user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url, tier)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', ''), 
    COALESCE(new.raw_user_meta_data->>'avatar_url', new.raw_user_meta_data->>'picture'),
    'free'
  )
  ON CONFLICT DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run handle_new_user on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
