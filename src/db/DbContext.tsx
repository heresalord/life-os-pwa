/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react'
import Dexie from 'dexie'
import { LifeOSDatabase } from './index'
import { startSyncEngine, stopSyncEngine } from '../lib/sync'
import { queryClient } from '../lib/queryClient'

interface DbContextValue {
  db: LifeOSDatabase
}

const DbContext = createContext<DbContextValue | null>(null)

/**
 * migrateLegacyDb
 *
 * Dynamically copies all records from the old unified 'LifeOSDB'
 * database to the new 'LifeOSDB_${userId}' database if it exists,
 * then deletes the legacy database to prevent repeated migrations.
 */
async function migrateLegacyDb(userId: string, targetDb: LifeOSDatabase) {
  try {
    const exists = await Dexie.exists('LifeOSDB')
    if (!exists) return

    console.log('[DbMigration] Legacy LifeOSDB database found. Migrating data to user-scoped DB...')

    // Open legacy database dynamically
    const legacyDb = new Dexie('LifeOSDB')
    await legacyDb.open()

    const tables = legacyDb.tables

    for (const table of tables) {
      const tableName = table.name
      // Check if target database has a table with this name
      if (tableName in targetDb) {
        const records = await table.toArray()
        if (records.length > 0) {
          console.log(`[DbMigration] Migrating ${records.length} records for table ${tableName}...`)
          // Associate user_id with the record if it is missing or empty
          const scopedRecords = records.map(r => {
            if ('user_id' in r && !r.user_id) {
              return { ...r, user_id: userId }
            }
            return r
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const targetTable = (targetDb as any)[tableName]
          if (targetTable && typeof targetTable.bulkPut === 'function') {
            await targetTable.bulkPut(scopedRecords)
          }
        }
      }
    }

    await legacyDb.close()
    await Dexie.delete('LifeOSDB')
    console.log('[DbMigration] Migration from legacy database completed successfully.')
  } catch (err) {
    console.error('[DbMigration] Failed to migrate legacy database:', err)
  }
}

export function DbProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [db, setDb] = useState<LifeOSDatabase | null>(null)
  const [migrated, setMigrated] = useState(false)

  useEffect(() => {
    let active = true
    const userDb = new LifeOSDatabase(userId)

    async function initDb() {
      try {
        // Clear React Query cache on database switch to prevent memory leak / stale user data
        queryClient.clear()

        // Run the legacy migration check before opening the DB instance fully
        await migrateLegacyDb(userId, userDb)

        if (!active) {
          userDb.close()
          return
        }

        // Open the database instance
        await userDb.open()

        if (!active) {
          userDb.close()
          return
        }

        setDb(userDb)
        setMigrated(true)

        // Publish the active DB name so syncQueue.ts can resolve it without a direct reference
        sessionStorage.setItem('lifeos_active_db', `LifeOSDB_${userId}`)

        // Start background sync engine with current user db
        startSyncEngine(userDb)
      } catch (err) {
        console.error('[DbProvider] Failed to initialize user database:', err)
      }
    }

    void initDb()

    return () => {
      active = false
      sessionStorage.removeItem('lifeos_active_db')
      stopSyncEngine()
      userDb.close()
    }
  }, [userId])

  if (!db || !migrated) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center gap-3">
        <div className="text-3xl font-display text-accent">Life OS</div>
        <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <DbContext.Provider value={{ db }}>
      {children}
    </DbContext.Provider>
  )
}

export function useDb() {
  const context = useContext(DbContext)
  if (!context) {
    throw new Error('useDb must be used within a DbProvider')
  }
  return context.db
}
