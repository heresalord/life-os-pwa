import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  Plus,
  X,
  Activity,
  Dumbbell,
  DollarSign,
  BookOpen,
  Briefcase,
  Users,
  Compass,
  Palette,
  Map,
  Calendar,
  Sparkles
} from 'lucide-react'
import { useGoalMutations } from '../../hooks/useGoalMutations'

type TrackerType = 'target' | 'habit' | 'average' | 'project'
type MeasurementType = 'count' | 'currency' | 'time' | 'percentage' | 'binary'

const CATEGORIES = [
  { name: 'Health', icon: Activity, color: 'text-info bg-info/10 border-info/20' },
  { name: 'Fitness', icon: Dumbbell, color: 'text-danger bg-danger/10 border-danger/20' },
  { name: 'Finance', icon: DollarSign, color: 'text-success bg-success/10 border-success/20' },
  { name: 'Learning', icon: BookOpen, color: 'text-accent bg-accent/10 border-accent/20' },
  { name: 'Career', icon: Briefcase, color: 'text-warning bg-warning/10 border-warning/20' },
  { name: 'Relationships', icon: Users, color: 'text-info bg-info/10 border-info/20' },
  { name: 'Mindfulness', icon: Compass, color: 'text-accent bg-accent/10 border-accent/20' },
  { name: 'Creative', icon: Palette, color: 'text-warning bg-warning/10 border-warning/20' },
  { name: 'Travel', icon: Map, color: 'text-success bg-success/10 border-success/20' },
  { name: 'Routine', icon: Calendar, color: 'text-accent bg-accent/10 border-accent/20' },
]

const TEMPLATES = [
  {
    category: 'Health',
    name: 'Drink 8 glasses of water',
    tracker_type: 'average' as TrackerType,
    measurement_type: 'count' as MeasurementType,
    target: 8,
    habit_schedule: { frequency: 'daily' as const, days: [] }
  },
  {
    category: 'Fitness',
    name: 'Hit the gym / Work out',
    tracker_type: 'habit' as TrackerType,
    measurement_type: 'binary' as MeasurementType,
    target: 1,
    habit_schedule: { frequency: 'daily' as const, days: [1, 3, 5] } // Mon, Wed, Fri
  },
  {
    category: 'Finance',
    name: 'Save emergency fund',
    tracker_type: 'target' as TrackerType,
    measurement_type: 'currency' as MeasurementType,
    target: 5000,
    habit_schedule: { frequency: 'daily' as const, days: [] }
  },
  {
    category: 'Learning',
    name: 'Read 30 minutes',
    tracker_type: 'habit' as TrackerType,
    measurement_type: 'binary' as MeasurementType,
    target: 1,
    habit_schedule: { frequency: 'daily' as const, days: [] }
  },
  {
    category: 'Career',
    name: 'Apply for jobs',
    tracker_type: 'target' as TrackerType,
    measurement_type: 'count' as MeasurementType,
    target: 10,
    habit_schedule: { frequency: 'daily' as const, days: [] }
  },
  {
    category: 'Relationships',
    name: 'Call family members',
    tracker_type: 'habit' as TrackerType,
    measurement_type: 'binary' as MeasurementType,
    target: 1,
    habit_schedule: { frequency: 'weekly' as const, days: [0] } // Sunday
  },
  {
    category: 'Mindfulness',
    name: 'Meditate 10 minutes',
    tracker_type: 'habit' as TrackerType,
    measurement_type: 'binary' as MeasurementType,
    target: 1,
    habit_schedule: { frequency: 'daily' as const, days: [] }
  },
  {
    category: 'Creative',
    name: 'Practice instrument / Draw',
    tracker_type: 'habit' as TrackerType,
    measurement_type: 'binary' as MeasurementType,
    target: 1,
    habit_schedule: { frequency: 'daily' as const, days: [] }
  },
  {
    category: 'Travel',
    name: 'Euro Trip planning',
    tracker_type: 'project' as TrackerType,
    measurement_type: 'binary' as MeasurementType,
    target: 1,
    habit_schedule: { frequency: 'daily' as const, days: [] },
    milestones: 'Book flights, Reserve hotels, Plan itinerary, Pack bags'
  },
  {
    category: 'Routine',
    name: 'Wake up at 7 AM',
    tracker_type: 'habit' as TrackerType,
    measurement_type: 'binary' as MeasurementType,
    target: 1,
    habit_schedule: { frequency: 'daily' as const, days: [1, 2, 3, 4, 5] }
  }
]

const DAYS_OF_WEEK = [
  { label: 'S', value: 0 },
  { label: 'M', value: 1 },
  { label: 'T', value: 2 },
  { label: 'W', value: 3 },
  { label: 'T', value: 4 },
  { label: 'F', value: 5 },
  { label: 'S', value: 6 }
]

import { useProjectsQuery } from '../../hooks/useProjectsQuery'

