# Daily Log — Redesign Spec
# Target: src/pages/day/DailyLogPage.tsx (+ DailyLogHistoryPage.tsx, DailyLogWidget.tsx)
# Goal: fix the completion-model bug, then bring copy, visuals, and motion up to
# a standard where every word and every pixel is doing a job on purpose.
#
# Ordered by priority. Section 0 is a correctness bug and should land first —
# everything else is quality-of-craft on top of a model that actually works.

---

## 0. FIX FIRST — Completion model is broken

**The bug:** the inline page lets a user fill every field (energy, intention,
gratitude, priorities / mood, energy, win, reflection) without ever setting
`morning_complete` / `evening_complete` — only `finishMorningWizard()` /
`finishEveningWizard()` set those flags. A user who never opens the wizard
can fill in 100% of their day and never get credit for it, never build a
streak, with zero indication why.

**Fix — pick one:**
- **(a) Preferred.** Make the inline cards read-only summaries once
  `record` exists for the day (show what was logged, with an "Edit" tap
  target that opens the wizard at the relevant step). All writes go through
  the wizard. One source of truth for "did I do my ritual today."
- **(b) Fallback.** If inline free-editing must stay, derive completion from
  field presence instead of a wizard-only flag: mark `morning_complete` true
  the moment `energy_am`, `intent`, and all three `gratitude` entries are
  non-empty (mirror for evening). Compute this in `handleSaveFields`, not
  only in the wizard finishers.

Either way: the streak calculation in `DailyLogHistoryPage.tsx` and any new
streak badge (see §4) must read from the same completion source as the rest
of the app. No second definition of "done."

---

## 1. INFORMATION ARCHITECTURE — progressive disclosure, not one long form

Apple's Health and Journal apps never show every field at once — they show
what's relevant to your current state and let you drill in. Apply that here:

- **Collapse completed sections.** Once `morning_complete` is true, the
  Morning card collapses to a single summary row: mood/energy icon,
  intention text truncated to one line, a chevron. Full detail only on tap.
  Today, a fully-completed morning still shows all 4 open fields — the
  "reward" for finishing is more form.
