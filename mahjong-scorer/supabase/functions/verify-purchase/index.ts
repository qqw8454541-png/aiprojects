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

    const body = await req.json()
    const { purchaseToken, productId, packageName } = body

    if (!purchaseToken || !productId || !packageName) {
      throw new Error('Missing required parameters')
    }

    // Google Play Service Account JSON should be stored in GOOGLE_SERVICE_ACCOUNT_JSON
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

    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`
    
    const verifyRes = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenInfo.token}`,
      }
    })

    if (!verifyRes.ok) {
      const errText = await verifyRes.text()
      console.error('Google Play API error:', errText)
      throw new Error('Failed to verify purchase with Google Play')
    }

    const purchaseData = await verifyRes.json()
    console.log('Purchase data:', purchaseData)

    // A valid subscription has paymentState > 0 or autoRenewing = true, or expiryTimeMillis in the future
    // For simplicity, if Google returns 200 OK and it hasn't expired, we accept it.
    const expiryTimeMillis = parseInt(purchaseData.expiryTimeMillis, 10)
    if (Date.now() > expiryTimeMillis) {
      throw new Error('Subscription has expired')
    }

    // Purchase is valid! Now update the user's profile using the service_role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        tier: 'pro',
        pro_since: new Date().toISOString(),
        subscription_platform: 'android',
        subscription_product_id: productId,
        subscription_purchase_token: purchaseToken,
        subscription_expires_at: new Date(expiryTimeMillis).toISOString()
      })
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Profile update error:', updateError)
      throw new Error('Failed to update user profile')
    }

    return new Response(JSON.stringify({ success: true, purchaseData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error('Verify purchase error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
