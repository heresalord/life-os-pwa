import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import webpush from "https://esm.sh/web-push@3.6.6"

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC") || ""
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE") || ""
const VAPID_SUBJECT = "mailto:admin@lifeos.app"

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

// Helper: Base64url encode a buffer (for JWT signature)
function base64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// Helper: Retrieve OAuth2 access token from Google API for FCM v1 calls using pure WebCrypto
async function getFcmAccessToken(serviceAccount: any): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = base64url(new TextEncoder().encode(JSON.stringify(header)));
  const encodedPayload = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  const stringToSign = `${encodedHeader}.${encodedPayload}`;

  const pem = serviceAccount.private_key;
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(stringToSign)
  );

  const jwt = `${stringToSign}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Failed to get OAuth token: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

// Helper: Send message to FCM v1 endpoint
async function sendFcmNotification(
  accessToken: string,
  projectId: string,
  token: string,
  title: string,
  body: string,
  url: string
) {
  const message = {
    message: {
      token: token,
      notification: {
        title: title,
        body: body
      },
      data: {
        url: url
      },
      android: {
        notification: {
          sound: "default"
        }
      }
    }
  };

  return await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(message)
  });
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let body = {}
    try {
      body = await req.json()
    } catch(e) {}
    
    // Supports record inserts from Database Webhook or explicit JSON triggers
    const payloadData = (body as any).record || body
    const { user_id, user_ids, title, body: messageText, message, action_url, url } = payloadData as any
    
    const actualTitle = title || "Life OS"
    const actualBody = messageText || message || "You have a new update."
    const actualUrl = action_url || url || "/"
    
    const targetUsers = user_ids || (user_id ? [user_id] : null)
    if (!targetUsers || targetUsers.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: "No target users provided." }), { status: 200 })
    }

    // --- 1. WEB PUSH (VAPID) DELIVERY ---
    let webPushResults: any[] = []
    if (VAPID_PUBLIC && VAPID_PRIVATE) {
      const { data: subs, error: subError } = await supabaseClient
        .from('push_subscriptions')
        .select('*')
        .in('user_id', targetUsers)

      if (subError) throw subError

      if (subs && subs.length > 0) {
        const payload = JSON.stringify({
          title: actualTitle,
          body: actualBody,
          action_url: actualUrl
        })

        webPushResults = await Promise.all(subs.map(async (sub) => {
          try {
            const pushSubscription = {
              endpoint: sub.endpoint,
              keys: sub.keys
            }
            await webpush.sendNotification(pushSubscription, payload)
            return { type: 'webpush', token: sub.endpoint, success: true }
          } catch (err: any) {
            console.error("Error sending Web Push to sub:", sub.id, err)
            // 410 Gone / 404 Not Found -> Subscription has expired/unsubscribed
            if (err.statusCode === 410 || err.statusCode === 404) {
              await supabaseClient.from('push_subscriptions').delete().eq('id', sub.id)
            }
            return { type: 'webpush', token: sub.endpoint, success: false, error: err.message }
          }
        }))
      }
    }

    // --- 2. ANDROID APK (FCM) DELIVERY ---
    let fcmResults: any[] = []
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT")
    
    if (serviceAccountJson) {
      const { data: fcmTokens, error: tokenError } = await supabaseClient
        .from('fcm_tokens')
        .select('*')
        .in('user_id', targetUsers)

      if (tokenError) throw tokenError

      if (fcmTokens && fcmTokens.length > 0) {
        try {
          const serviceAccount = JSON.parse(serviceAccountJson)
          const projectId = serviceAccount.project_id
          const accessToken = await getFcmAccessToken(serviceAccount)

          fcmResults = await Promise.all(fcmTokens.map(async (tok) => {
            try {
              const res = await sendFcmNotification(
                accessToken,
                projectId,
                tok.token,
                actualTitle,
                actualBody,
                actualUrl
              )

              if (!res.ok) {
                const errData = await res.json()
                console.error(`FCM send failed for token ${tok.id}:`, errData)
                // If token is invalid or inactive (404/410), clean it up
                if (res.status === 404 || res.status === 410 || errData.error?.status === 'UNREGISTERED') {
                  await supabaseClient.from('fcm_tokens').delete().eq('id', tok.id)
                }
                return { type: 'fcm', token: tok.token, success: false, error: errData }
              }

              return { type: 'fcm', token: tok.token, success: true }
            } catch (err: any) {
              console.error("FCM dispatch exception:", err)
              return { type: 'fcm', token: tok.token, success: false, error: err.message }
            }
          }))
        } catch (authErr: any) {
          console.error("Firebase auth/parsing failed:", authErr)
          fcmResults = [{ type: 'fcm', success: false, error: `FCM Auth Failed: ${authErr.message}` }]
        }
      }
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      results: [...webPushResults, ...fcmResults] 
    }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error: any) {
    console.error("send-push error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    })
  }
})
