export async function fetchExchangeRates(baseCurrency: string = 'USD'): Promise<Record<string, number>> {
  try {
    // Check cache first (valid for 24h)
    const cachedStr = localStorage.getItem(`exchange_rates_${baseCurrency}`)
    if (cachedStr) {
      const cached = JSON.parse(cachedStr)
      if (Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
        return cached.rates
      }
    }

    const res = await fetch(`https://open.er-api.com/v6/latest/${baseCurrency}`)
    if (!res.ok) throw new Error('Failed to fetch exchange rates')
    
    const data = await res.json()
    if (data.rates) {
      localStorage.setItem(`exchange_rates_${baseCurrency}`, JSON.stringify({
        timestamp: Date.now(),
        rates: data.rates
      }))
      return data.rates
    }
    return {}
  } catch (error) {
    console.error('Exchange rate fetch error:', error)
    return {}
  }
}

export function convertCurrency(amount: number, from: string, to: string, rates: Record<string, number>): number {
  if (from === to) return amount
  // If we have base to 'from' and base to 'to', we can convert
  const rateFrom = rates[from] || 1
  const rateTo = rates[to] || 1
  return (amount / rateFrom) * rateTo
}
