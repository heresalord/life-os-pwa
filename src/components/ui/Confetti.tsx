/**
 * Lightweight pure-canvas celebration confetti burst.
 * Zero external libraries, automatically cleans up after animation.
 */

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rotation: number
  rotationSpeed: number
  opacity: number
  shape: 'rect' | 'circle'
}

const COLORS = [
  '#6366f1', // accent / indigo
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#10b981', // emerald
  '#f59e0b', // amber
  '#3b82f6', // blue
  '#06b6d4', // cyan
]

export function triggerConfetti(options?: {
  originX?: number // 0-1 percentage of screen width, default 0.5 (center)
  originY?: number // 0-1 percentage of screen height, default 0.6
  particleCount?: number // default 75
}) {
  if (typeof window === 'undefined') return

  const canvas = document.createElement('canvas')
  canvas.style.position = 'fixed'
  canvas.style.top = '0'
  canvas.style.left = '0'
  canvas.style.width = '100vw'
  canvas.style.height = '100vh'
  canvas.style.pointerEvents = 'none'
  canvas.style.zIndex = '99999'
  document.body.appendChild(canvas)

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    document.body.removeChild(canvas)
    return
  }

  const dpr = window.devicePixelRatio || 1
  canvas.width = window.innerWidth * dpr
  canvas.height = window.innerHeight * dpr
  ctx.scale(dpr, dpr)

  const count = options?.particleCount || 75
  const startX = (options?.originX ?? 0.5) * window.innerWidth
  const startY = (options?.originY ?? 0.6) * window.innerHeight

  const particles: Particle[] = []

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * (Math.random() * 0.8 + 0.1)) + Math.PI // Upward cone
    const speed = Math.random() * 12 + 6

    particles.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 4,
      vy: Math.sin(angle) * speed,
      size: Math.random() * 7 + 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      opacity: 1,
      shape: Math.random() > 0.4 ? 'rect' : 'circle',
    })
  }

  let animationFrameId: number
  const gravity = 0.35
  const drag = 0.98

  const update = () => {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)

    let alive = 0

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]

      p.vx *= drag
      p.vy *= drag
      p.vy += gravity
      p.x += p.vx
      p.y += p.vy
      p.rotation += p.rotationSpeed
      p.opacity -= 0.012

      if (p.opacity > 0 && p.y < window.innerHeight + 50) {
        alive++
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.globalAlpha = Math.max(0, p.opacity)
        ctx.fillStyle = p.color

        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7)
        } else {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.restore()
      }
    }

    if (alive > 0) {
      animationFrameId = requestAnimationFrame(update)
    } else {
      cancelAnimationFrame(animationFrameId)
      if (document.body.contains(canvas)) {
        document.body.removeChild(canvas)
      }
    }
  }

  animationFrameId = requestAnimationFrame(update)
}
