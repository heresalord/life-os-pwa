# Life OS — Implementation Guide
# Phases 6–17: Remaining Work
# Last updated: July 2026
# Status: Phases 0–5 complete. Phase 6 partial. Phases 7–17 open.

---

## HOW TO USE THIS DOCUMENT

Each phase lists exact files, exact strings to find, and exactly what to replace them with.
Every phase starts with a build verification step. Never start a new phase until the
previous one passes `npm run build`.

Commit convention: `feat(phase-N): description` or `fix(phase-N): description`.

---

## PHASE 6 — Global UX Foundation (remaining items)

### 6.3 — Spacing discipline

Status: needs a pass through all component files.
Rule: every padding/margin/gap must be a multiple of 4px.
Non-permitted values to grep for and replace:

  p-3.5   → p-4
  px-3.5  → px-4
  py-3.5  → py-4
  gap-2.5 → gap-2 or gap-3
  mt-1.5  → mt-2
  mb-1.5  → mb-2
  ml-1.5  → ml-2
  mr-1.5  → mr-2
  space-y-1.5 → space-y-2
  space-x-1.5 → space-x-2

Run in terminal to find all occurrences:
  grep -r "p-3\.5\|px-3\.5\|py-3\.5\|gap-2\.5\|mt-1\.5\|mb-1\.5\|space-y-1\.5" src/

Fix each file manually. Ignore any occurrence inside a string literal that is
not a Tailwind class (e.g. inside a template string for dynamic class logic).


### 6.9 — Skeleton loaders

Status: Skeleton.tsx created. Spinners not yet replaced in pages.
The Skeleton components exist at: src/components/Skeleton.tsx

For each file below, find the spinner div and replace with the skeleton import.

FILE: src/pages/tasks/components/ListTab.tsx

  Add import at top:
    import { TaskListSkeleton } from '../../../components/Skeleton'

  Find the loading branch (the exact string will vary — search for "animate-spin"):
    <div className="flex justify-center ...">
      <div className="... animate-spin" />
    </div>

  Replace with:
    <TaskListSkeleton count={4} />


FILE: src/pages/inbox/InboxPage.tsx

  Add import:
    import { InboxListSkeleton } from '../../components/Skeleton'

  Replace animate-spin div with:
    <InboxListSkeleton count={6} />


FILE: src/pages/goals/GoalsPage.tsx

  Add import:
    import { GoalGridSkeleton } from '../../components/Skeleton'

  Replace animate-spin div with:
    <GoalGridSkeleton count={4} />


FILE: src/pages/finance/FinancePage.tsx and its tab components

  Add import in TransactionsTab.tsx:
    import { TransactionListSkeleton } from '../../../components/Skeleton'

  Replace animate-spin div with:
    <TransactionListSkeleton count={5} />


FILE: src/pages/notes/NotesPage.tsx

  Add import:
    import { NoteCardSkeleton } from '../../components/Skeleton'

  Replace animate-spin with a 4-item grid of NoteCardSkeleton.


Verify: `npm run build` — no errors.
Commit: `feat(phase-6): skeleton loaders replace spinners in all main pages`

---

## PHASE 7 — Daily Log Redesign

Files to modify:
  src/pages/day/DailyLogPage.tsx

### 7.1 — Header simplification

Find the header section (contains date navigation with prev/next buttons and a "Today" button).

Replace the 6-element header row with:
  - Date in display font: `<h1 className="font-display text-2xl font-bold text-text">{displayDate(selectedDate)}</h1>`
  - Left arrow: `<button onClick={goToPrevDay}>←</button>`
  - Right arrow: `<button onClick={goToNextDay}>→</button>`
  - Save dot: small green dot (8px circle) that fades in when saved, fades out after 2s
    `<span className={clsx('w-2 h-2 rounded-full bg-success transition-opacity duration-500', saved ? 'opacity-100' : 'opacity-0')} />`
  - Calendar icon on the right that opens the date input: `<CalendarDays size={18} />`

Remove: history link, full-width "Today" button, save status text label.


### 7.2 — Morning/Evening visual identity

In the Morning section card, add to the card's className:
  border-l-4 border-amber-400

In the Evening section card:
  border-l-4 border-blue-400

Add a very subtle background tint using inline style:
  Morning: style={{ background: 'linear-gradient(to right, rgba(251,191,36,0.04), transparent)' }}
  Evening: style={{ background: 'linear-gradient(to right, rgba(99,102,241,0.04), transparent)' }}


### 7.3 — Guided mode as primary action

Find the guided mode trigger buttons in each section header (currently small pill buttons).

