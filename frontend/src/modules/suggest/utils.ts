import type { RiskAppetite } from '../shared/api'

export function riskToAppetite(risk: number): RiskAppetite {
  if (risk <= 3) return 'LOW'
  if (risk <= 6) return 'MEDIUM'
  return 'HIGH'
}

export function getRiskLabel(risk: number): { label: string; color: string } {
  if (risk <= 2) return { label: 'Very conservative', color: '#16a34a' }
  if (risk <= 4) return { label: 'Conservative', color: '#22c55e' }
  if (risk <= 6) return { label: 'Balanced', color: '#f59e0b' }
  if (risk <= 8) return { label: 'Aggressive', color: '#f97316' }
  return { label: 'Very aggressive', color: '#ef4444' }
}
