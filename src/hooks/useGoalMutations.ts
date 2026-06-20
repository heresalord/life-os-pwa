import { useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from '../db'
import { enqueueSync } from '../db/syncQueue'
import { useAuth } from './useAuth'
import { subDays, format } from 'date-fns'

type AnyItem = { id: string; [key: string]: unknown }

async function write(table: string, op: 'insert' | 'update' | 'delete', payload: Record<string, unknown>) {
  await enqueueSync(table, op, payload)
}

function calculateStreak(
  logs: { date: string; value: number }[],
  schedule: any,
  todayStr: string = format(new Date(), 'yyyy-MM-dd')
) {
  const checkedDates = new Set(
    logs.filter(l => l.value === 1).map(l => l.date)
  )
  
  if (checkedDates.size === 0) {
    return { streak: 0, lastCheckin: null }
  }

  let freq = 'daily'
  let days: number[] = []
  if (schedule && typeof schedule === 'object') {
    freq = schedule.frequency || 'daily'
    days = Array.isArray(schedule.days) ? schedule.days : []
  }

  // Parse todayStr safely to avoid timezone shifts
  const parseDate = (dStr: string) => new Date(dStr + 'T12:00:00')
  const baseToday = parseDate(todayStr)
  const yesterdayStr = format(subDays(baseToday, 1), 'yyyy-MM-dd')

  let streak = 0
  let lastCheckin: string | null = null

  const isScheduled = (d: Date) => {
    if (freq === 'weekly') {
      if (days.length === 0) return true
      return days.includes(d.getDay())
    }
    if (days.length === 0) return true
    return days.includes(d.getDay())
  }

  const todayChecked = checkedDates.has(todayStr)

  if (todayChecked) {
    streak = 1
    lastCheckin = todayStr
  }

  let curr = subDays(baseToday, 1)

  for (let i = 0; i < 365; i++) {
    const currStr = format(curr, 'yyyy-MM-dd')
    const scheduled = isScheduled(curr)

    if (scheduled) {
      if (checkedDates.has(currStr)) {
        if (!lastCheckin) lastCheckin = currStr
        streak++
      } else {
        if (currStr === yesterdayStr && todayChecked) {
          break
        }
        if (currStr === yesterdayStr && !todayChecked) {
          break
        }
        break
      }
    }
    curr = subDays(curr, 1)
  }

  if (streak === 0 && checkedDates.has(yesterdayStr)) {
    let tempStreak = 0
    let tempCurr = subDays(baseToday, 1)
    for (let i = 0; i < 365; i++) {
      const currStr = format(tempCurr, 'yyyy-MM-dd')
      const scheduled = isScheduled(tempCurr)
      if (scheduled) {
        if (checkedDates.has(currStr)) {
          if (!lastCheckin) lastCheckin = currStr
          tempStreak++
        } else {
          break
        }
      }
      tempCurr = subDays(tempCurr, 1)
    }
    streak = tempStreak
  }

  return { streak, lastCheckin }
}

export function useGoalMutations() {
  const { user } = useAuth()
  const qc = useQueryClient()

  const invalidateGoals  = () => qc.invalidateQueries({ queryKey: ['goals'] })
  const invalidateEvents = () => qc.invalidateQueries({ queryKey: ['goal_events'] })
  const invalidateHabitLogs = () => qc.invalidateQueries({ queryKey: ['habit_logs'] })
  const invalidateMilestones = () => qc.invalidateQueries({ queryKey: ['milestones'] })
  const activeKey = ['goals', 'active', user?.id]

  const addGoal = useMutation({
    mutationFn: async (payload: {
      name: string
      target: number
      goal_type?: 'year' | 'general' | 'binary'
      measurement_type?: 'count' | 'currency' | 'time' | 'percentage' | 'binary'
      start_date?: string
      end_date?: string
      tracker_type?: 'target' | 'habit' | 'average' | 'project'
      category?: string
      habit_schedule?: { frequency: 'daily' | 'weekly'; days: number[] }
      project_id?: string | null
    }) => {
      if (!user) return
      const goal = {
        id: crypto.randomUUID(),
        user_id: user.id,
        name: payload.name,
        target: payload.target,
        goal_type: payload.goal_type ?? 'general',
        measurement_type: payload.measurement_type ?? 'count',
        start_date: payload.start_date ?? null,
        end_date: payload.end_date ?? null,
        state: 'active',
        is_completed: false,
        sub_goals: [],
        currency: null,
        tracker_type: payload.tracker_type ?? 'target',
        category: payload.category ?? null,
        habit_schedule: payload.habit_schedule ?? { frequency: 'daily', days: [] },
        habit_streak: 0,
        last_checkin: null,
        project_id: payload.project_id ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      await db.goals.add(goal as Parameters<typeof db.goals.add>[0])
      await write('goals', 'insert', goal)
      return goal
    },
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: activeKey })
      const previous = qc.getQueryData<AnyItem[]>(activeKey)
      const optimistic: AnyItem = {
        id: `opt-${Date.now()}`,
        user_id: user?.id,
        name: payload.name,
        target: payload.target,
        goal_type: payload.goal_type ?? 'general',
        measurement_type: payload.measurement_type ?? 'count',
        start_date: payload.start_date ?? null,
        end_date: payload.end_date ?? null,
        state: 'active',
        is_completed: false,
        sub_goals: [],
        currency: null,
        tracker_type: payload.tracker_type ?? 'target',
        category: payload.category ?? null,
        habit_schedule: payload.habit_schedule ?? { frequency: 'daily', days: [] },
        habit_streak: 0,
        last_checkin: null,
        project_id: payload.project_id ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      qc.setQueryData<AnyItem[]>(activeKey, old => [optimistic, ...(old ?? [])])
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(activeKey, ctx.previous)
    },
    onSettled: () => invalidateGoals(),
  })

  const updateGoal = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const withTs = { ...updates, updated_at: new Date().toISOString() }
      await db.goals.update(id, withTs)
      const updated = await db.goals.get(id)
      if (updated) await write('goals', 'update', updated as Record<string, unknown>)
      // Invalidate detail query for this goal as well
      qc.invalidateQueries({ queryKey: ['goal', id] })
    },
    onMutate: async ({ id, updates }) => {
      await qc.cancelQueries({ queryKey: activeKey })
      const previous = qc.getQueryData<AnyItem[]>(activeKey)
      qc.setQueryData<AnyItem[]>(activeKey, old =>
        (old ?? []).map(g => g.id === id ? { ...g, ...updates, updated_at: new Date().toISOString() } : g)
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(activeKey, ctx.previous)
    },
    onSettled: () => invalidateGoals(),
  })

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      await db.goals.delete(id)
      await write('goals', 'delete', { id })
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: activeKey })
      const previous = qc.getQueryData<AnyItem[]>(activeKey)
      qc.setQueryData<AnyItem[]>(activeKey, old => (old ?? []).filter(g => g.id !== id))
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) qc.setQueryData(activeKey, ctx.previous)
    },
    onSettled: () => invalidateGoals(),
  })

  const addEvent = useMutation({
    mutationFn: async (payload: {
      goal_id: string
      date: string
      value: number
      event_type?: 'add' | 'subtract'
      note?: string
    }) => {
      if (!user) return
      const now = new Date().toISOString()
      const event = {
        id: crypto.randomUUID(),
        user_id: user.id,
        goal_id: payload.goal_id,
        sub_goal_id: null,
        date: payload.date,
        value: payload.value,
        event_type: payload.event_type ?? 'add',
        note: payload.note ?? null,
        new_state: null,
        old_target: null,
        new_target: null,
        created_at: now,
      }
      await db.goal_events.add(event as Parameters<typeof db.goal_events.add>[0])
      await write('goal_events', 'insert', event)
      const tsUpdate = { updated_at: now }
      await db.goals.update(payload.goal_id, tsUpdate)
      const updatedGoal = await db.goals.get(payload.goal_id)
      if (updatedGoal) await write('goals', 'update', updatedGoal as Record<string, unknown>)
      return event
    },
    onSettled: () => {
      invalidateEvents()
      invalidateGoals()
      qc.invalidateQueries({ queryKey: ['goal', activeKey[1]] })
    },
  })

  const addHabitLog = useMutation({
    mutationFn: async (payload: {
      goal_id: string
      date: string
      value: number
      note?: string
    }) => {
      if (!user) return
      const log = {
        id: crypto.randomUUID(),
        user_id: user.id,
        goal_id: payload.goal_id,
        date: payload.date,
        value: payload.value,
        note: payload.note ?? null,
        created_at: new Date().toISOString()
      }
      await db.habit_logs.put(log)
      await write('habit_logs', 'insert', log)

      // Recalculate streak
      const logs = await db.habit_logs.where('goal_id').equals(payload.goal_id).toArray()
      const goal = await db.goals.get(payload.goal_id)
      if (goal) {
        const { streak, lastCheckin } = calculateStreak(logs, goal.habit_schedule, payload.date)
        const updates = {
          habit_streak: streak,
          last_checkin: lastCheckin,
          updated_at: new Date().toISOString()
        }
        await db.goals.update(payload.goal_id, updates)
        const updatedGoal = await db.goals.get(payload.goal_id)
        if (updatedGoal) await write('goals', 'update', updatedGoal as Record<string, unknown>)
      }
      return log
    },
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: activeKey })
      await qc.cancelQueries({ queryKey: ['habit_logs'] })

      const prevGoals = qc.getQueryData<AnyItem[]>(activeKey)
      const prevLogs = qc.getQueryData<AnyItem[]>(['habit_logs'])

      // Optimistic Log
      const optLog = {
        id: `opt-${Date.now()}`,
        user_id: user?.id,
        goal_id: payload.goal_id,
        date: payload.date,
        value: payload.value,
        note: payload.note ?? null,
        created_at: new Date().toISOString()
      }

      // Optimistic Logs list
      const nextLogs = prevLogs ? [...prevLogs.filter(l => !(l.goal_id === payload.goal_id && l.date === payload.date)), optLog] : [optLog]
      qc.setQueryData(['habit_logs'], nextLogs)

      // Optimistic Goals list (recalculate streak)
      if (prevGoals) {
        const nextGoals = prevGoals.map(g => {
          if (g.id !== payload.goal_id) return g
          
          const goalLogs = nextLogs.filter(l => l.goal_id === g.id)
          const { streak, lastCheckin } = calculateStreak(goalLogs as any, g.habit_schedule, payload.date)
          
          return {
            ...g,
            habit_streak: streak,
            last_checkin: lastCheckin,
            updated_at: new Date().toISOString()
          }
        })
        qc.setQueryData(activeKey, nextGoals)
      }

      return { prevGoals, prevLogs }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevGoals !== undefined) qc.setQueryData(activeKey, ctx.prevGoals)
      if (ctx?.prevLogs !== undefined) qc.setQueryData(['habit_logs'], ctx.prevLogs)
    },
    onSettled: () => {
      invalidateGoals()
      invalidateHabitLogs()
      qc.invalidateQueries({ queryKey: ['goal'] })
    }
  })

  const deleteHabitLog = useMutation({
    mutationFn: async (payload: {
      goal_id: string
      date: string
    }) => {
      if (!user) return
      const log = await db.habit_logs.where({ goal_id: payload.goal_id, date: payload.date }).first()
      if (log) {
        await db.habit_logs.delete(log.id)
        await write('habit_logs', 'delete', log as Record<string, unknown>)
      }

      const logs = await db.habit_logs.where('goal_id').equals(payload.goal_id).toArray()
      const goal = await db.goals.get(payload.goal_id)
      if (goal) {
        const { streak, lastCheckin } = calculateStreak(logs, goal.habit_schedule, payload.date)
        const updates = {
          habit_streak: streak,
          last_checkin: lastCheckin,
          updated_at: new Date().toISOString()
        }
        await db.goals.update(payload.goal_id, updates)
        const updatedGoal = await db.goals.get(payload.goal_id)
        if (updatedGoal) await write('goals', 'update', updatedGoal as Record<string, unknown>)
      }
    },
    onMutate: async (payload) => {
      await qc.cancelQueries({ queryKey: activeKey })
      await qc.cancelQueries({ queryKey: ['habit_logs'] })

      const prevGoals = qc.getQueryData<AnyItem[]>(activeKey)
      const prevLogs = qc.getQueryData<AnyItem[]>(['habit_logs'])

      // Optimistic Logs list
      const nextLogs = prevLogs ? prevLogs.filter(l => !(l.goal_id === payload.goal_id && l.date === payload.date)) : []
      qc.setQueryData(['habit_logs'], nextLogs)

      // Optimistic Goals list (recalculate streak)
      if (prevGoals) {
        const nextGoals = prevGoals.map(g => {
          if (g.id !== payload.goal_id) return g
          
          const goalLogs = nextLogs.filter(l => l.goal_id === g.id)
          const { streak, lastCheckin } = calculateStreak(goalLogs as any, g.habit_schedule, payload.date)
          
          return {
            ...g,
            habit_streak: streak,
            last_checkin: lastCheckin,
            updated_at: new Date().toISOString()
          }
        })
        qc.setQueryData(activeKey, nextGoals)
      }

      return { prevGoals, prevLogs }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prevGoals !== undefined) qc.setQueryData(activeKey, ctx.prevGoals)
      if (ctx?.prevLogs !== undefined) qc.setQueryData(['habit_logs'], ctx.prevLogs)
    },
    onSettled: () => {
      invalidateGoals()
      invalidateHabitLogs()
      qc.invalidateQueries({ queryKey: ['goal'] })
    }
  })

  const addMilestone = useMutation({
    mutationFn: async (payload: {
      goal_id: string
      title: string
      due_date?: string
    }) => {
      if (!user) return
      const milestone = {
        id: crypto.randomUUID(),
        user_id: user.id,
        goal_id: payload.goal_id,
        title: payload.title,
        completed: false,
        due_date: payload.due_date ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      await db.milestones.put(milestone)
      await write('milestones', 'insert', milestone)
      return milestone
    },
    onSettled: () => {
      invalidateMilestones()
      qc.invalidateQueries({ queryKey: ['goal'] })
    }
  })

  const toggleMilestone = useMutation({
    mutationFn: async (payload: {
      id: string
      completed: boolean
    }) => {
      if (!user) return
      const now = new Date().toISOString()
      await db.milestones.update(payload.id, { completed: payload.completed, updated_at: now })
      const updated = await db.milestones.get(payload.id)
      if (updated) {
        await write('milestones', 'update', updated as Record<string, unknown>)
        await db.goals.update(updated.goal_id, { updated_at: now })
        const updatedGoal = await db.goals.get(updated.goal_id)
        if (updatedGoal) await write('goals', 'update', updatedGoal as Record<string, unknown>)
      }
    },
    onSettled: () => {
      invalidateMilestones()
      invalidateGoals()
      qc.invalidateQueries({ queryKey: ['goal'] })
    }
  })

  const deleteMilestone = useMutation({
    mutationFn: async (id: string) => {
      const milestone = await db.milestones.get(id)
      if (milestone) {
        await db.milestones.delete(id)
        await write('milestones', 'delete', { id })
        await db.goals.update(milestone.goal_id, { updated_at: new Date().toISOString() })
        const updatedGoal = await db.goals.get(milestone.goal_id)
        if (updatedGoal) await write('goals', 'update', updatedGoal as Record<string, unknown>)
      }
    },
    onSettled: () => {
      invalidateMilestones()
      invalidateGoals()
      qc.invalidateQueries({ queryKey: ['goal'] })
    }
  })

  return {
    addGoal,
    updateGoal,
    deleteGoal,
    addEvent,
    addHabitLog,
    deleteHabitLog,
    addMilestone,
    toggleMilestone,
    deleteMilestone
  }
}
