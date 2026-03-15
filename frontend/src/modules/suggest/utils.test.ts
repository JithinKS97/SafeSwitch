import { describe, it, expect } from 'vitest'
import { riskToAppetite, getRiskLabel } from './utils'

describe('riskToAppetite', () => {
  it('returns LOW for 0', () => expect(riskToAppetite(0)).toBe('LOW'))
  it('returns LOW for 3', () => expect(riskToAppetite(3)).toBe('LOW'))
  it('returns MEDIUM for 4', () => expect(riskToAppetite(4)).toBe('MEDIUM'))
  it('returns MEDIUM for 6', () => expect(riskToAppetite(6)).toBe('MEDIUM'))
  it('returns HIGH for 7', () => expect(riskToAppetite(7)).toBe('HIGH'))
  it('returns HIGH for 10', () => expect(riskToAppetite(10)).toBe('HIGH'))
})

describe('getRiskLabel', () => {
  it('returns Very conservative for 0', () =>
    expect(getRiskLabel(0)).toEqual({ label: 'Very conservative', color: '#16a34a' }))

  it('returns Very conservative for 2', () =>
    expect(getRiskLabel(2)).toEqual({ label: 'Very conservative', color: '#16a34a' }))

  it('returns Conservative for 3', () =>
    expect(getRiskLabel(3)).toEqual({ label: 'Conservative', color: '#22c55e' }))

  it('returns Conservative for 4', () =>
    expect(getRiskLabel(4)).toEqual({ label: 'Conservative', color: '#22c55e' }))

  it('returns Balanced for 5', () =>
    expect(getRiskLabel(5)).toEqual({ label: 'Balanced', color: '#f59e0b' }))

  it('returns Balanced for 6', () =>
    expect(getRiskLabel(6)).toEqual({ label: 'Balanced', color: '#f59e0b' }))

  it('returns Aggressive for 7', () =>
    expect(getRiskLabel(7)).toEqual({ label: 'Aggressive', color: '#f97316' }))

  it('returns Aggressive for 8', () =>
    expect(getRiskLabel(8)).toEqual({ label: 'Aggressive', color: '#f97316' }))

  it('returns Very aggressive for 9', () =>
    expect(getRiskLabel(9)).toEqual({ label: 'Very aggressive', color: '#ef4444' }))

  it('returns Very aggressive for 10', () =>
    expect(getRiskLabel(10)).toEqual({ label: 'Very aggressive', color: '#ef4444' }))
})
