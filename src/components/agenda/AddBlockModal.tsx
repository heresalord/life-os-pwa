import React, { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Plus, X, Trash2, Clock, RotateCcw } from 'lucide-react'
import { useAgendaMutations } from '../../hooks/useAgendaMutations'
import type { AgendaBlock } from '../../db/schema'
import clsx from 'clsx'
import { haptic } from '../../lib/haptic'

const DAYS_OF_WEEK = [
  { label: 'M', full: 'Monday', dayIndex: 1 },
  { label: 'T', full: 'Tuesday', dayIndex: 2 },
  { label: 'W', full: 'Wednesday', dayIndex: 3 },
  { label: 'T', full: 'Thursday', dayIndex: 4 },
  { label: 'F', full: 'Friday', dayIndex: 5 },
  { label: 'S', full: 'Saturday', dayIndex: 6 },
  { label: 'S', full: 'Sunday', dayIndex: 0 },
]

export type RecurrenceType = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly'

export interface BlockModalProps {
  date: string
  block?: AgendaBlock | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
  trigger?: React.ReactNode
}

export function BlockModal({
  date,
  block,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger
}: BlockModalProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalOpen

  const isEditing = !!block
  const isVirtual = block?.id?.startsWith('virtual__')

  const [description, setDescription] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [allDay, setAllDay] = useState(false)
  
  // Recurrence state
  const [repeatType, setRepeatType] = useState<RecurrenceType>('none')
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [hasEndDate, setHasEndDate] = useState(false)
  const [endDate, setEndDate] = useState('')

  const { addBlock, updateBlock, deleteBlock } = useAgendaMutations(date)

  // Initialize form state when opening or when block changes
  useEffect(() => {
    if (open) {
      if (block) {
        setDescription(block.description || '')
        setStartTime(block.start_time || '09:00')
        setEndTime(block.end_time || '10:00')
        setAllDay(!!block.all_day)

        const rec = block.recurrence as any
        if (rec) {
          setRepeatType(rec.type || 'none')
          if (Array.isArray(rec.days)) {
            setSelectedDays(rec.days)
          } else {
            // Default to day of original block's date
            const dt = new Date((block.date || date) + 'T12:00:00')
            setSelectedDays([dt.getDay()])
          }
          if (rec.end_date) {
            setHasEndDate(true)
            setEndDate(rec.end_date)
          } else {
            setHasEndDate(false)
            setEndDate('')
          }
        } else {
          setRepeatType('none')
          const dt = new Date(date + 'T12:00:00')
          setSelectedDays([dt.getDay()])
          setHasEndDate(false)
          setEndDate('')
        }
      } else {
        setDescription('')
        setStartTime('09:00')
        setEndTime('10:00')
        setAllDay(false)
        setRepeatType('none')
        const dt = new Date(date + 'T12:00:00')
        setSelectedDays([dt.getDay()])
        setHasEndDate(false)
        setEndDate('')
      }
    }
  }, [open, block, date])

  const toggleDay = (dayIndex: number) => {
    haptic('light')
    setSelectedDays(prev => {
      if (prev.includes(dayIndex)) {
        // Prevent deselecting all days
        if (prev.length === 1) return prev
        return prev.filter(d => d !== dayIndex)
      } else {
        return [...prev, dayIndex].sort()
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!description.trim()) return
    if (!allDay && startTime >= endTime) return

    let recurrencePayload: any = null
    if (repeatType !== 'none') {
      recurrencePayload = {
        type: repeatType,
        ...(repeatType === 'weekly' ? { days: selectedDays } : {}),
        ...(hasEndDate && endDate ? { end_date: endDate } : {})
      }
    }

    if (isEditing && block) {
      await updateBlock.mutateAsync({
        id: block.id,
        updates: {
          description: description.trim(),
          start_time: allDay ? '00:00' : startTime,
          end_time: allDay ? '23:59' : endTime,
          all_day: allDay,
          recurrence: recurrencePayload,
        }
      })
    } else {
      await addBlock.mutateAsync({
        description: description.trim(),
        start_time: allDay ? '00:00' : startTime,
        end_time: allDay ? '23:59' : endTime,
        all_day: allDay,
        recurrence: recurrencePayload,
        date
      })
    }

    haptic('success')
    setOpen(false)
  }

  const handleDelete = async () => {
    if (!block) return
    if (window.confirm(isVirtual ? 'Delete this repeating time block series?' : 'Delete this time block?')) {
      haptic('medium')
      await deleteBlock.mutateAsync(block.id)
      setOpen(false)
    }
  }

  const dayNameOnCurrentDate = new Date(date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long' })

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      {trigger ? (
        <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      ) : !isControlled ? (
        <Dialog.Trigger asChild>
          <button className="w-full flex items-center justify-center gap-2 py-3 bg-surface-2 border border-dashed border-border rounded-xl text-text-secondary hover:text-text hover:border-text-muted transition-colors text-sm font-medium">
            <Plus size={18} /> Schedule Block
          </button>
        </Dialog.Trigger>
      ) : null}

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/80 backdrop-blur-sm animate-in fade-in-0 duration-200" />
        <Dialog.Content
          className="fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl p-5 shadow-2xl max-h-[90dvh] overflow-y-auto sm:inset-auto sm:left-1/2 sm:-translate-x-1/2 sm:top-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:border animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
          style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        >
          <div className="w-10 h-1 rounded-full bg-border mx-auto mb-4 sm:hidden" />
          
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
                <Clock size={16} />
              </div>
              <Dialog.Title className="text-base font-semibold text-text">
                {isEditing ? 'Edit Time Block' : 'New Time Block'}
              </Dialog.Title>
            </div>
            <Dialog.Close className="w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 transition-colors">
              <X size={18} />
            </Dialog.Close>
          </div>

          {isVirtual && (
            <div className="mb-4 p-2.5 rounded-xl bg-accent/10 border border-accent/20 text-xs text-accent flex items-center gap-2">
              <RotateCcw size={14} className="shrink-0" />
              <span>Editing this instance will update the entire repeating block series.</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                Title / Activity
              </label>
              <input
                autoFocus
                required
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Deep Work, Team Sync, Gym…"
                className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-4 py-2.5 text-sm text-text focus:outline-none transition-all font-medium"
              />
            </div>

            {/* All Day Toggle */}
            <div className="flex items-center justify-between bg-surface-2/60 p-3 rounded-xl border border-border/50">
              <span className="text-xs font-semibold text-text">All Day Event</span>
              <button
                type="button"
                role="switch"
                aria-checked={allDay}
                onClick={() => {
                  haptic('light')
                  setAllDay(v => !v)
                }}
                className={clsx(
                  'w-11 h-6 rounded-full transition-colors relative cursor-pointer',
                  allDay ? 'bg-accent' : 'bg-surface-2 border border-border'
                )}
              >
                <div
                  className={clsx(
                    'w-4 h-4 rounded-full bg-white transition-transform absolute top-1',
                    allDay ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>

            {/* Time Pickers (if not all day) */}
            {!allDay && (
              <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-150">
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                    Start
                  </label>
                  <input
                    type="time"
                    required={!allDay}
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-3 py-2 text-sm font-semibold text-text focus:outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                    End
                  </label>
                  <input
                    type="time"
                    required={!allDay}
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    min={startTime}
                    className="w-full bg-surface-2 border border-border focus:border-accent rounded-xl px-3 py-2 text-sm font-semibold text-text focus:outline-none transition-all"
                  />
                </div>
              </div>
            )}

            {!allDay && startTime >= endTime && (
              <p className="text-xs text-danger font-medium">End time must be after start time.</p>
            )}

            {/* Google Calendar-Style Recurrence Section */}
            <div className="space-y-3 pt-2 border-t border-border/40">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-text">
                  <RotateCcw size={13} className="text-accent" />
                  <span>Repeat</span>
                </label>
                <select
                  value={repeatType}
                  onChange={e => {
                    haptic('light')
                    setRepeatType(e.target.value as RecurrenceType)
                  }}
                  className="bg-surface-2 border border-border rounded-xl px-3 py-1.5 text-xs font-semibold text-text focus:outline-none focus:border-accent cursor-pointer"
                >
                  <option value="none">Does not repeat</option>
                  <option value="daily">Every day</option>
                  <option value="weekdays">Every weekday (Mon–Fri)</option>
                  <option value="weekly">Every week…</option>
                  <option value="monthly">Every month</option>
                </select>
              </div>

              {/* Day of Week Selector for Weekly Recurrence */}
              {repeatType === 'weekly' && (
                <div className="space-y-2 p-3 bg-surface-2/40 border border-border/50 rounded-xl animate-in fade-in duration-200">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                      Repeat on
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const targetDay = new Date(date + 'T12:00:00').getDay()
                        setSelectedDays([targetDay])
                      }}
                      className="text-[11px] text-accent hover:underline cursor-pointer"
                    >
                      Every {dayNameOnCurrentDate}
                    </button>
                  </div>
                  
                  {/* Days of week chips */}
                  <div className="grid grid-cols-7 gap-1">
                    {DAYS_OF_WEEK.map(({ label, full, dayIndex }) => {
                      const isSelected = selectedDays.includes(dayIndex)
                      return (
                        <button
                          key={dayIndex}
                          type="button"
                          title={full}
                          onClick={() => toggleDay(dayIndex)}
                          className={clsx(
                            'h-9 rounded-lg text-xs font-bold transition-all flex items-center justify-center cursor-pointer',
                            isSelected
                              ? 'bg-accent text-bg shadow-xs font-extrabold'
                              : 'bg-surface border border-border/70 text-text-muted hover:text-text hover:border-text-muted'
                          )}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Optional End Date for repeating events */}
              {repeatType !== 'none' && (
                <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-text-secondary">
                    <input
                      type="checkbox"
                      checked={hasEndDate}
                      onChange={e => {
                        setHasEndDate(e.target.checked)
                        if (e.target.checked && !endDate) {
                          setEndDate(date)
                        }
                      }}
                      className="rounded border-border text-accent focus:ring-accent w-3.5 h-3.5"
                    />
                    <span>Ends on date</span>
                  </label>
                  {hasEndDate && (
                    <input
                      type="date"
                      value={endDate}
                      min={date}
                      onChange={e => setEndDate(e.target.value)}
                      className="bg-surface-2 border border-border rounded-lg px-2 py-1 text-xs text-text focus:outline-none focus:border-accent"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center gap-2.5">
              {isEditing && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteBlock.isPending}
                  className="p-3 text-danger bg-danger/10 hover:bg-danger/20 rounded-xl transition-colors shrink-0 cursor-pointer"
                  title="Delete Block"
                >
                  <Trash2 size={18} />
                </button>
              )}
              <button
                type="submit"
                disabled={!description.trim() || (!allDay && startTime >= endTime) || addBlock.isPending || updateBlock.isPending}
                className="flex-1 bg-accent text-bg font-semibold rounded-xl py-3 hover:bg-accent/90 transition-colors disabled:opacity-50 text-sm shadow-xs cursor-pointer active:scale-[0.99]"
              >
                {addBlock.isPending || updateBlock.isPending
                  ? 'Saving…'
                  : isEditing
                  ? 'Save Changes'
                  : 'Schedule Block'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// Keep AddBlockModal alias for drop-in compatibility
export const AddBlockModal = BlockModal
export const EditBlockModal = BlockModal
