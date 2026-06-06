import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

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

    // Helper to insert notifications into the db
    async function insertNotification(userId: string, title: string, body: string, type: string, actionUrl: string) {
      const { error } = await supabaseClient
        .from('notifications')
        .insert({
          user_id: userId,
          title,
          body,
          type,
          action_url: actionUrl
        })
      if (error) {
        console.error(`Error inserting notification for user ${userId}:`, error)
      } else {
        console.log(`Inserted notification of type "${type}" for user ${userId}`)
      }
    }

    // Fetch all user profiles with their associated settings where notifications are enabled
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('user_profiles')
      .select(`
        id,
        timezone,
        display_name,
        user_settings:id (
          notifications_enabled,
          notification_preferences,
          morning_reminder_time,
          night_reminder_time
        )
      `)

    if (profilesError) throw profilesError

    const activeProfiles = (profiles || []).filter(p => {
      // Handle the 1-to-1 array wrapper returned by Supabase select
      const settings = Array.isArray(p.user_settings) ? p.user_settings[0] : p.user_settings
      return settings?.notifications_enabled === true
    })

    console.log(`Processing notifications for ${activeProfiles.length} active users`)

    const nowUtc = new Date()

    for (const profile of activeProfiles) {
      const settings = Array.isArray(profile.user_settings) ? profile.user_settings[0] : profile.user_settings
      const timezone = profile.timezone || 'UTC'
      
      // Calculate local time for user timezone
      let formatter: Intl.DateTimeFormat
      try {
        formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: 'numeric',
          minute: 'numeric',
          hour12: false,
          weekday: 'long'
        })
      } catch (e) {
        console.warn(`Invalid timezone "${timezone}" for user ${profile.id}. Defaulting to UTC.`)
        formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'UTC',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: 'numeric',
          minute: 'numeric',
          hour12: false,
          weekday: 'long'
        })
      }

      const parts = formatter.formatToParts(nowUtc)
      const year = parts.find(p => p.type === 'year')?.value
      const month = parts.find(p => p.type === 'month')?.value
      const day = parts.find(p => p.type === 'day')?.value
      const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10)
      const weekday = parts.find(p => p.type === 'weekday')?.value // 'Sunday', 'Monday', etc.

      const localDateStr = `${year}-${month}-${day}` // YYYY-MM-DD
      
      // Retrieve reminder preferences
      const prefs = settings.notification_preferences || {}
      
      // Parse custom morning/evening reminder hours
      const morningHour = parseInt(settings.morning_reminder_time?.split(':')[0] || '8', 10)
      const eveningHour = parseInt(settings.night_reminder_time?.split(':')[0] || '21', 10)

      console.log(`User ${profile.id} (${profile.display_name}) local time: ${localDateStr} ${hour}:00, timezone: ${timezone}`)

      // Fetch today's record to check check-in statuses
      const { data: todayRecord } = await supabaseClient
        .from('daily_records')
        .select('morning_complete, evening_complete')
        .eq('user_id', profile.id)
        .eq('date', localDateStr)
        .maybeSingle()

      const morningComplete = todayRecord?.morning_complete === true
      const eveningComplete = todayRecord?.evening_complete === true

      // --- A. Morning Check-in (Local Morning Hour) ---
      if (prefs.morning_reminder !== false && hour === morningHour) {
        if (!morningComplete) {
          const morningCopies = [
            "Rise and shine! Ready to crush your goals today? ☀️",
            "Don''t let yesterday win. Tap to set your morning intent!",
            "Morning! Ready for a fresh start? Let''s check in."
          ]
          const body = morningCopies[Math.floor(Math.random() * morningCopies.length)]
          await insertNotification(profile.id, 'Good morning! ✦', body, 'morning_reminder', '/day?guided=morning')
        }
      }

      // --- B. Evening Review (Local Evening Hour) ---
      if (prefs.evening_reminder !== false && hour === eveningHour) {
        if (!eveningComplete) {
          const eveningCopies = [
            "Before you drift off, let''s lock in your wins. 🌙",
            "How did today go? Write down that win of the day!",
            "Just checking in. Let''s do your evening review before bed."
          ]
          const body = eveningCopies[Math.floor(Math.random() * eveningCopies.length)]
          await insertNotification(profile.id, 'Time to reflect', body, 'evening_reminder', '/day?guided=evening')
        }
      }

      // --- C. Tasks Due Today (7:00 AM Local) ---
      if (prefs.task_due_today !== false && hour === 7) {
        const { count, error: taskError } = await supabaseClient
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .eq('date', localDateStr)
          .eq('completed', false)
          .eq('skipped', false)

        if (!taskError && count && count > 0) {
          const taskDueCopies = [
            `You've got ${count} tasks today! No pressure, but they aren't going to complete themselves.`,
            `Today's checklist is waiting. Tap to see what's on the menu (count: ${count}). 📝`
          ]
          const body = taskDueCopies[Math.floor(Math.random() * taskDueCopies.length)]
          await insertNotification(profile.id, 'Tasks for today', body, 'task_due_today', '/tasks')
        }
      }

      // --- D. Task Overdue (9:00 AM Local) ---
      if (prefs.task_overdue !== false && hour === 9) {
        const { count, error: taskError } = await supabaseClient
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .lt('date', localDateStr)
          .eq('completed', false)
          .eq('skipped', false)

        if (!taskError && count && count > 0) {
          const overdueCopies = [
            `Uh oh, those ${count} tasks from yesterday are still hanging out. Let's tidy them up!`,
            `Remember me? Your ${count} overdue tasks do! Let's get back on track.`
          ]
          const body = overdueCopies[Math.floor(Math.random() * overdueCopies.length)]
          await insertNotification(profile.id, 'Overdue tasks', body, 'task_overdue', '/tasks')
        }
      }

      // --- E. Habit Streak at Risk (8:00 PM Local) ---
      if (prefs.streak_alert !== false && hour === 20) {
        const { data: habits } = await supabaseClient
          .from('goals')
          .select('id, name')
          .eq('user_id', profile.id)
          .eq('tracker_type', 'habit')
          .eq('state', 'active')
          .gt('habit_streak', 0)

        const uncheckedHabits: string[] = []
        if (habits && habits.length > 0) {
          for (const habit of habits) {
            const { data: log } = await supabaseClient
              .from('habit_logs')
              .select('id')
              .eq('goal_id', habit.id)
              .eq('date', localDateStr)
              .maybeSingle()
            if (!log) {
              uncheckedHabits.push(habit.name)
            }
          }
        }

        if (uncheckedHabits.length > 0) {
          const habitNames = uncheckedHabits.slice(0, 2).join(' and ')
          const habitStr = uncheckedHabits.length > 2 ? `${habitNames}, and others` : habitNames
          
          const streakCopies = [
            `Protect the streak! Keep the flame alive on your "${habitStr}" habit. 🔥`,
            `Don't let your "${habitStr}" streak go cold tonight!`
          ]
          const body = streakCopies[Math.floor(Math.random() * streakCopies.length)]
          await insertNotification(profile.id, 'Streak at risk!', body, 'streak_alert', '/goals')
        }
      }

      // --- F. Weekly Review (Sunday 7:00 PM Local) ---
      if (prefs.weekly_review !== false && hour === 19 && weekday === 'Sunday') {
        const weeklyCopies = [
          "It's Sunday! Time to look back at your week. Let's see how you did!",
          "Ready for your weekly wrap-up? Tap to review your progress. 📊"
        ]
        const body = weeklyCopies[Math.floor(Math.random() * weeklyCopies.length)]
        await insertNotification(profile.id, 'Weekly Review', body, 'weekly_review', '/day/history')
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error: any) {
    console.error("send-notifications error:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    })
  }
})