- **Evening card stays closed until Morning is done (or it's past noon).**
  Don't present both rituals as equally live all day; it implies the user
  should be doing both right now.
- **Free Journal and Day Score move below the fold entirely** once either
  ritual is in progress — they're reference material, not part of the
  twice-daily habit loop, and currently compete for attention with it.
- **One primary action visible at a time.** If neither ritual is done today,
  show one large CTA sized to the moment ("Start Morning Ritual" before
  ~11am, "Start Evening Review" after ~5pm), not two full-height cards
  side by side asking to be filled in.

---

## 2. COPY — one voice, not two

Right now the inline page speaks in uppercase form-label English
("MORNING ENERGY", "TOP 3 PRIORITIES (LINKED TO TASKS)") and the wizard,
two taps away, speaks like a person ("How's your morning energy?"). Apple
never lets a label sound like a database column name. Bring the wizard's
voice out to every surface, including empty/error states.

**Field-by-field rewrite:**

| Current | Replace with |
|---|---|
| "MORNING ENERGY" | "Energy" |
| "TODAY'S INTENTION" (label) + "The single most important focus for today..." (placeholder — redundant with label) | Label: "Intention" · Placeholder: "What matters most today?" |
| "MORNING GRATITUDE" | "Grateful for" |
| "TOP 3 PRIORITIES (LINKED TO TASKS)" | "Priorities" — drop "(linked to Tasks)" entirely; it's an implementation detail, not something the user needs to know to use the feature |
| "No priorities designated for today." | "Nothing set yet — add one below." (the wizard already avoids passive-voice bureaucratic phrasing like "designated"; match it) |
| "Promote existing task" | "Add from today's tasks" |
| "DAY'S MOOD" | "Mood" |
| "EVENING ENERGY" | "Energy" |
| "WIN OF THE DAY" | "Today's win" |
| "What was the highlight of your day?" | keep — this one's good |
| "What went well?" / "What I'd do differently?" / "Tomorrow's Focus" | keep as-is, these already read naturally |
| Template chips: "📝 Blank", "🙏 Gratitude", "📋 Weekly", "😮‍💨 Stress" | Replace emoji with Lucide icons to match the rest of the app's icon system (see §3). Labels stay. |
| `window.confirm('Apply template? This will replace your current journal contents.')` | Custom `ConfirmDialog` (component already exists in `src/components/ConfirmDialog.tsx`) titled "Replace journal?" body "This swaps in the template and clears what's currently written." Destructive-style confirm button. |
| Save dot (no text, just a fading green dot) | Add a text label that appears with it: "Saved" — fades together, dot alone is too subtle to register as feedback |

**General rules for any new copy added later:**
- Sentence case always. No uppercase labels anywhere — if hierarchy is
  needed, use size/weight, not caps-and-tracking.
- Second person, present tense, short sentences. "How's your energy?" not
  "Please rate your current energy level."
- Never explain the data model to the user ("linked to Tasks", "synced",
  "queued") — that language belongs in code comments, not UI copy.

---

## 3. VISUAL SYSTEM — consistency over decoration

- **Icons: Lucide everywhere, no exceptions.** The template picker's raw
  emoji (📝🙏📋😮‍💨) is the only place in the app that breaks from the
  Lucide icon system. Swap for `FileText`/`Heart`/`ListChecks`/`Wind` (or
  similar) at the same size/weight as every other icon on the page.
- **One radius scale.** Cards use `rounded-2xl`, inputs use `rounded-xl`,
  chips use `rounded-full`, buttons mix `rounded-xl` and `rounded-full`
  depending on context (wizard finish button vs. inline CTA). Pick: cards
  `2xl`, all interactive controls (inputs, buttons, chips-that-aren't-pills)
  `xl`, pill-shaped filters/badges `full`. Audit this page against that rule
  once and stop re-deciding it per component.
- **Two accent gradients, used deliberately.** Morning (amber) and Evening
  (indigo) tints are good — they're the one piece of color-coding in the
  page and should stay minimal so they keep meaning something. Don't let a
  third accent color creep in (e.g. the `accent`-colored Free Journal
  header) — consider making Free Journal and Day Score neutral/monochrome
  since they're not morning- or evening-specific.
- **Typography hierarchy, three levels max on this page:**
  section title (16px semibold) → field label (13px medium, secondary
  color, sentence case, *not* uppercase) → body/value (14px regular).
  Currently there's a 4th level (10–11px bold uppercase tracked labels
  inside "Structured prompts") that exists only to be smaller than the
  other labels — collapse it into the same 13px field-label style as
  everything else.
- **Character counter** on Win of the Day: replace the hard red-at-limit
  treatment with a quieter one — counter stays neutral gray until the last
  ~20 characters, then shifts to the standard `warning` token (not `danger`
  — going over isn't an error, it's just full).

---

## 4. THE STREAK — make it visible where the decision happens

- Pull the `currentStreak` calculation that already lives in
  `DailyLogHistoryPage.tsx` into a small shared hook (`useDailyLogStreak`),
  and surface it as a compact badge on the CTA button itself:
  "Start Morning Ritual 🔥 12" — not a separate stat elsewhere on the page.
- When streak ≥ 3, the CTA's subtitle (if any) can reinforce continuity —
  keep this to one short line, no exclamation points, no gamified badges
  layered on top. A number and a flame icon is enough; Apple's own streak
  UI (Fitness rings, Weather) never over-decorates this.
- On the History page, the streak number should visually anchor the page
  (it currently competes with the heatmap and averages for top billing) —
  it's the single number someone opens that page to check.

---

## 5. MOTION & FEEDBACK

- **Standardize the easing curve.** The mood scale uses
  `cubic-bezier(0.34, 1.56, 0.64, 1)` (a springy overshoot) nowhere else on
  the page — everything else uses default Tailwind `transition-all`. Either
  apply the same spring curve to every selection control (energy scale,
  mood scale, priority checkboxes) for a consistent "alive" feel, or drop it
  and use one calm ease-out everywhere. Right now it reads as unintentional.
- **Haptics are already used well** (`haptic('light')` on mood/step
  changes, `haptic('success')`/`haptic('error')` on save) — extend the same
  pattern to the priority checkbox toggle and template selection, which
  currently have none.
- **Respect reduced motion.** None of the `animate-in fade-in
  slide-in-from-bottom-4` wizard-step transitions currently check
  `prefers-reduced-motion`. Wrap them in a check and fall back to a plain
  cross-fade — this is a real accessibility gap, not a nice-to-have.
- **Completion moment.** Finishing the wizard currently just closes the
  overlay (`setSearchParams({})`) back to the inline page. Apple treats
  completion as a beat, not an instant cut — a brief (300–400ms) checkmark
  confirmation before the overlay dismisses would make finishing feel like
  finishing, not like canceling.

---

## 6. ACCESSIBILITY

- **Hit targets.** The energy lightning buttons and mood buttons are sized
  `w-9 h-9` (36px) — under Apple's 44pt minimum. Bump to at least
  `w-11 h-11` or pad the touch area with a transparent hit-slop.
- **VoiceOver labels.** Icon-only buttons (mood scale, lightning scale,
  wizard back button) have no `aria-label` — a screen reader currently
  announces them by icon name or not at all. Add explicit labels: `"Energy
  level 3 of 5"`, `"Mood: Good"`, etc.
- **Dynamic Type / text scaling.** Several labels use fixed `text-[9px]`/
  `text-[10px]` (mood labels, priority badges). At the smallest end of
  Apple's type scale these are already borderline; make sure they don't
  clip or truncate destructively if the browser's base font size is scaled
  up — test at 150% zoom.
- **Color is never the only signal.** The "Complete" badge is
  color+text (fine). The character counter going amber near the limit is
  color-only — pair it with an icon or the word itself changing weight so
  colorblind users get the same cue.

---

## 7. SMALL POLISH ITEMS

- `handleSaveFields` fires a save (and a haptic, and the save-dot) on every
  single field blur. For text fields typed continuously (Win of the Day,
  reflection fields), consider debouncing to save-on-pause (~800ms) instead
  of save-on-blur, so haptic/visual feedback doesn't fire mid-thought if the
  user taps between fields quickly.
- The date-picker trigger (`CalendarDays` icon → hidden `<input
  type="date">`) has no visible affordance that it's tappable versus
  decorative — consider a subtle background chip around it, consistent with
  how other icon-buttons on the page look.
- `applyTemplate` replaces the entire journal with no undo — once the
  `ConfirmDialog` swap from §2 lands, that's the safety net; no further
  action needed here, just don't ship the template swap without it.

---

## Suggested build order

1. §0 completion-model fix (correctness — unblocks the streak entirely)
2. §4 streak badge on CTA (highest motivational payoff, now safe to build)
3. §2 copy pass (cheap, no logic changes, immediate quality lift)
4. §6 accessibility (hit targets + VoiceOver labels — quick, high-value)
5. §1 progressive disclosure / collapsing cards (bigger layout change)
6. §3 visual system audit + §5 motion pass (polish, do last so it's not
   redone when §1 restructures the layout)
