/**
 * Note tag helpers.
 *
 * Tags are stored inside the note's content as an HTML comment at the very end:
 *   <!-- tags:work,personal,idea -->
 *
 * This means they:
 *  - sync to the DB via the existing content field (no schema change needed)
 *  - are invisible when the content is rendered as Markdown
 *  - are searchable since they're part of the content string
 */

const TAG_REGEX = /\n*<!--\s*tags:(.*?)-->\s*$/

/** Parse tags from raw note content. */
export function extractTags(content: string): string[] {
  const m = content.match(TAG_REGEX)
  if (!m) return []
  return m[1]
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(Boolean)
}

/** Return content with the tag comment removed — use this for display / editing. */
export function stripTags(content: string): string {
  return content.replace(TAG_REGEX, '').trimEnd()
}

/** Embed tags into content, replacing any existing tag comment. */
export function applyTags(content: string, tags: string[]): string {
  const base = stripTags(content)
  if (!tags.length) return base
  return `${base}\n\n<!-- tags:${tags.map(t => t.toLowerCase()).join(',')} -->`
}

/** Collect every unique tag across an array of note contents. */
export function collectAllTags(contents: string[]): string[] {
  const all = new Set<string>()
  for (const c of contents) extractTags(c).forEach(t => all.add(t))
  return [...all].sort()
}
