import { useState, useEffect } from 'react'

/** Returns current time as minutes since midnight, updated every 60 seconds. */
export function useNowMinutes() {
  const [mins, setMins] = useState(() => {
    const n = new Date()
    return n.getHours() * 60 + n.getMinutes()
  })
  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date()
      setMins(n.getHours() * 60 + n.getMinutes())
    }, 60_000)
    return () => clearInterval(id)
  }, [])
  return mins
}