Replace with full-width buttons at the BOTTOM of each Morning/Evening card:

  Morning:
    <button
      onClick={() => navigate('/day?guided=morning')}
      className="w-full flex items-center justify-center gap-2 h-12 bg-amber-400 text-gray-900 rounded-xl font-semibold text-sm mt-4 hover:bg-amber-300 transition-colors"
    >
      <Play size={16} /> Start Morning Ritual
    </button>

  Evening:
    <button
      onClick={() => navigate('/day?guided=evening')}
      className="w-full flex items-center justify-center gap-2 h-12 bg-indigo-500 text-white rounded-xl font-semibold text-sm mt-4 hover:bg-indigo-400 transition-colors"
    >
      <Play size={16} /> Start Evening Review
    </button>


### 7.4 — Day Score repositioning

Find the Day Score component (currently in a sidebar/right column on desktop).
Move it to the BOTTOM of the page, after all sections, as a full-width card:

  <div className="mt-6 p-5 bg-surface border border-border rounded-2xl">
    <h3 className="text-sm font-semibold text-text-secondary mb-4">Day Score</h3>
    {/* existing DayScoreGauge component */}
    <DayScoreGauge score={dayScore} />
  </div>

Remove the two-column grid layout on desktop. Use a single column.


### 7.5 — Journal textarea auto-grow

Find the journal textarea element.

Replace fixed-height textarea with auto-growing pattern:
  Wrap in: <div className="grid" style={{ gridTemplateAreas: '"overlap"' }}>
  Add a hidden pre element with matching styles:
    <pre style={{ gridArea: 'overlap', visibility: 'hidden', whiteSpace: 'pre-wrap', ...same padding/font as textarea }}>
      {journalValue + ' '}
    </pre>
  Textarea:
    style={{ gridArea: 'overlap', resize: 'none', overflow: 'hidden' }}

This pattern makes the textarea grow naturally with content on all browsers.


### 7.6 — Mood scale spring animation

Find the mood emoji buttons (the 5-button row).

In the button's className, change the selected scale from scale-105 to:
  selected:   'scale-125 transition-transform duration-300'
  unselected: 'scale-90  transition-transform duration-300'

Change the CSS transition to use the spring curve via style prop:
  style={{ transition: 'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}


Verify: `npm run build`
Commit: `feat(phase-7): daily log header, guided mode primary, day score bottom, journal auto-grow`

---

## PHASE 8 — Dashboard Redesign

Files to modify:
  src/pages/dashboard/DashboardPage.tsx
  src/components/dashboard/widgets/ (various)

### 8.1 — Hero header

At the very top of DashboardPage, before the widget grid, add a hero section:

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good Morning'
    if (h < 17) return 'Good Afternoon'
    return 'Good Evening'
  })()

  <div className="mb-6 space-y-1">
    <p className="text-base text-text-secondary font-body">{greeting}</p>
    <h1 className="font-display text-3xl font-bold text-text tracking-tight">
      {profile?.display_name ?? 'You'}
    </h1>
    <p className="text-sm text-text-muted">
      {completedTasksToday} of {totalTasksToday} tasks · {bestStreak} day streak
    </p>
  </div>

The context line reads from:
  - completedTasksToday: useTasksQuery(today).data filtered by completed
  - totalTasksToday: same query total count
  - bestStreak: useGoalsQuery('active').data max habit_streak


### 8.2 — Year progress anchored

The YearProgressWidget should always render immediately after the hero header,
regardless of the user's widget layout preferences. Add it statically before
the draggable grid:

  <div className="mb-4">
    <YearProgressWidget />
  </div>
  {/* then the draggable grid */}


### 8.3 — Edit mode as bottom sheet

Find the "Edit Layout" button and the inline edit mode toggle.

Replace the inline edit overlay with a bottom sheet:
  - Button triggers: setEditSheetOpen(true)
  - Render a bottom sheet (use the existing Portal component) with a list of
    all ALL_NAV_OPTIONS widgets as toggleable rows with drag handles
  - Keep react-grid-layout on desktop; use the existing @hello-pangea/dnd for
    mobile reordering inside the sheet


Verify: `npm run build`
Commit: `feat(phase-8): dashboard hero header, year progress anchored, edit mode sheet`

---

## PHASE 9 — Tasks Redesign

Files to modify:
  src/pages/tasks/TasksPage.tsx
  src/pages/tasks/components/ListTab.tsx
  src/components/tasks/TaskItem.tsx

### 9.1 — Floating action button

In TasksPage.tsx, remove the "Add Task" dashed button from inside ListTab.