export function AddGoalModal() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [trackerType, setTrackerType] = useState<TrackerType>('target')
  const [category, setCategory] = useState('Health')
  const [target, setTarget] = useState('10')
  const [measurementType, setMeasurementType] = useState<MeasurementType>('count')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState('')
  const [habitFrequency, setHabitFrequency] = useState<'daily' | 'weekly'>('daily')
  const [habitDays, setHabitDays] = useState<number[]>([])
  const [initialMilestones, setInitialMilestones] = useState('')
  const [projectId, setProjectId] = useState('')

  const { data: projects } = useProjectsQuery()
  const { addGoal, addMilestone } = useGoalMutations()

  const handleSelectTemplate = (tpl: typeof TEMPLATES[number]) => {
    setName(tpl.name)
    setTrackerType(tpl.tracker_type)
    setCategory(tpl.category)
    setTarget(tpl.target.toString())
    setMeasurementType(tpl.measurement_type)
    setHabitFrequency(tpl.habit_schedule.frequency)
    setHabitDays(tpl.habit_schedule.days)
    if ('milestones' in tpl) {
      setInitialMilestones((tpl as any).milestones || '')
    } else {
      setInitialMilestones('')
    }
  }

  const toggleDay = (day: number) => {
    setHabitDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    const parsedTarget = trackerType === 'habit' ? 1 : parseFloat(target) || 0

    // Add Goal
    const goal = await addGoal.mutateAsync({
      name: name.trim(),
      target: parsedTarget,
      goal_type: endDate ? 'year' : 'general', // SMART structure automatically maps to 'year' / has deadline
      measurement_type: trackerType === 'habit' ? 'binary' : measurementType,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
      tracker_type: trackerType,
      category: category,
      habit_schedule: trackerType === 'habit' ? {
        frequency: habitFrequency,
        days: habitDays
      } : undefined,
      project_id: projectId || null,
    })

    // If it is a project with initial milestones
    if (goal && trackerType === 'project' && initialMilestones.trim()) {
      const titles = initialMilestones.split(',').map(t => t.trim()).filter(Boolean)
      for (const title of titles) {
        await addMilestone.mutateAsync({
          goal_id: goal.id,
          title
        })
      }
    }

    // Reset Form
    setName('')
    setTrackerType('target')
    setCategory('Health')
    setTarget('10')
    setMeasurementType('count')
    setStartDate(new Date().toISOString().split('T')[0])
    setEndDate('')
    setHabitFrequency('daily')
    setHabitDays([])
    setInitialMilestones('')
    setProjectId('')
    setOpen(false)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button className="w-full flex items-center justify-center gap-2 py-3.5 bg-surface-2 border border-dashed border-border rounded-2xl text-text-secondary hover:text-text hover:border-text-muted transition-all duration-200 text-sm font-medium shadow-sm hover:shadow active:scale-98">
          <Plus size={16} /> New Goal
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm animate-in fade-in duration-200" />
        <Dialog.Content
          className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-3xl p-5 shadow-2xl overflow-y-auto max-h-[92vh] sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg sm:rounded-2xl sm:border sm:max-h-[85vh] animate-in slide-in-from-bottom sm:zoom-in-95 duration-200"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
          <div className="flex items-center justify-between mb-4">
            <div>
              <Dialog.Title className="text-base font-semibold text-text">Create New Goal</Dialog.Title>
              <Dialog.Description className="text-xs text-text-muted mt-0.5">
                Set a SMART goal to track your success
              </Dialog.Description>
            </div>
            <Dialog.Close className="p-2 rounded-full hover:bg-surface-2 text-text-muted hover:text-text transition-colors">
              <X size={16} />
            </Dialog.Close>
          </div>

          {/* Templates Section */}
          <div className="mb-5">
            <div className="flex items-center gap-1 text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-2">
              <Sparkles size={11} className="text-accent" /> Custom Templates
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x -mx-5 px-5">
              {TEMPLATES.map((tpl, i) => {
                const catDef = CATEGORIES.find(c => c.name === tpl.category)
                const Icon = catDef?.icon || Activity
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSelectTemplate(tpl)}
                    className="flex-shrink-0 w-36 snap-start bg-surface-2 border border-border/80 hover:border-accent/40 rounded-xl p-3 text-left transition-all duration-200 group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={`p-2 rounded-lg border text-[10px] font-medium ${catDef?.color || ''}`}>
                        <Icon size={12} />
                      </span>
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-text-muted group-hover:text-accent transition-colors">
                        {tpl.tracker_type}
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-text line-clamp-2 leading-snug">
                      {tpl.name}
                    </h4>
                  </button>
                )
              })}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Goal name */}
            <div>
              <label className="block text-[10px] font-bold text-text-secondary mb-2 uppercase tracking-wider">Goal Name</label>
              <input
                autoFocus
                type="text"
                required
                placeholder="e.g. Read 20 books"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-4 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none transition-colors"
              />
            </div>

            {/* Tracker Type Selection */}
            <div>
              <label className="block text-[10px] font-bold text-text-secondary mb-2 uppercase tracking-wider">Tracker Type</label>
              <div className="grid grid-cols-4 gap-2">
                {(['target', 'habit', 'average', 'project'] as TrackerType[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTrackerType(t)
                      if (t === 'habit') {
                        setMeasurementType('binary')
                      } else if (t === 'project') {
                        setMeasurementType('count')
                      }
                    }}
                    className={`py-2 px-1 rounded-xl text-[11px] font-semibold border transition-all text-center capitalize ${
                      trackerType === t
                        ? 'bg-accent/10 border-accent text-accent shadow-sm'
                        : 'border-border text-text-secondary hover:text-text hover:bg-surface-2'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Select Chips */}
            <div>
              <label className="block text-[10px] font-bold text-text-secondary mb-2 uppercase tracking-wider">Category</label>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto pr-1">
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon
                  const isSelected = category === cat.name
                  return (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => setCategory(cat.name)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs border transition-colors ${
                        isSelected
                          ? 'border-accent text-accent bg-accent/10 font-medium'
                          : 'border-border text-text-secondary hover:text-text hover:bg-surface-2'
                      }`}
                    >
                      <Icon size={12} />
                      {cat.name}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Habit Schedule Config */}
            {trackerType === 'habit' && (
              <div className="bg-surface-2 border border-border/80 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-text">Frequency</span>
                  <div className="flex border border-border rounded-lg overflow-hidden p-0.5 bg-surface">
                    {(['daily', 'weekly'] as const).map(f => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setHabitFrequency(f)}
                        className={`px-3 py-1 text-[11px] font-semibold rounded-md capitalize transition-colors ${
                          habitFrequency === f ? 'bg-surface-2 text-text' : 'text-text-muted hover:text-text'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="block text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-2">Scheduled Days (Optional)</span>
                  <div className="flex justify-between">
                    {DAYS_OF_WEEK.map(d => {
                      const active = habitDays.includes(d.value)
                      return (
                        <button
                          key={d.value}
                          type="button"
                          onClick={() => toggleDay(d.value)}
                          className={`w-8 h-8 rounded-full border text-xs font-semibold flex items-center justify-center transition-all ${
                            active
                              ? 'bg-accent text-bg border-accent shadow-sm'
                              : 'border-border text-text-muted hover:text-text hover:border-text-secondary'
                          }`}
                        >
                          {d.label}
                        </button>
                      )
                    })}
                  </div>
                  <p className="text-[10px] text-text-muted mt-2">
                    If no days are selected, habit is active every day.
                  </p>
                </div>
              </div>
            )}

            {/* Target Value, Measure Unit (Target / Average) */}
            {trackerType !== 'habit' && trackerType !== 'project' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary mb-2 uppercase tracking-wider">
                    {trackerType === 'average' ? 'Target Average' : 'Target Goal'}
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="any"
                    required
                    placeholder="e.g. 100"
                    value={target}
                    onChange={e => setTarget(e.target.value)}
                    className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-4 py-2.5 text-sm text-text focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-text-secondary mb-2 uppercase tracking-wider">Measure Unit</label>
                  <div className="relative">
                    <select
                      value={measurementType}
                      onChange={e => setMeasurementType(e.target.value as MeasurementType)}
                      className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-4 py-2.5 text-sm text-text focus:outline-none appearance-none cursor-pointer transition-colors"
                    >
                      <option value="count">Count (Numbers)</option>
                      <option value="currency">Currency ($)</option>
                      <option value="time">Time (Hours)</option>
                      <option value="percentage">Percentage (%)</option>
                    </select>
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted text-xs">▼</span>
                  </div>
                </div>
              </div>
            )}

            {/* Initial Milestones Input for Project Tracker */}
            {trackerType === 'project' && (
              <div>
                <label className="block text-[10px] font-bold text-text-secondary mb-2 uppercase tracking-wider">Initial Milestones (Comma separated)</label>
                <textarea
                  placeholder="e.g. Draft proposal, Setup repository, Final code push"
                  rows={2}
                  value={initialMilestones}
                  onChange={e => setInitialMilestones(e.target.value)}
                  className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-4 py-2.5 text-sm text-text placeholder-text-muted focus:outline-none transition-colors resize-none"
                />
              </div>
            )}

            {/* Link to Project */}
            <div>
              <label className="block text-[10px] font-bold text-text-secondary mb-2 uppercase tracking-wider">
                Link to Project (optional)
              </label>
              <div className="relative">
                <select
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                  className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-4 py-2.5 text-sm text-text focus:outline-none appearance-none cursor-pointer transition-colors"
                >
                  <option value="">No Project</option>
                  {projects?.filter(p => !p.archived).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <span className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted text-xs">▼</span>
              </div>
            </div>

            {/* Date / Deadline Selector (SMART) */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-text-secondary mb-2 uppercase tracking-wider">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-4 py-2.5 text-sm text-text focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-text-secondary mb-2 uppercase tracking-wider">Deadline (SMART)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-4 py-2.5 text-sm text-text focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!name.trim() || addGoal.isPending}
              className="w-full bg-accent text-bg font-semibold rounded-xl py-3 hover:bg-accent-dim active:scale-[0.99] transition-all disabled:opacity-50 text-sm shadow-sm"
            >
              {addGoal.isPending ? 'Creating…' : 'Create Goal'}
            </button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
