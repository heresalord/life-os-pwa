import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { format, subDays } from 'date-fns'
import { useDb } from '../db/DbContext'
import { useAppStore } from '../store/useAppStore'
import { getUserLocalDate } from '../lib/dateUtils'
import type { DailyRecord } from '../db/schema'

export interface DailyLogStreakStats {
  currentStreak: number
  maxStreak: number
  totalDays: number
  averageScore: number
  isTodayComplete: boolean
  todayRecord: DailyRecord | null
  records: DailyRecord[]
}

export function useDailyLogStreak(): DailyLogStreakStats {
  const db = useDb()
  const { timezone } = useAppStore()

  // Reactively fetch all records from local Dexie database
  const records = useLiveQuery(() => db.daily_records.toArray()) || []

  return useMemo(() => {
    const todayStr = getUserLocalDate(timezone)
    const sortedDesc = [...records].sort((a, b) => b.date.localeCompare(a.date))

    const totalDays = records.length

    // Average Day Score
    const scoredRecords = records.filter(
      r => r.day_score !== null && r.day_score !== undefined
    )
    const averageScore = scoredRecords.length
      ? Math.round(
          scoredRecords.reduce((sum, r) => sum + (r.day_score || 0), 0) /
            scoredRecords.length
        )
      : 0

    // Today's completion status
    const todayRec = sortedDesc.find(r => r.date === todayStr) || null
    const isTodayComplete = Boolean(
      todayRec?.morning_complete && todayRec?.evening_complete
    )

    // Current Streak (consecutive completed days)
    // If today is completed, start from today; otherwise preserve streak from yesterday
    let currentStreak = 0
    const baseDate = new Date(todayStr + 'T12:00:00')
    let checkDate = isTodayComplete ? baseDate : subDays(baseDate, 1)

    while (true) {
      const checkStr = format(checkDate, 'yyyy-MM-dd')
      const rec = sortedDesc.find(r => r.date === checkStr)
      if (rec?.morning_complete && rec?.evening_complete) {
        currentStreak++
        checkDate = subDays(checkDate, 1)
      } else {
        break
      }
    }

    // Historical Maximum Streak
    let maxStreak = 0
    let tempStreak = 0
    const chronoRecords = [...records].sort((a, b) => a.date.localeCompare(b.date))
    let prevDateObj: Date | null = null

    for (const rec of chronoRecords) {
      if (rec.morning_complete && rec.evening_complete) {
        const currentDateObj = new Date(rec.date + 'T12:00:00')
        if (prevDateObj) {
          const diffDays = Math.round(
            (currentDateObj.getTime() - prevDateObj.getTime()) / (24 * 60 * 60 * 1000)
          )
          if (diffDays === 1) {
            tempStreak++
          } else if (diffDays > 1) {
            tempStreak = 1
          }
        } else {
          tempStreak = 1
        }
        prevDateObj = currentDateObj
        if (tempStreak > maxStreak) {
          maxStreak = tempStreak
        }
      } else {
        tempStreak = 0
        prevDateObj = null
      }
    }

    return {
      currentStreak,
      maxStreak,
      totalDays,
      averageScore,
      isTodayComplete,
      todayRecord: todayRec,
      records,
    }
  }, [records, timezone])
}