Add a FAB at the bottom of TasksPage, outside the tab content:

  <button
    onClick={() => setAddOpen(true)}
    className="fixed bottom-24 right-5 z-30 w-14 h-14 bg-accent text-bg rounded-full flex items-center justify-center shadow-modal hover:scale-105 active:scale-95 transition-transform"
    aria-label="Add Task"
    style={{ transition: 'transform 400ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}
  >
    <Plus size={24} />
  </button>


### 9.2 — Completion ratio in header

In TasksPage.tsx header area, below the page title, add:

  const completed = tasks.filter(t => t.completed).length
  const total = tasks.length

  <div className="mt-1 space-y-1">
    <p className="text-xs text-text-muted">{completed} of {total} done today</p>
    <div className="h-1 bg-border rounded-full overflow-hidden">
      <div
        className="h-full bg-accent rounded-full transition-all duration-500"
        style={{ width: total > 0 ? `${(completed / total) * 100}%` : '0%' }}
      />
    </div>
  </div>


### 9.3 — Priority left border

In TaskItem.tsx, find the outermost task row div.

Add a dynamic left border based on priority:

  const priorityBorder = {
    1: 'border-l-[3px] border-red-500',
    2: 'border-l-[3px] border-orange-400',
    3: 'border-l-[3px] border-blue-400',
  }[task.priority ?? 0] ?? ''

  Add priorityBorder to the task row className.

Remove any existing priority text badge (e.g. [P1], [P2]).


### 9.4 — Checkbox animation

In TaskItem.tsx, find the checkbox button.

Replace the simple toggle with an animated sequence:

  When completing (completed becomes true):
    1. Add class 'scale-125' to the checkbox (spring: cubic-bezier(0.34,1.56,0.64,1))
    2. After 100ms, fill the checkbox with accent color and show a checkmark SVG
    3. Animate the title text: add 'line-through opacity-60 transition-all duration-200'

  Implementation: use a local state `isAnimating` that briefly applies the
  scale class on toggle, controlled by a 300ms setTimeout.

  Checkmark SVG (draw animation):
    <svg viewBox="0 0 12 12" className="w-3 h-3">
      <path
        d="M2 6l3 3 5-5"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"
        className="animate-[dash_200ms_ease_forwards]"
        style={{ strokeDasharray: 20, strokeDashoffset: 20 }}
      />
    </svg>

  In index.css add:
    @keyframes dash {
      to { stroke-dashoffset: 0; }
    }


### 9.5 — Swipe actions

In TaskItem.tsx, implement touch-based swipe:

  Add state: swipeX (number, 0 = at rest)
  Add refs: touchStartX, touchStartY, isDragging

  onTouchStart: record touchStartX, touchStartY
  onTouchMove:
    - Calculate deltaX = currentX - touchStartX
    - If Math.abs(deltaX) > Math.abs(deltaY): prevent scroll, set swipeX = deltaX
  onTouchEnd:
    - If swipeX > 60: trigger complete (swipe right)
    - If swipeX < -60: trigger delete (swipe left)
    - Animate back to 0 with spring transition

  Visual:
    The task row translates by swipeX pixels:
      style={{ transform: `translateX(${swipeX}px)`, transition: isDragging ? 'none' : 'transform 300ms cubic-bezier(0.34,1.56,0.64,1)' }}

    Behind it (absolute positioned):
      Right swipe → green bg with CheckCircle icon
      Left swipe  → red bg with Trash2 icon

    Show a brief toast on delete: "Task deleted · Undo" with 3s timer.


### 9.6 — Section visual differentiation

In ListTab.tsx:

  Completed tasks row: add 'opacity-60' to the row wrapper and 'line-through' to the title.
  Skipped tasks row: add 'opacity-35' and a dashed left border 'border-l-2 border-dashed border-text-muted'.
  Pending tasks: no changes (full contrast).


Verify: `npm run build`
Commit: `feat(phase-9): tasks FAB, completion ratio, priority borders, checkbox animation, swipe actions`

---

## PHASE 10 — Finance Redesign

Files to modify:
  src/pages/finance/FinancePage.tsx
  src/pages/finance/components/AccountsTab.tsx
  src/pages/finance/components/TransactionsTab.tsx
  src/pages/finance/components/BudgetsTab.tsx

### 10.1 — Balance hero above tabs

In FinancePage.tsx, above the tab bar, add:

  const totalBalance = wallets
    .filter(w => !w.archived && (w.currency ?? primaryCurrency) === primaryCurrency)
    .reduce((sum, w) => sum + (w.balance ?? 0), 0)

  <div className="mb-5 space-y-0.5">
    <div className="flex items-baseline gap-2">
      <span className="text-sm font-medium text-text-muted uppercase tracking-wider">
        {primaryCurrency}
      </span>
      <span className="font-display text-5xl font-extrabold text-text tracking-tight">
        {totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
      </span>
    </div>
    <p className="text-xs text-text-muted">Total balance across all wallets</p>
  </div>


### 10.2 — Period selector simplification

Find the period selector card (the card with day/week/month/year chips and prev/next chevrons).

Replace the entire card wrapper with an inline two-part row:

  <div className="flex items-center justify-between mb-4">
    <div className="flex gap-1 bg-surface-2 rounded-xl p-1">
      {['Day','Week','Month','Year'].map(p => (
        <button
          key={p}
          onClick={() => setPeriod(p.toLowerCase())}
          className={clsx('px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
            period === p.toLowerCase()
              ? 'bg-bg text-text shadow-sm'
              : 'text-text-muted hover:text-text'
          )}
        >
          {p}
        </button>
      ))}
    </div>
    <div className="flex items-center gap-1">
      <button onClick={prevPeriod} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-secondary">
        <ChevronLeft size={15} />
      </button>
      <span className="text-sm font-medium text-text min-w-[90px] text-center">{periodLabel}</span>
      <button onClick={nextPeriod} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-secondary">
        <ChevronRight size={15} />
      </button>
    </div>
  </div>


### 10.3 — Account cards as wallet cards

In AccountsTab.tsx, update each wallet card:

  <div
    className="relative p-5 rounded-2xl border border-border overflow-hidden shadow-card"
    style={{ background: `linear-gradient(135deg, ${wallet.color ?? '#6366f1'}22, ${wallet.color ?? '#6366f1'}08)` }}
  >
    <TypeIcon size={18} className="mb-3" style={{ color: wallet.color ?? 'var(--color-accent)' }} />
    <p className="text-xs text-text-muted mb-1">{wallet.name}</p>
    <p className="font-display text-2xl font-bold text-text">
      {wallet.currency} {wallet.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
    </p>
  </div>


### 10.4 — Transaction date grouping

In TransactionsTab.tsx, group transactions by date before rendering:

  const grouped = transactions.reduce((acc, tx) => {
    const key = tx.date
    if (!acc[key]) acc[key] = []
    acc[key].push(tx)
    return acc
  }, {} as Record<string, Transaction[]>)

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  Render:
    {sortedDates.map(date => (
      <div key={date}>
        <div className="sticky top-0 bg-bg px-1 py-2 text-[11px] font-bold uppercase tracking-widest text-text-muted z-10">
          {formatGroupDate(date)}  {/* "Today", "Yesterday", "Mon Jun 23" */}
        </div>
        {grouped[date].map(tx => <TransactionRow key={tx.id} tx={tx} />)}
      </div>
    ))}


### 10.5 — Budget status colors

In BudgetsTab.tsx, for each budget's progress bar:

  const pct = (spent / budget.limit_amount) * 100
  const barColor = pct >= 90 ? 'bg-danger' : pct >= 70 ? 'bg-warning' : 'bg-success'

  <div className="h-2 bg-border rounded-full overflow-hidden">
    <div
      className={clsx('h-full rounded-full transition-all duration-500', barColor)}
      style={{ width: `${Math.min(pct, 100)}%` }}
    />
  </div>

  If pct >= 100, add to card wrapper:
    style={{ background: 'linear-gradient(135deg, rgba(239,68,68,0.06), transparent)' }}


Verify: `npm run build`
Commit: `feat(phase-10): finance balance hero, period selector, wallet cards, tx date groups, budget colors`

---

## PHASE 11 — Inbox Redesign

Files to modify:
  src/pages/inbox/InboxPage.tsx
  src/components/inbox/InboxItemCard.tsx (if exists, else inline in InboxPage)

### 11.1 — Quick capture bar

At the very top of InboxPage (before the item list), add:

  const [captureText, setCaptureText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus on desktop
  useEffect(() => {
    if (window.innerWidth >= 768) inputRef.current?.focus()
  }, [])

  <div className="mb-4">
    <div className="flex items-center gap-2 bg-surface border border-border rounded-2xl px-4 py-3 focus-within:border-accent transition-colors">
      <Plus size={18} className="text-text-muted flex-shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={captureText}
        onChange={e => setCaptureText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && captureText.trim()) { addItem(captureText.trim()); setCaptureText('') } }}
        placeholder={t('inbox.capture_placeholder', 'Capture a thought, link, or idea…')}
        className="flex-1 bg-transparent text-sm text-text placeholder-text-muted outline-none"
      />
      {captureText && (
        <button onClick={() => { addItem(captureText.trim()); setCaptureText('') }}
          className="text-accent text-xs font-semibold">
          Add
        </button>
      )}
    </div>
  </div>


### 11.2 — Inbox zero state

Replace the generic empty state with:

  if (unprocessedItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="font-display text-2xl font-bold text-text mb-2">Inbox Zero</h2>
        <p className="text-text-muted text-sm max-w-xs">
          Nothing to process. Your mind is clear.
        </p>
      </div>
    )
  }

  Add a confetti burst (use the existing ConfettiBurst component from WeeklyRecapModal)
  that fires once when the count transitions from >0 to 0. Gate with a ref so it only
  fires on the transition, not on every render.


### 11.3 — Inbox item count as page title

Replace static "Inbox" page title with dynamic count:

  <h1 className="font-display text-3xl font-bold text-text">
    {unprocessed > 0
      ? `${unprocessed} to process`
      : 'Inbox'
    }
  </h1>


### 11.4 — Swipe actions on inbox items

Same pattern as Phase 9.5 (Task swipe actions).

  Swipe right (>60px): convert to task — open a small confirmation bottom sheet:
    "Add to Today?" with two buttons: Today | Someday
    On confirm: call processItem({ id, updates: { processed: true, processed_to: 'task' }, target: { type: 'task', title: item.text, date: today } })

  Swipe left (< -60px): delete item with hapticMedium + brief undo toast.


### 11.5 — Item type filter chips

Below the capture bar, add a horizontal chip row:

  const types = ['All', 'Text', 'Links']
  const [typeFilter, setTypeFilter] = useState('All')

  <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
    {types.map(type => (
      <button key={type}
        onClick={() => setTypeFilter(type)}
        className={clsx('flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors',
          typeFilter === type ? 'bg-accent text-bg' : 'bg-surface-2 text-text-muted hover:text-text'
        )}
      >
        {type}
      </button>
    ))}
  </div>

  Apply filter: items with a URL → 'Links', otherwise 'Text'.
  URL detection: /https?:\/\//.test(item.text)


Verify: `npm run build`
Commit: `feat(phase-11): inbox capture bar, inbox zero, dynamic title, swipe actions, type filters`

---

## PHASE 12 — Goals Redesign

Files to modify:
  src/pages/goals/GoalsPage.tsx
  src/components/goals/GoalItem.tsx (or wherever goal cards render)

### 12.1 — Filter consolidation

Remove the 5-column tab bar and the separate state dropdown.
Replace with a single horizontal scrollable chip row:

  const trackerTypes = ['All', 'Targets', 'Habits', 'Averages', 'Projects']
  const states = ['Active', 'Completed', 'Archived']

  <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 pb-1">
    {trackerTypes.map(t => <FilterChip key={t} ... />)}
    <div className="w-px bg-border flex-shrink-0 mx-1 self-stretch" />
    {states.map(s => <FilterChip key={s} ... />)}
  </div>

  FilterChip: `<button className={clsx('flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors', active ? 'bg-accent text-bg' : 'bg-surface-2 text-text-muted')}>{label}</button>`


### 12.2 — Goal card hero ring

In GoalItem (the card component), restructure layout:

  <div className="flex items-center gap-3 mb-3">
    {/* Progress ring — 64px, left-aligned */}
    <div className="flex-shrink-0 w-16 h-16 relative">
      <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
        <circle cx="32" cy="32" r="28" fill="none" stroke="var(--color-border)" strokeWidth="4" />
        <circle cx="32" cy="32" r="28" fill="none"
          stroke={goal.color ?? 'var(--color-accent)'} strokeWidth="4"
          strokeDasharray={`${2 * Math.PI * 28 * (progress / 100)} ${2 * Math.PI * 28}`}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-text">
        {Math.round(progress)}%
      </span>
    </div>

    {/* Title/meta */}
    <div className="flex-1 min-w-0">
      <p className="font-semibold text-text text-sm truncate">{goal.name}</p>
      <p className="text-xs text-text-muted mt-0.5">{goal.category ?? 'General'}</p>
      {/* Streak for habits */}
      {goal.tracker_type === 'habit' && (
        <p className="font-display text-lg font-bold text-text mt-1">
          🔥 {goal.habit_streak ?? 0} <span className="text-xs font-normal text-text-muted">days</span>
        </p>
      )}
    </div>
  </div>

  {/* 7-day check-in grid for habits */}
  {goal.tracker_type === 'habit' && (
    <div className="flex gap-1 mt-2">
      {last7Days.map(date => (
        <div key={date}
          className={clsx('flex-1 h-2 rounded-full', checkedIn[date] ? 'bg-accent' : 'bg-border')}
        />
      ))}
    </div>
  )}


### 12.3 — At-risk visual signal

In GoalItem, if the goal is behind pace:

  const isAtRisk = goal.state === 'active' && progress < expectedProgress * 0.8

  If isAtRisk, add to card wrapper:
    style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.06), transparent)' }}
  And add a small amber dot in top-right:
    <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-warning" />
  (make card wrapper relative)


