#!/bin/bash
# script to manually upgrade a test user to pro in the local supabase instance

if [ -z "$1" ]; then
  echo "Usage: ./scripts/make-pro.sh <user-email>"
  exit 1
fi

EMAIL=$1

echo "Upgrading user $EMAIL to pro tier..."

npx supabase db query "
INSERT INTO public.profiles (user_id, tier)
SELECT id, 'pro' FROM auth.users WHERE email = '$EMAIL' LIMIT 1
ON CONFLICT (user_id) DO UPDATE SET tier = 'pro';
"

echo "Done! If the user email was found, they are now a Pro member."
echo "Please ask the user to log out and log back in, or refresh the page to sync the tier."
