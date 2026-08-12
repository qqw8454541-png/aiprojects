import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { JWT } from "npm:google-auth-library@9";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch the user's current subscription details
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('subscription_platform, subscription_product_id, subscription_purchase_token')
      .eq('user_id', user.id)
      .single()

    if (profileError || !profile) {
      throw new Error('Profile not found')
    }

    if (profile.subscription_platform !== 'android') {
      throw new Error('Only Android subscriptions can be cancelled via this API')
    }

    const packageName = 'com.mahjongscorer.app' // Must match the package name used in purchase
    const productId = profile.subscription_product_id
    const purchaseToken = profile.subscription_purchase_token

    if (!productId || !purchaseToken) {
      throw new Error('Missing subscription details in profile')
    }

    const serviceAccountJsonStr = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if (!serviceAccountJsonStr) {
      throw new Error('Server configuration error: Google Service Account missing')
    }

    const serviceAccount = JSON.parse(serviceAccountJsonStr)
    const client = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    })

    const tokenInfo = await client.getAccessToken()
    if (!tokenInfo.token) {
      throw new Error('Failed to get Google API access token')
    }

    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}:cancel`
    
    const cancelRes = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenInfo.token}`,
      }
    })

    if (!cancelRes.ok) {
      const errText = await cancelRes.text()
      console.error('Google Play API error on cancel:', errText)
      throw new Error('Failed to cancel subscription with Google Play')
    }

    return new Response(JSON.stringify({ success: true, message: 'Subscription cancelled successfully' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error('Cancel subscription error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