### 12.4 — Empty state with suggested goals

When goals list is empty:

  <div className="space-y-4">
    <div className="text-center py-8">
      <p className="text-4xl mb-3">🎯</p>
      <h2 className="font-display text-xl font-bold text-text mb-1">No goals yet</h2>
      <p className="text-sm text-text-muted">Start with one of these</p>
    </div>
    {[
      { name: 'Read 15 minutes daily', type: 'habit', emoji: '📚' },
      { name: 'Exercise 3x per week', type: 'habit', emoji: '🏃' },
      { name: 'Save $500/month', type: 'target', emoji: '💰' },
    ].map(template => (
      <button key={template.name}
        onClick={() => createGoalFromTemplate(template)}
        className="w-full flex items-center gap-3 p-4 bg-surface border border-border rounded-2xl hover:border-accent/40 hover:bg-surface-2 transition-all text-left"
      >
        <span className="text-2xl">{template.emoji}</span>
        <div>
          <p className="text-sm font-semibold text-text">{template.name}</p>
          <p className="text-xs text-text-muted capitalize">{template.type} goal</p>
        </div>
        <Plus size={16} className="ml-auto text-text-muted" />
      </button>
    ))}
  </div>


Verify: `npm run build`
Commit: `feat(phase-12): goals filter chips, hero ring, at-risk signal, suggested goals empty state`

