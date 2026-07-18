/**
 * Skeleton.tsx — Phase 6.9
 *
 * Shimmer placeholder components that match the layout of real content.
 * Use these instead of spinners so loading states feel instant — the user
 * sees exactly where their content will appear before it loads.
 *
 * All shimmer uses the `.skeleton` CSS class from index.css.
 */

// ── Base building blocks ──────────────────────────────────────────────────────

export function SkeletonLine({ width = 'full', height = 'h-4' }: { width?: string; height?: string }) {
  return <div className={`skeleton ${height} rounded w-${width}`} />
}

// ── Task item skeleton ─────────────────────────────────────────────────────────
// Matches TaskItem layout: checkbox + title line + meta line

export function TaskItemSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3 bg-surface border border-border rounded-xl">
      <div className="skeleton w-5 h-5 rounded-full flex-shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2 py-0.5">
        <div className="skeleton h-4 rounded w-3/4" />
        <div className="skeleton h-3 rounded w-1/3" />
      </div>
    </div>
  )
}

export function TaskListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="skeleton h-3 rounded w-16 ml-1" />
        <div className="space-y-2">
          {Array.from({ length: count }).map((_, i) => (
            <TaskItemSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Inbox card skeleton ────────────────────────────────────────────────────────
// Matches InboxItemCard layout: text lines + timestamp

export function InboxCardSkeleton() {
  return (
    <div className="p-4 bg-surface border border-border rounded-2xl space-y-2.5">
      <div className="skeleton h-4 rounded w-full" />
      <div className="skeleton h-4 rounded w-4/5" />
      <div className="skeleton h-3 rounded w-1/4 mt-1" />
    </div>
  )
}

export function InboxListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <InboxCardSkeleton key={i} />
      ))}
    </div>
  )
}

// ── Goal card skeleton ─────────────────────────────────────────────────────────
// Matches GoalItem layout: ring + title/subtitle + progress bar

export function GoalCardSkeleton() {
  return (
    <div className="p-4 bg-surface border border-border rounded-2xl space-y-3">
      <div className="flex items-center gap-3">
        <div className="skeleton w-12 h-12 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2 py-0.5">
          <div className="skeleton h-4 rounded w-3/4" />
          <div className="skeleton h-3 rounded w-1/2" />
        </div>
        <div className="skeleton w-10 h-5 rounded-full flex-shrink-0" />
      </div>
      <div className="skeleton h-2 rounded-full w-full" />
      <div className="flex gap-2">
        <div className="skeleton h-5 rounded-full w-16" />
        <div className="skeleton h-5 rounded-full w-20" />
      </div>
    </div>
  )
}

export function GoalGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <GoalCardSkeleton key={i} />
      ))}
    </div>
  )
}

// ── Finance skeleton ───────────────────────────────────────────────────────────
// Matches transaction row: icon + description + amount

export function TransactionRowSkeleton() {
  return (
    <div className="flex items-center gap-3 py-3 px-4">
      <div className="skeleton w-9 h-9 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <div className="skeleton h-4 rounded w-1/2" />
        <div className="skeleton h-3 rounded w-1/4" />
      </div>
      <div className="skeleton h-4 rounded w-16 flex-shrink-0" />
    </div>
  )
}

export function TransactionListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="bg-surface border border-border rounded-2xl overflow-hidden divide-y divide-border">
      {Array.from({ length: count }).map((_, i) => (
        <TransactionRowSkeleton key={i} />
      ))}
    </div>
  )
}

// ── Note card skeleton ─────────────────────────────────────────────────────────

export function NoteCardSkeleton() {
  return (
    <div className="p-4 bg-surface border border-border rounded-2xl space-y-2">
      <div className="skeleton h-4 rounded w-2/3" />
      <div className="skeleton h-3 rounded w-full" />
      <div className="skeleton h-3 rounded w-4/5" />
      <div className="skeleton h-3 rounded w-1/4 mt-1" />
    </div>
  )
}

// ── Generic page loader ────────────────────────────────────────────────────────
// Fallback for pages not yet converted to specific skeletons

export function PageSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="skeleton h-7 rounded w-48" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-16 rounded-xl w-full" />
        ))}
      </div>
    </div>
  )
}
