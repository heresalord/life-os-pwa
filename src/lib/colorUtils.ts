// Small color helpers for the accent color picker.
// All colors are plain 6-digit hex strings (e.g. "#c8b89a").

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  const num = parseInt(full, 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
    .join('')
}

/** Mix `hex` toward black by `amount` (0-1) — used for hover/active states. */
export function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex)
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount))
}

/** Append a 2-digit alpha channel — used for subtle glow/background tints. */
export function withAlpha(hex: string, alphaHex: string): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h
  return `#${full}${alphaHex}`
}

export interface AccentShades {
  accent: string
  accentDim: string
  accentGlow: string
}

/** Derive the `--theme-accent-dim` and `--theme-accent-glow` shades from a single accent color. */
export function getAccentShades(hex: string): AccentShades {
  return {
    accent: hex,
    accentDim: darken(hex, 0.25),
    accentGlow: withAlpha(hex, '26'), // ~15% alpha
  }
}

export interface AccentPreset {
  name: string
  value: string
}

export const ACCENT_PRESETS: AccentPreset[] = [
  { name: 'Gold',   value: '#c8b89a' },
  { name: 'Blue',   value: '#7aa2c9' },
  { name: 'Green',  value: '#7fb88f' },
  { name: 'Purple', value: '#a78bc9' },
  { name: 'Coral',  value: '#d98b7a' },
  { name: 'Teal',   value: '#6fb3ad' },
  { name: 'Pink',   value: '#c98bb0' },
  { name: 'Amber',  value: '#d9b36a' },
]

export const DEFAULT_ACCENT = ACCENT_PRESETS[0].value