---

## PHASE 13 — Notes Redesign

Files to modify:
  src/pages/notes/NotesPage.tsx
  Note list card component (wherever NoteCard renders)

### 13.1 — Note card content preview

In the NoteCard, below the title, add:

  const preview = note.content
    ?.replace(/#{1,6}\s/g, '')      // strip markdown headings
    ?.replace(/\*\*(.*?)\*\*/g, '$1') // strip bold
    ?.replace(/\*(.*?)\*/g, '$1')    // strip italic
    ?.slice(0, 120)

  <p className="text-xs text-text-muted line-clamp-2 mt-1">{preview}</p>


### 13.2 — Focus mode on desktop

In DesktopNoteEditor (or wherever the desktop editor renders):

  Add state: isFocusMode = false

  Focus mode button:
    <button onClick={() => setIsFocusMode(v => !v)}
      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-2 text-text-muted"
    >
      <Maximize2 size={14} />
    </button>

  When isFocusMode is true:
    - Hide the folder sidebar and note list pane (apply 'hidden' class or width-0)
    - Editor column: 'col-span-3' or flex-1
    - Apply 'bg-bg' on the root, remove borders
    - Show a small X button to exit

  Keyboard shortcut:
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'f') {
          e.preventDefault()
          setIsFocusMode(v => !v)
        }
      }
      window.addEventListener('keydown', handler)
      return () => window.removeEventListener('keydown', handler)
    }, [])


