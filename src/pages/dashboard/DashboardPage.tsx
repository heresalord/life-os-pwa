import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  Sun,
  Moon,
  Edit2,
  Check,
  RotateCcw,
  Plus,
  GripVertical,
  X,
} from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { Responsive, WidthProvider } from 'react-grid-layout/legacy'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { useAuth } from '../../hooks/useAuth'
import { useUserSettings } from '../../hooks/useUserSettings'
import { useTasksQuery } from '../../hooks/useTasksQuery'
import { useAppStore } from '../../store/useAppStore'
import { getUserLocalDate } from '../../lib/dateUtils'
import { haptic } from '../../lib/haptic'
import { YearProgressWidget } from '../../components/dashboard/widgets/YearProgressWidget'
import { TasksTodayWidget } from '../../components/dashboard/widgets/TasksTodayWidget'
import { FinanceSnapshotWidget } from '../../components/dashboard/widgets/FinanceSnapshotWidget'
import { GoalProgressWidget } from '../../components/dashboard/widgets/GoalProgressWidget'
import { HabitStreakWidget } from '../../components/dashboard/widgets/HabitStreakWidget'
import { DailyLogQuickWidget } from '../../components/dashboard/widgets/DailyLogQuickWidget'
import { QuoteWidget } from '../../components/dashboard/widgets/QuoteWidget'
import { RecentNotesWidget } from '../../components/dashboard/widgets/RecentNotesWidget'
import { UpcomingBlocksWidget } from '../../components/dashboard/widgets/UpcomingBlocksWidget'
import { WellbeingHeatmapWidget } from '../../components/dashboard/widgets/WellbeingHeatmapWidget'
import { InboxWidget } from '../../components/dashboard/widgets/InboxWidget'
 import { WeeklyRecapModal } from '../../components/dashboard/WeeklyRecapModal'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { useTranslation } from '../../i18n'

