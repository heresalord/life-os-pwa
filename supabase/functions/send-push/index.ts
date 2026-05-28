import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import webpush from "https://esm.sh/web-push@3.6.6"

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC") || ""
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE") || ""
const VAPID_SUBJECT = "mailto:admin@lifeos.app"

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)

serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: subs, error } = await supabaseClient.from('push_subscriptions').select('*')
    if (error) throw error

    const payload = JSON.stringify({
      title: "Life OS Reminder",
      body: "Time for your daily review.",
      url: "/"
    })

    const results = await Promise.all(subs.map(async (sub) => {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: sub.keys
        }
        await webpush.sendNotification(pushSubscription, payload)
        return { success: true }
      } catch (err: any) {
        console.error("Error sending to sub:", sub.id, err)
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabaseClient.from('push_subscriptions').delete().eq('id', sub.id)
        }
        return { success: false, error: err }
      }
    }))

    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    })
  }
})