### 13.3 — Search result highlighting

When searchQuery is non-empty, wrap matched text in <mark> tags:

  function highlight(text: string, query: string): React.ReactNode {
    if (!query.trim()) return text
    const parts = text.split(new RegExp(`(${query})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={i} className="bg-warning/35 text-text rounded-sm px-0.5">{part}</mark>
        : part
    )
  }

  Apply to note title and preview in NoteCard.


### 13.4 — Folder color coding

When creating/editing a folder, add a color picker row (8 color swatches).
Store the selected color alongside the folder name.
In the folder sidebar, render a small colored dot:
  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: folder.color ?? 'var(--color-accent)' }} />


Verify: `npm run build`
Commit: `feat(phase-13): note card preview, focus mode, search highlighting, folder colors`

---

## PHASE 14 — Books Redesign

Files to modify:
  src/pages/books/BooksPage.tsx
  src/components/books/BookItem.tsx (if exists)

### 14.1 — Currently reading as hero card

In the Reading tab, render currently-reading books as large portrait cards:

  {readingBooks.map(book => (
    <div key={book.id} className="flex gap-4 p-5 bg-surface border border-border rounded-2xl shadow-card">
      {/* Cover — portrait, 90x135 */}
      <div className="flex-shrink-0 w-[90px] h-[135px] rounded-xl overflow-hidden bg-surface-2 border border-border">
        {book.cover_url
          ? <img src={book.cover_url} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-3xl">📖</div>
        }
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
        <div>
          <h3 className="font-display font-bold text-text text-base leading-tight line-clamp-2">{book.title}</h3>
          <p className="text-xs text-text-muted mt-1">{book.author}</p>
        </div>
        {/* Reading progress */}
        <div>
          <div className="flex justify-between text-xs text-text-muted mb-1">
            <span>Page {book.current_page}</span>
            <span>{book.total_pages ? `${Math.round((book.current_page / book.total_pages) * 100)}%` : ''}</span>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div className="h-full bg-accent rounded-full transition-all duration-500"
              style={{ width: book.total_pages ? `${(book.current_page / book.total_pages) * 100}%` : '0%' }} />
          </div>
        </div>
      </div>
    </div>
  ))}


### 14.2 — Stats tab achievement wall

Replace the stats tab content with:

  {/* Large reading goal ring */}
  <div className="flex flex-col items-center py-6 mb-6">
    <div className="relative w-24 h-24">
      <svg viewBox="0 0 96 96" className="w-24 h-24 -rotate-90">
        <circle cx="48" cy="48" r="42" fill="none" stroke="var(--color-border)" strokeWidth="6" />
        <circle cx="48" cy="48" r="42" fill="none" stroke="var(--color-accent)" strokeWidth="6"
          strokeDasharray={`${2 * Math.PI * 42 * (booksFinishedThisYear / (readingGoal?.target_books ?? 12))} ${2 * Math.PI * 42}`}
          strokeLinecap="round" className="transition-all duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-bold text-text">{booksFinishedThisYear}</span>
        <span className="text-xs text-text-muted">of {readingGoal?.target_books ?? 12}</span>
      </div>
    </div>
    <p className="text-sm font-semibold text-text mt-3">{new Date().getFullYear()} Reading Goal</p>
  </div>

  {/* Bookshelf — cover thumbnails */}
  {finishedBooks.length > 0 && (
    <div>
      <h3 className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-3">Your Bookshelf</h3>
      <div className="flex flex-wrap gap-2">
        {finishedBooks.map(book => (
          <div key={book.id} className="w-12 h-[72px] rounded-md overflow-hidden bg-surface-2 border border-border flex-shrink-0">
            {book.cover_url
              ? <img src={book.cover_url} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-lg">📖</div>
            }
          </div>
        ))}
      </div>
    </div>
  )}


Verify: `npm run build`
Commit: `feat(phase-14): books reading hero card, stats achievement wall`

---

## PHASE 15 — Projects Redesign

Files to modify:
  src/pages/projects/ProjectsPage.tsx

### 15.1 — Gradient color accent

In each project card, replace the left border accent with a gradient overlay:

  <div className="relative p-5 bg-surface border border-border rounded-2xl shadow-card overflow-hidden">
    {/* Gradient overlay — left side only */}
    <div className="absolute inset-0 pointer-events-none rounded-2xl"
      style={{ background: `linear-gradient(to right, ${project.color ?? '#6366f1'}25, transparent 60%)` }}
    />
    {/* Content */}
    <div className="relative z-10">
      ...existing card content...
    </div>
  </div>


### 15.2 — Project status pill

Above the project name in each card, add:

  const status = (() => {
    if (project.archived) return { label: 'Archived', color: 'text-text-muted bg-surface-2' }
    if (progress >= 100)  return { label: 'Complete', color: 'text-success bg-success/10' }
    // (implement "Stalled" check: no tasks updated in last 7 days — requires task data)
    return { label: 'Active', color: 'text-accent bg-accent/10' }
  })()

  <span className={clsx('inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide', status.color)}>
    {status.label}
  </span>


### 15.3 — New Project button as primary

In the page header, replace the dashed outline button with:

  <button
    onClick={() => setCreateOpen(true)}
    className="flex items-center gap-2 px-4 py-2 bg-accent text-bg rounded-xl text-sm font-semibold hover:opacity-90 active:scale-95 transition-all"
  >
    <Plus size={16} /> New Project
  </button>


Verify: `npm run build`
Commit: `feat(phase-15): projects gradient accent, status pill, primary new button`

---

## PHASE 16 — Profile and Settings Redesign

### Profile (src/pages/profile/ProfilePage.tsx)

Replace the current layout with:

  {/* Avatar — centered, 80px */}
  <div className="flex flex-col items-center pt-2 pb-6">
    <div className="relative mb-4">
      <div className="w-20 h-20 rounded-full overflow-hidden bg-accent/20 border-2 border-accent/40 flex items-center justify-center">
        {localAvatarUrl
          ? <img src={localAvatarUrl} className="w-full h-full object-cover" />
          : <span className="font-display text-2xl font-bold text-accent">{initials}</span>
        }
      </div>
      <button
        onClick={() => fileInputRef.current?.click()}
        className="absolute bottom-0 right-0 w-6 h-6 bg-accent text-bg rounded-full flex items-center justify-center shadow-sm"
      >
        <Camera size={12} />
      </button>
    </div>
    <h1 className="font-display text-2xl font-bold text-text">{displayName}</h1>
    <p className="text-xs text-text-muted mt-1">
      Member since {profile ? format(parseISO(profile.created_at), 'MMMM yyyy') : '…'}
    </p>
  </div>

  {/* Stats grid — large numbers */}
  <div className="grid grid-cols-3 gap-3 mb-6">
    {[
      { label: 'Best Streak', value: bestStreak, unit: 'days' },
      { label: 'Done Today', value: completedTasksToday, unit: 'tasks' },
      { label: 'Active Goals', value: activeGoals, unit: 'goals' },
    ].map(stat => (
      <div key={stat.label} className="bg-surface border border-border rounded-2xl p-4 text-center">
        <p className="font-display text-3xl font-bold text-text">{stat.value}</p>
        <p className="text-[10px] text-text-muted uppercase tracking-wider mt-1">{stat.label}</p>
      </div>
    ))}
  </div>


### Settings (src/pages/settings/SettingsPage.tsx)

Restructure the entire page using the iOS grouped list pattern.

Each section:

  {/* Section */}
  <div className="space-y-1.5">
    <h2 className="text-[11px] font-bold text-text-muted uppercase tracking-widest px-1">
      Appearance
    </h2>
    <div className="bg-surface border border-border rounded-2xl overflow-hidden divide-y divide-border">
      {/* Row */}
      <div className="flex items-center justify-between px-4 py-3.5">
        <span className="text-sm text-text">Theme</span>
        <button onClick={() => setThemeSheetOpen(true)}
          className="flex items-center gap-1.5 text-sm text-text-secondary">
          {currentTheme} <ChevronRight size={14} className="text-text-muted" />
        </button>
      </div>
      {/* Toggle row */}
      <div className="flex items-center justify-between px-4 py-3.5">
        <span className="text-sm text-text">Notifications</span>
        <ToggleSwitch enabled={notificationsEnabled} onChange={setNotificationsEnabled} />
      </div>
    </div>
  </div>

  ToggleSwitch component (CSS-only, no library):
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={clsx('relative inline-flex w-11 h-6 rounded-full transition-colors duration-200',
        enabled ? 'bg-accent' : 'bg-border'
      )}
    >
      <span className={clsx('absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200',
        enabled ? 'translate-x-5' : 'translate-x-0'
      )} />
    </button>

  Danger Zone section (red header):
    <div className="space-y-1.5">
      <h2 className="text-[11px] font-bold text-danger uppercase tracking-widest px-1">Danger Zone</h2>
      <div className="bg-surface border border-border rounded-2xl overflow-hidden divide-y divide-border">
        <button className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-danger/5">
          <Download size={16} className="text-text-secondary flex-shrink-0" />
          <span className="text-sm text-text">Export All Data</span>
        </button>
        <button className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-danger/5">
          <Trash2 size={16} className="text-danger flex-shrink-0" />
          <span className="text-sm text-danger">Delete Account</span>
        </button>
      </div>
    </div>


Verify: `npm run build`
Commit: `feat(phase-16): profile centered avatar + stats, settings iOS grouped list`

---

## PHASE 17 — More Page Redesign

File: src/pages/more/MorePage.tsx

Replace the two module grids with an iOS Settings-style grouped list.

Module icon component:
  function ModuleIcon({ icon: Icon, color }: { icon: LucideIcon; color: string }) {
    return (
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: color }}>
        <Icon size={18} className="text-white" />
      </div>
    )
  }

Module row:
  <button onClick={() => navigate(module.to)}
    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors text-left">
    <ModuleIcon icon={module.icon} color={module.color} />
    <span className="flex-1 text-sm font-medium text-text">{module.label}</span>
    {module.badge && (
      <span className="text-xs text-text-muted bg-surface-2 px-2 py-0.5 rounded-full">{module.badge}</span>
    )}
    <ChevronRight size={14} className="text-text-muted flex-shrink-0" />
  </button>

Module colors (assign one per module):
  home: '#6366f1', day: '#f59e0b', tasks: '#10b981', finance: '#3b82f6',
  goals: '#8b5cf6', projects: '#f97316', books: '#ec4899', agenda: '#14b8a6',
  inbox: '#ef4444', notes: '#84cc16', search: '#64748b'

Sections:
  Productivity: tasks, finance, goals, projects, inbox
  Life:         day, books, agenda
  Creative:     notes, search

Keep the profile card, Morning/Evening shortcuts, and Settings/Sign Out as-is.


Verify: `npm run build`
Commit: `feat(phase-17): more page iOS grouped list with colored module icons`

---

## SUMMARY TABLE

| Phase | Files | Status | Est. time |
|-------|-------|--------|-----------|
| 6.3 spacing | grep + fix across all src/ | Open | 1h |
| 6.9 skeletons | ListTab, InboxPage, GoalsPage, FinancePage | Open | 2h |
| 7 Daily Log | DailyLogPage.tsx | Open | 3h |
| 8 Dashboard | DashboardPage.tsx | Open | 2h |
| 9 Tasks | TasksPage, ListTab, TaskItem | Open | 4h |
| 10 Finance | FinancePage, AccountsTab, TransactionsTab, BudgetsTab | Open | 3h |
| 11 Inbox | InboxPage | Open | 2h |
| 12 Goals | GoalsPage, GoalItem | Open | 2h |
| 13 Notes | NotesPage, NoteCard | Open | 2h |
| 14 Books | BooksPage | Open | 2h |
| 15 Projects | ProjectsPage | Open | 1h |
| 16 Profile+Settings | ProfilePage, SettingsPage | Open | 2h |
| 17 More | MorePage | Open | 1h |

Total remaining: ~27 hours of focused implementation.