import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const ResponsiveGridLayout = WidthProvider(Responsive)

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DashboardWidgetPref {
  id: string
  order: number
  size: { w: number; h: number }
  x: number
  y: number
  visible: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WIDGET_METADATA: {
  id: string
  label: string
  defaultSize: { w: number; h: number }
  minSize: { w: number; h: number }
}[] = [
  { id: 'year_progress',    label: 'Year Progress Bar',     defaultSize: { w: 12, h: 2 }, minSize: { w: 4, h: 2 } },
  { id: 'daily_log_quick',  label: 'Daily Log Quick Entry', defaultSize: { w: 6,  h: 4 }, minSize: { w: 4, h: 3 } },
  { id: 'tasks_today',      label: "Today's Focus Tasks",   defaultSize: { w: 6,  h: 4 }, minSize: { w: 4, h: 3 } },
  { id: 'finance_snapshot', label: 'Finance Snapshot',      defaultSize: { w: 6,  h: 4 }, minSize: { w: 4, h: 3 } },
  { id: 'goals_progress',   label: 'Goal Progress',         defaultSize: { w: 6,  h: 4 }, minSize: { w: 4, h: 3 } },
  { id: 'habits_grid',      label: 'Habit Streak Grid',     defaultSize: { w: 6,  h: 4 }, minSize: { w: 4, h: 3 } },
  { id: 'upcoming_blocks',  label: 'Upcoming Agenda',       defaultSize: { w: 6,  h: 4 }, minSize: { w: 4, h: 3 } },
  { id: 'recent_notes',     label: 'Recent Notes',          defaultSize: { w: 6,  h: 4 }, minSize: { w: 4, h: 3 } },
  { id: 'quote_of_day',     label: 'Quote of the Day',      defaultSize: { w: 6,  h: 3 }, minSize: { w: 4, h: 2 } },
  { id: 'wellbeing_heatmap',label: 'Wellbeing Heatmap',     defaultSize: { w: 12, h: 3 }, minSize: { w: 6, h: 3 } },
  { id: 'inbox_quick',      label: 'Inbox Quick View',      defaultSize: { w: 6,  h: 4 }, minSize: { w: 4, h: 3 } },
]

const WIDGET_COMPONENTS: Record<string, React.ComponentType> = {
  year_progress:     YearProgressWidget,
  tasks_today:       TasksTodayWidget,
  finance_snapshot:  FinanceSnapshotWidget,
  goals_progress:    GoalProgressWidget,
  habits_grid:       HabitStreakWidget,
  daily_log_quick:   DailyLogQuickWidget,
  quote_of_day:      QuoteWidget,
  recent_notes:      RecentNotesWidget,
  upcoming_blocks:   UpcomingBlocksWidget,
  wellbeing_heatmap: WellbeingHeatmapWidget,
  inbox_quick:       InboxWidget,
}

const DEFAULT_WIDGET_PREFS: DashboardWidgetPref[] = [
  { id: 'year_progress',    order: 0, size: { w: 12, h: 2 }, x: 0, y: 0,  visible: true },
  { id: 'daily_log_quick',  order: 1, size: { w: 6,  h: 4 }, x: 0, y: 2,  visible: true },
  { id: 'tasks_today',      order: 2, size: { w: 6,  h: 4 }, x: 6, y: 2,  visible: true },
  { id: 'finance_snapshot', order: 3, size: { w: 6,  h: 4 }, x: 0, y: 6,  visible: true },
  { id: 'goals_progress',   order: 4, size: { w: 6,  h: 4 }, x: 6, y: 6,  visible: true },
  { id: 'habits_grid',      order: 5, size: { w: 6,  h: 4 }, x: 0, y: 10, visible: true },
  { id: 'upcoming_blocks',  order: 6, size: { w: 6,  h: 4 }, x: 6, y: 10, visible: true },
  { id: 'recent_notes',     order: 7, size: { w: 6,  h: 4 }, x: 0, y: 14, visible: true },
  { id: 'quote_of_day',     order: 8, size: { w: 6,  h: 3 }, x: 6, y: 14, visible: true },
  { id: 'wellbeing_heatmap',order: 9, size: { w: 12, h: 3 }, x: 0, y: 17, visible: true },
  { id: 'inbox_quick',      order: 10,size: { w: 6,  h: 4 }, x: 0, y: 20, visible: true },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return { key: 'dashboard.greeting_morning',   icon: <Sun  size={16} className="text-warning" /> }
  if (h < 18) return { key: 'dashboard.greeting_afternoon', icon: <Sun  size={16} className="text-accent"  /> }
  return             { key: 'dashboard.greeting_evening',   icon: <Moon size={16} className="text-info"    /> }
}

function mergeWithDefaults(saved: DashboardWidgetPref[]): DashboardWidgetPref[] {
  const savedIds = new Set(saved.map(w => w.id))
  const newWidgets = DEFAULT_WIDGET_PREFS
    .filter(w => !savedIds.has(w.id))
    .map((w, i) => ({ ...w, order: saved.length + i }))
  return [...saved, ...newWidgets]
}

// ─── Long-press hook ──────────────────────────────────────────────────────────

function useLongPress(onLongPress: () => void, delay = 600) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const firedRef = useRef(false)

  const start = useCallback(() => {
    firedRef.current = false
    timerRef.current = setTimeout(() => {
      firedRef.current = true
      onLongPress()
    }, delay)
  }, [onLongPress, delay])

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }, [])

  const handleClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (firedRef.current) e.stopPropagation()
  }, [])

  return {
    onTouchStart: start,
    onTouchEnd:   cancel,
    onTouchMove:  cancel,
    onMouseDown:  start,
    onMouseUp:    cancel,
    onMouseLeave: cancel,
    onClick:      handleClick,
  }
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function WidgetSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-2xl animate-pulse" style={{ height: 200 }}>
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-surface-2 rounded" />
          <div className="h-3 w-28 bg-surface-2 rounded" />
        </div>
        <div className="space-y-2 pt-2">
          <div className="h-2 bg-surface-2 rounded w-full" />
          <div className="h-2 bg-surface-2 rounded w-4/5" />
          <div className="h-2 bg-surface-2 rounded w-3/5" />
        </div>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { t } = useTranslation()
  const { profile }                                            = useAuth()
  const { key: greetingKey, icon }                             = getGreeting()
  const greeting = t(greetingKey)
  const { data: settings, isLoading: settingsLoading, upsert } = useUserSettings()

  const { timezone } = useAppStore()
  const today = getUserLocalDate(timezone)
  const { data: tasks = [] } = useTasksQuery(today)
  const completedTasksToday = tasks.filter(t => t.completed).length
  const totalTasksToday     = tasks.length

  const taskText = completedTasksToday === totalTasksToday && totalTasksToday > 0
    ? 'All tasks done today 🎉'
    : totalTasksToday > 0
      ? `${completedTasksToday} of ${totalTasksToday} tasks done`
      : 'No tasks for today'

  const [widgetPrefs, setWidgetPrefs] = useState<DashboardWidgetPref[]>([])
  const [isEditing,   setIsEditing]   = useState(false)
  const [isMobile,    setIsMobile]    = useState(false)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  const layoutReadyRef = useRef(false)
  const addMenuRef     = useRef<HTMLDivElement>(null)

  // 1. Sync from Supabase
  useEffect(() => {
    if (settingsLoading) return
    const saved = settings?.dashboard_widgets as DashboardWidgetPref[] | null | undefined
    if (Array.isArray(saved) && saved.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWidgetPrefs(mergeWithDefaults(saved))
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setWidgetPrefs(DEFAULT_WIDGET_PREFS)
    }
    requestAnimationFrame(() => { layoutReadyRef.current = true })
  }, [settingsLoading, settings])

  // 2. Mobile breakpoint
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // 3. Close Add dropdown on outside click
  useEffect(() => {
    if (!showAddMenu) return
    const handler = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setShowAddMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showAddMenu])

  const saveLayout = useCallback((updated: DashboardWidgetPref[]) => {
    setWidgetPrefs(updated)
    upsert.mutate({ dashboard_widgets: updated as any })
  }, [upsert])

  // Layout is readonly in v2 types; _layouts is the per-breakpoint map (unused)
  const handleLayoutChange = useCallback((currentLayout: readonly { i: string; x: number; y: number; w: number; h: number }[]) => {
    if (!layoutReadyRef.current) return
    setWidgetPrefs(prev => {
      const updated = prev.map(pref => {
        if (!pref.visible) return pref
        const match = currentLayout.find(l => l.i === pref.id)
        if (!match) return pref
        return { ...pref, x: match.x, y: match.y, size: { w: match.w, h: match.h } }
      })
      const sorted = [...updated].sort((a, b) => {
        if (!a.visible && !b.visible) return a.order - b.order
        if (!a.visible) return 1
        if (!b.visible) return -1
        return a.y - b.y || a.x - b.x
      })
      const finalized = sorted.map((p, idx) => ({ ...p, order: idx }))
      upsert.mutate({ dashboard_widgets: finalized as any })
      return finalized
    })
  }, [upsert])

  const handleDragEndMobile = useCallback((result: DropResult) => {
    if (!result.destination) return
    const visible   = widgetPrefs.filter(w => w.visible)
    const hidden    = widgetPrefs.filter(w => !w.visible)
    const reordered = Array.from(visible)
    const [moved]   = reordered.splice(result.source.index, 1)
    reordered.splice(result.destination.index, 0, moved)
    const updatedVisible = reordered.map((w, i) => ({ ...w, order: i, y: i * 4 }))
    saveLayout([...updatedVisible, ...hidden].sort((a, b) => a.order - b.order))
  }, [widgetPrefs, saveLayout])

  const handleRemoveWidget = useCallback((id: string) => {
    haptic('light')
    saveLayout(widgetPrefs.map(w => w.id === id ? { ...w, visible: false } : w))
  }, [widgetPrefs, saveLayout])

  const handleAddWidget = useCallback((id: string) => {
    haptic('light')
    const visibleCount = widgetPrefs.filter(w => w.visible).length
    saveLayout(widgetPrefs.map(w =>
      w.id === id ? { ...w, visible: true, order: visibleCount, y: visibleCount * 4, x: 0 } : w
    ))
    setShowAddMenu(false)
  }, [widgetPrefs, saveLayout])

  const handleResetDefault = useCallback(() => {
    layoutReadyRef.current = false
    saveLayout(DEFAULT_WIDGET_PREFS)
    requestAnimationFrame(() => { layoutReadyRef.current = true })
  }, [saveLayout])

  const handleLongPress = useCallback(() => {
    if (!isMobile || isEditing) return
    haptic('heavy')
    setIsEditing(true)
  }, [isMobile, isEditing])

  const mobileLongPress = useLongPress(handleLongPress)

  const visibleWidgets = [...widgetPrefs].filter(w => w.visible).sort((a, b) => a.order - b.order)
  const gridWidgets    = visibleWidgets.filter(w => w.id !== 'year_progress')
  const hiddenWidgets  = widgetPrefs.filter(w => !w.visible)
  const desktopLayouts = gridWidgets.map(w => ({
    i:    w.id,
    x:    w.x,
    y:    w.y,
    w:    w.size.w,
    h:    w.size.h,
    minW: WIDGET_METADATA.find(m => m.id === w.id)?.minSize.w ?? 4,
    minH: WIDGET_METADATA.find(m => m.id === w.id)?.minSize.h ?? 2,
  }))

  return (
    <div className={`space-y-4 ${isEditing ? 'is-editing' : ''}`}>
      {/* Weekly Recap modal — self-determines visibility */}
      <WeeklyRecapModal />

      <ConfirmDialog
        open={showResetConfirm}
        onOpenChange={setShowResetConfirm}
        title="Reset layout?"
        description="This puts every widget back to its default position and size. Your data isn't affected."
        confirmLabel="Reset layout"
        onConfirm={handleResetDefault}
      />
      <style>{`
        .react-resizable-handle { opacity: 0; transition: opacity 0.2s; pointer-events: none; }
        .is-editing .react-resizable-handle { opacity: 1; pointer-events: auto; }
        .react-resizable-handle::after {
          content: ""; position: absolute; right: 8px; bottom: 8px; width: 8px; height: 8px;
          border-right: 2px solid var(--theme-text-secondary, #888);
          border-bottom: 2px solid var(--theme-text-secondary, #888);
          opacity: 0.6;
        }
      `}</style>

      {/* Hero Header */}
      <header className="flex items-end justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="text-sm text-text-secondary font-body flex items-center gap-1.5">
            {icon} {greeting}
          </p>
          <h1 className="font-display text-3xl font-bold text-text tracking-tight mt-0.5">
            {profile?.display_name ?? 'You'}
          </h1>
          <p className="text-xs text-text-muted mt-1">{taskText}</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {isEditing ? (
            <>
              {hiddenWidgets.length > 0 && (
                <button
                  onClick={() => setShowAddMenu(true)}
                  className="flex items-center gap-2 px-3.5 py-2 bg-accent/10 border border-accent/20 text-accent text-xs font-semibold rounded-xl hover:bg-accent/20 transition-all shadow-sm"
                >
                  <Plus size={14} /> Add Widget
                </button>
              )}
              <button
                onClick={() => setShowResetConfirm(true)}
                className="p-2 bg-surface-2 border border-border text-text-secondary hover:text-text rounded-xl shadow-sm transition-all"
                title="Reset layout to default"
              >
                <RotateCcw size={14} />
              </button>
              <button
                onClick={() => { haptic('light'); setIsEditing(false) }}
                className="flex items-center gap-1 px-4 py-2 bg-success text-bg text-xs font-bold rounded-xl hover:bg-success/90 shadow-sm transition-all"
              >
                <Check size={14} /> Done
              </button>
            </>
          ) : (
            <button
              onClick={() => { haptic('light'); setIsEditing(true) }}
              className="flex items-center gap-1 px-4 py-2 bg-surface border border-border text-text-secondary hover:text-text text-xs font-semibold rounded-xl hover:bg-surface-2 transition-all shadow-sm"
            >
              <Edit2 size={13} /> Edit Layout
            </button>
          )}
        </div>
      </header>

      {/* Year Progress — always anchored at top */}
      <div className="mb-4">
        <YearProgressWidget />
      </div>

      {/* Grid */}
      {settingsLoading || widgetPrefs.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <WidgetSkeleton key={i} />)}
        </div>
      ) : isMobile ? (
        isEditing ? (
          <DragDropContext onDragEnd={handleDragEndMobile}>
            <Droppable droppableId="mobile-widgets">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
                  {gridWidgets.map((pref, index) => {
                    const Component = WIDGET_COMPONENTS[pref.id]
                    if (!Component) return null
                    return (
                      <Draggable key={pref.id} draggableId={pref.id} index={index}>
                        {(drag, snapshot) => (
                          <div
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            className={`relative bg-surface rounded-2xl border border-border transition-shadow ${snapshot.isDragging ? 'shadow-2xl ring-1 ring-accent/30 scale-[1.01]' : 'shadow-sm'}`}
                          >
                            <div className="absolute top-2.5 right-2.5 flex items-center gap-2 z-50">
                              <div
                                {...drag.dragHandleProps}
                                className="p-2 bg-surface-2 border border-border text-text-muted hover:text-text rounded-lg cursor-grab active:cursor-grabbing"
                              >
                                <GripVertical size={14} />
                              </div>
                              <button
                                onClick={() => handleRemoveWidget(pref.id)}
                                className="p-2 bg-surface-2 border border-border text-danger hover:bg-danger/10 rounded-lg transition-colors"
                              >
                                <X size={14} />
                              </button>
                            </div>
                            <div className="pointer-events-none opacity-70 select-none">
                              <Component />
                            </div>
                          </div>
                        )}
                      </Draggable>
                    )
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        ) : (
          <div className="flex flex-col gap-4">
            {gridWidgets.map(pref => {
              const Component = WIDGET_COMPONENTS[pref.id]
              if (!Component) return null
              return (
                <div
                  key={pref.id}
                  {...mobileLongPress}
                  className="w-full relative transition-transform active:scale-[0.99] duration-150"
                >
                  <Component />
                </div>
              )
            })}
            <p className="text-center text-[10px] text-text-muted opacity-60 pb-2">
              Long-press any widget to reorder
            </p>
          </div>
        )
      ) : (
        <div className={isEditing ? 'bg-surface-2/20 border border-dashed border-border rounded-3xl p-2 transition-colors' : ''}>
          <ResponsiveGridLayout
            layouts={{ lg: desktopLayouts }}
            breakpoints={{ lg: 996 }}
            cols={{ lg: 12 }}
            rowHeight={70}
            margin={[16, 16]}
            isDraggable={isEditing}
            isResizable={isEditing}
            draggableHandle=".widget-drag-handle"
            onLayoutChange={handleLayoutChange}
            className="layout"
          >
            {gridWidgets.map(pref => {
              const Component = WIDGET_COMPONENTS[pref.id]
              if (!Component) return null
              return (
                <div
                  key={pref.id}
                  className="relative bg-surface rounded-2xl border border-border hover:shadow-sm transition-all"
                >
                  <Component />
                  {isEditing && (
                    <>
                      <div className="absolute inset-0 bg-bg/5 cursor-move z-40 rounded-2xl" />
                      <div className="absolute top-2 right-2 flex items-center gap-2 z-50 animate-in fade-in duration-150">
                        <div className="widget-drag-handle p-2 bg-surface border border-border text-text-muted hover:text-text rounded-lg cursor-grab active:cursor-grabbing shadow-sm pointer-events-auto">
                          <GripVertical size={13} />
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoveWidget(pref.id) }}
                          className="p-2 bg-surface border border-border text-danger hover:bg-danger/10 rounded-lg shadow-sm pointer-events-auto transition-colors"
                          title="Remove widget"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </ResponsiveGridLayout>
        </div>
      )}

      {/* ── Bottom sheet picker for widgets ── */}
      <Dialog.Root open={showAddMenu} onOpenChange={setShowAddMenu}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/85 backdrop-blur-sm animate-in fade-in duration-200" />
          <Dialog.Content
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-3xl p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-3xl sm:border animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-base font-semibold text-text">Add Widget</Dialog.Title>
              <Dialog.Close className="text-text-muted hover:text-text">
                <X size={18} />
              </Dialog.Close>
            </div>
            
            {hiddenWidgets.length === 0 ? (
              <p className="text-xs text-text-muted italic text-center py-6">
                All widgets are already added to your dashboard.
              </p>
            ) : (
              <div className="space-y-2 max-h-[60dvh] overflow-y-auto pr-1">
                {hiddenWidgets.map(w => {
                  const meta = WIDGET_METADATA.find(m => m.id === w.id)
                  return (
                    <button
                      key={w.id}
                      onClick={() => handleAddWidget(w.id)}
                      className="w-full text-left p-4 bg-surface-2 hover:bg-surface border border-border rounded-2xl transition-all font-medium flex items-center justify-between text-sm group"
                    >
                      <span className="text-text-secondary group-hover:text-text">
                        {meta?.label ?? w.id}
                      </span>
                      <Plus size={15} className="text-accent" />
                    </button>
                  )
                })}
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
