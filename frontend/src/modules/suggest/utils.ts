import type { RiskAppetite } from '../shared/api'

export function pctToRisk(pct: number): RiskAppetite {
  if (pct < 34) return 'LOW'
  if (pct < 67) return 'MEDIUM'
  return 'HIGH'
}

export function getRiskLabel(pct: number): { label: string; color: string } {
  if (pct <= 20) return { label: 'Very conservative', color: '#16a34a' }
  if (pct <= 40) return { label: 'Conservative',      color: '#22c55e' }
  if (pct <= 60) return { label: 'Balanced',          color: '#f59e0b' }
  if (pct <= 80) return { label: 'Aggressive',        color: '#f97316' }
  return          { label: 'Very aggressive',  color: '#ef4444' }
}
