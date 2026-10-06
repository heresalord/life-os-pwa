import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

// ---------------------------------------------------------------------------
// Configuration — all secrets from Supabase Edge Function environment
// ---------------------------------------------------------------------------
const RESEND_API_KEY  = Deno.env.get("RESEND_API_KEY")  ?? ""
const FROM_EMAIL      = Deno.env.get("EMAIL_FROM")       ?? "kairo@volkastudio.com"
const FROM_NAME       = Deno.env.get("EMAIL_FROM_NAME")  ?? "Kairo"
const APP_URL         = Deno.env.get("APP_URL")          ?? "https://kairoapp.com"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface EmailRequest {
  to: string
  event_type: string
  variables: Record<string, string>
}

// ---------------------------------------------------------------------------
// Template engine
// Replaces {{key}} placeholders in strings
// ---------------------------------------------------------------------------
function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "")
}

// ---------------------------------------------------------------------------
// Email templates — one per C2 event type that has email enabled
// Plain text + HTML pair kept in the same file for easy review
// ---------------------------------------------------------------------------
const TEMPLATES: Record<string, { subject: string; html: string; text: string }> = {

  // Always-on ---------------------------------------------------------------

  "share.invited": {
    subject: "{{sender_name}} invited you to collaborate on Kairo",
    html: `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>New Invite</title>
<style>
  body{margin:0;padding:0;background:#0f0f12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e2e8}
  .wrap{max-width:520px;margin:40px auto;background:#1a1a22;border:1px solid #2a2a35;border-radius:16px;overflow:hidden}
  .header{padding:32px 32px 24px;background:linear-gradient(135deg,#1e1e2e,#252533)}
  .logo{font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#fff}
  .logo span{color:#7c6af7}
  .body{padding:28px 32px 32px}
  h1{margin:0 0 12px;font-size:20px;font-weight:600;color:#fff}
  p{margin:0 0 20px;font-size:15px;line-height:1.65;color:#9898b0}
  .btn{display:inline-block;padding:13px 28px;background:#7c6af7;color:#fff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600}
  .footer{padding:20px 32px;border-top:1px solid #2a2a35;font-size:12px;color:#55556a;text-align:center}
  .chip{display:inline-block;padding:3px 10px;background:#2a2a3a;border:1px solid #3a3a50;border-radius:6px;font-size:13px;color:#b0b0cc;margin-bottom:20px}
</style></head><body>
<div class="wrap">
  <div class="header"><div class="logo">K<span>·</span>airo</div></div>
  <div class="body">
    <div class="chip">{{item_type}}</div>
    <h1>You've been invited to collaborate 📬</h1>
    <p><strong style="color:#e2e2e8">{{sender_name}}</strong> invited you to collaborate on a <strong style="color:#e2e2e8">{{item_type}}</strong>.</p>
    <p>Tap below to view and accept the invitation inside Kairo.</p>
    <a href="{{action_url}}" class="btn">View Invitation →</a>
  </div>
  <div class="footer">
    You received this because someone shared a resource with your account.<br>
    Manage preferences at <a href="{{app_url}}/settings" style="color:#7c6af7">Settings → Notifications</a>
  </div>
</div>
</body></html>`,
    text: `{{sender_name}} invited you to collaborate on a {{item_type}} in Kairo.\n\nView and accept the invitation: {{action_url}}\n\nManage your notification preferences at {{app_url}}/settings`
  },

  "friend.request_received": {
    subject: "{{sender_name}} wants to connect with you on Kairo",
    html: `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Friend Request</title>
<style>
  body{margin:0;padding:0;background:#0f0f12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e2e8}
  .wrap{max-width:520px;margin:40px auto;background:#1a1a22;border:1px solid #2a2a35;border-radius:16px;overflow:hidden}
  .header{padding:32px 32px 24px;background:linear-gradient(135deg,#1e1e2e,#252533)}
  .logo{font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#fff}
  .logo span{color:#7c6af7}
  .body{padding:28px 32px 32px}
  h1{margin:0 0 12px;font-size:20px;font-weight:600;color:#fff}
  p{margin:0 0 20px;font-size:15px;line-height:1.65;color:#9898b0}
  .btn{display:inline-block;padding:13px 28px;background:#7c6af7;color:#fff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600}
  .footer{padding:20px 32px;border-top:1px solid #2a2a35;font-size:12px;color:#55556a;text-align:center}
  .avatar{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#7c6af7,#a78bfa);display:flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:20px}
</style></head><body>
<div class="wrap">
  <div class="header"><div class="logo">K<span>·</span>airo</div></div>
  <div class="body">
    <div class="avatar">👤</div>
    <h1>New friend request 🤝</h1>
    <p><strong style="color:#e2e2e8">{{sender_name}}</strong> sent you a friend request on Kairo. Accept to connect and share resources with each other.</p>
    <a href="{{action_url}}" class="btn">View Request →</a>
  </div>
  <div class="footer">
    You received this because this account matched a friend request.<br>
    Manage preferences at <a href="{{app_url}}/settings" style="color:#7c6af7">Settings → Notifications</a>
  </div>
</div>
</body></html>`,
    text: `{{sender_name}} sent you a friend request on Kairo.\n\nAccept the request: {{action_url}}\n\nManage your notification preferences at {{app_url}}/settings`
  },

  "finance.budget_warning": {
    subject: "Budget warning — you've used {{percent}}% of your daily budget",
    html: `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Budget Warning</title>
<style>
  body{margin:0;padding:0;background:#0f0f12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e2e8}
  .wrap{max-width:520px;margin:40px auto;background:#1a1a22;border:1px solid #2a2a35;border-radius:16px;overflow:hidden}
  .header{padding:32px 32px 24px;background:linear-gradient(135deg,#1e1e2e,#252533)}
  .logo{font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#fff}
  .logo span{color:#7c6af7}
  .body{padding:28px 32px 32px}
  h1{margin:0 0 12px;font-size:20px;font-weight:600;color:#fff}
  p{margin:0 0 20px;font-size:15px;line-height:1.65;color:#9898b0}
  .btn{display:inline-block;padding:13px 28px;background:#ef4444;color:#fff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600}
  .footer{padding:20px 32px;border-top:1px solid #2a2a35;font-size:12px;color:#55556a;text-align:center}
  .stat-box{background:#2a1a1a;border:1px solid #4a2020;border-radius:10px;padding:16px 20px;margin-bottom:24px}
  .stat-label{font-size:12px;color:#9898b0;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px}
  .stat-value{font-size:28px;font-weight:700;color:#ef4444}
  .stat-sub{font-size:13px;color:#7070a0;margin-top:2px}
  .warning-bar{height:8px;background:#2a2a35;border-radius:4px;overflow:hidden;margin-bottom:24px}
  .warning-fill{height:100%;background:linear-gradient(90deg,#f59e0b,#ef4444);border-radius:4px;width:{{percent}}%}
</style></head><body>
<div class="wrap">
  <div class="header"><div class="logo">K<span>·</span>airo</div></div>
  <div class="body">
    <h1>Budget warning ⚠️</h1>
    <div class="stat-box">
      <div class="stat-label">Daily budget used</div>
      <div class="stat-value">{{percent}}%</div>
      <div class="stat-sub">{{current_spend}} of {{daily_budget}} spent today</div>
    </div>
    <div class="warning-bar"><div class="warning-fill"></div></div>
    <p>You've used <strong style="color:#ef4444">{{percent}}%</strong> of your daily budget. Consider reviewing your spending before the day is out.</p>
    <a href="{{action_url}}" class="btn">View Finance →</a>
  </div>
  <div class="footer">
    You received this because budget alerts are enabled for this account.<br>
    Manage preferences at <a href="{{app_url}}/settings" style="color:#7c6af7">Settings → Notifications</a>
  </div>
</div>
</body></html>`,
    text: `Budget warning: You've used {{percent}}% of your daily budget today ({{current_spend}} of {{daily_budget}}).\n\nView your finance dashboard: {{action_url}}\n\nManage your notification preferences at {{app_url}}/settings`
  },

  // Opt-in ------------------------------------------------------------------

  "project.member_joined": {
    subject: "{{member_name}} joined \"{{project_name}}\" on Kairo",
    html: `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Member Joined</title>
<style>
  body{margin:0;padding:0;background:#0f0f12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e2e8}
  .wrap{max-width:520px;margin:40px auto;background:#1a1a22;border:1px solid #2a2a35;border-radius:16px;overflow:hidden}
  .header{padding:32px 32px 24px;background:linear-gradient(135deg,#1e1e2e,#252533)}
  .logo{font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#fff}
  .logo span{color:#7c6af7}
  .body{padding:28px 32px 32px}
  h1{margin:0 0 12px;font-size:20px;font-weight:600;color:#fff}
  p{margin:0 0 20px;font-size:15px;line-height:1.65;color:#9898b0}
  .btn{display:inline-block;padding:13px 28px;background:#7c6af7;color:#fff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600}
  .footer{padding:20px 32px;border-top:1px solid #2a2a35;font-size:12px;color:#55556a;text-align:center}
</style></head><body>
<div class="wrap">
  <div class="header"><div class="logo">K<span>·</span>airo</div></div>
  <div class="body">
    <h1>New project member 👋</h1>
    <p><strong style="color:#e2e2e8">{{member_name}}</strong> accepted your invite and joined <strong style="color:#e2e2e8">"{{project_name}}"</strong>.</p>
    <a href="{{action_url}}" class="btn">View Project →</a>
  </div>
  <div class="footer">
    Manage preferences at <a href="{{app_url}}/settings" style="color:#7c6af7">Settings → Notifications</a>
  </div>
</div>
</body></html>`,
    text: `{{member_name}} joined your project "{{project_name}}" on Kairo.\n\nView the project: {{action_url}}`
  },

  "friend.request_accepted": {
    subject: "{{friend_name}} accepted your friend request on Kairo",
    html: `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Friend Request Accepted</title>
<style>
  body{margin:0;padding:0;background:#0f0f12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e2e8}
  .wrap{max-width:520px;margin:40px auto;background:#1a1a22;border:1px solid #2a2a35;border-radius:16px;overflow:hidden}
  .header{padding:32px 32px 24px;background:linear-gradient(135deg,#1e1e2e,#252533)}
  .logo{font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#fff}
  .logo span{color:#7c6af7}
  .body{padding:28px 32px 32px}
  h1{margin:0 0 12px;font-size:20px;font-weight:600;color:#fff}
  p{margin:0 0 20px;font-size:15px;line-height:1.65;color:#9898b0}
  .btn{display:inline-block;padding:13px 28px;background:#22c55e;color:#fff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600}
  .footer{padding:20px 32px;border-top:1px solid #2a2a35;font-size:12px;color:#55556a;text-align:center}
</style></head><body>
<div class="wrap">
  <div class="header"><div class="logo">K<span>·</span>airo</div></div>
  <div class="body">
    <h1>You're now connected! 🎉</h1>
    <p><strong style="color:#e2e2e8">{{friend_name}}</strong> accepted your friend request. You can now share resources with each other.</p>
    <a href="{{action_url}}" class="btn">View Profile →</a>
  </div>
  <div class="footer">
    Manage preferences at <a href="{{app_url}}/settings" style="color:#7c6af7">Settings → Notifications</a>
  </div>
</div>
</body></html>`,
    text: `{{friend_name}} accepted your friend request on Kairo. You can now share resources with each other.\n\nView their profile: {{action_url}}`
  },

  "note.shared": {
    subject: "{{sender_name}} shared a note with you on Kairo",
    html: `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Note Shared</title>
<style>
  body{margin:0;padding:0;background:#0f0f12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e2e8}
  .wrap{max-width:520px;margin:40px auto;background:#1a1a22;border:1px solid #2a2a35;border-radius:16px;overflow:hidden}
  .header{padding:32px 32px 24px;background:linear-gradient(135deg,#1e1e2e,#252533)}
  .logo{font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#fff}
  .logo span{color:#7c6af7}
  .body{padding:28px 32px 32px}
  h1{margin:0 0 12px;font-size:20px;font-weight:600;color:#fff}
  p{margin:0 0 20px;font-size:15px;line-height:1.65;color:#9898b0}
  .btn{display:inline-block;padding:13px 28px;background:#f59e0b;color:#fff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600}
  .footer{padding:20px 32px;border-top:1px solid #2a2a35;font-size:12px;color:#55556a;text-align:center}
</style></head><body>
<div class="wrap">
  <div class="header"><div class="logo">K<span>·</span>airo</div></div>
  <div class="body">
    <h1>A note was shared with you 📝</h1>
    <p><strong style="color:#e2e2e8">{{sender_name}}</strong> shared a note with you on Kairo.</p>
    <a href="{{action_url}}" class="btn">Open Note →</a>
  </div>
  <div class="footer">
    Manage preferences at <a href="{{app_url}}/settings" style="color:#7c6af7">Settings → Notifications</a>
  </div>
</div>
</body></html>`,
    text: `{{sender_name}} shared a note with you on Kairo.\n\nOpen the note: {{action_url}}`
  },

  "book.recommended": {
    subject: "{{sender_name}} recommended a book to you on Kairo",
    html: `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Book Recommended</title>
<style>
  body{margin:0;padding:0;background:#0f0f12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e2e8}
  .wrap{max-width:520px;margin:40px auto;background:#1a1a22;border:1px solid #2a2a35;border-radius:16px;overflow:hidden}
  .header{padding:32px 32px 24px;background:linear-gradient(135deg,#1e1e2e,#252533)}
  .logo{font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#fff}
  .logo span{color:#7c6af7}
  .body{padding:28px 32px 32px}
  h1{margin:0 0 12px;font-size:20px;font-weight:600;color:#fff}
  p{margin:0 0 20px;font-size:15px;line-height:1.65;color:#9898b0}
  .btn{display:inline-block;padding:13px 28px;background:#8b5cf6;color:#fff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600}
  .footer{padding:20px 32px;border-top:1px solid #2a2a35;font-size:12px;color:#55556a;text-align:center}
</style></head><body>
<div class="wrap">
  <div class="header"><div class="logo">K<span>·</span>airo</div></div>
  <div class="body">
    <h1>Book recommendation 📚</h1>
    <p><strong style="color:#e2e2e8">{{sender_name}}</strong> recommended <strong style="color:#e2e2e8">"{{book_title}}"</strong> to you.</p>
    <a href="{{action_url}}" class="btn">View Recommendation →</a>
  </div>
  <div class="footer">
    Manage preferences at <a href="{{app_url}}/settings" style="color:#7c6af7">Settings → Notifications</a>
  </div>
</div>
</body></html>`,
    text: `{{sender_name}} recommended "{{book_title}}" to you on Kairo.\n\nView the recommendation: {{action_url}}`
  },

  "task.reminder": {
    subject: "Task reminder from Kairo",
    html: `
<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Task Reminder</title>
<style>
  body{margin:0;padding:0;background:#0f0f12;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e2e2e8}
  .wrap{max-width:520px;margin:40px auto;background:#1a1a22;border:1px solid #2a2a35;border-radius:16px;overflow:hidden}
  .header{padding:32px 32px 24px;background:linear-gradient(135deg,#1e1e2e,#252533)}
  .logo{font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#fff}
  .logo span{color:#7c6af7}
  .body{padding:28px 32px 32px}
  h1{margin:0 0 12px;font-size:20px;font-weight:600;color:#fff}
  p{margin:0 0 20px;font-size:15px;line-height:1.65;color:#9898b0}
  .btn{display:inline-block;padding:13px 28px;background:#7c6af7;color:#fff;text-decoration:none;border-radius:10px;font-size:15px;font-weight:600}
  .footer{padding:20px 32px;border-top:1px solid #2a2a35;font-size:12px;color:#55556a;text-align:center}
</style></head><body>
<div class="wrap">
  <div class="header"><div class="logo">K<span>·</span>airo</div></div>
  <div class="body">
    <h1>{{title}} ⏰</h1>
    <p>{{body}}</p>
    <a href="{{action_url}}" class="btn">View Tasks →</a>
  </div>
  <div class="footer">
    Manage preferences at <a href="{{app_url}}/settings" style="color:#7c6af7">Settings → Notifications</a>
  </div>
</div>
</body></html>`,
    text: `{{title}}\n\n{{body}}\n\nView your tasks: {{action_url}}`
  }
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    })
  }

  // Verify the request is from within Supabase (service role or DB webhook)
  const authHeader = req.headers.get("Authorization")?.trim()
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? ""
  if (!authHeader || (serviceKey && authHeader !== `Bearer ${serviceKey}`)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500 })
  }

  let payload: EmailRequest
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 })
  }

  const { to, event_type, variables } = payload

  if (!to || !event_type) {
    return new Response(JSON.stringify({ error: "Missing required fields: to, event_type" }), { status: 400 })
  }

  const template = TEMPLATES[event_type]
  if (!template) {
    return new Response(
      JSON.stringify({ error: `No template found for event_type: ${event_type}` }),
      { status: 400 }
    )
  }

  // Inject global variables
  const vars = {
    app_url: APP_URL,
    action_url: variables.action_url ? `${APP_URL}${variables.action_url}` : APP_URL,
    ...variables,
  }

  const subject  = render(template.subject, vars)
  const html     = render(template.html, vars)
  const text     = render(template.text, vars)

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [to],
        subject,
        html,
        text,
        tags: [{ name: "event_type", value: event_type }],
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.error("[send-email] Resend API error:", data)
      return new Response(JSON.stringify({ ok: false, error: data }), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      })
    }

    console.log(`[send-email] Sent "${event_type}" to ${to} → id: ${data.id}`)
    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (err: any) {
    console.error("[send-email] Fetch error:", err)
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
})
