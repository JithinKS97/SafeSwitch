import { describe, it, expect } from 'vitest'
import { pctToRisk, getRiskLabel } from './utils'

describe('pctToRisk', () => {
  it('returns LOW for 0', () => expect(pctToRisk(0)).toBe('LOW'))
  it('returns LOW for 33', () => expect(pctToRisk(33)).toBe('LOW'))
  it('returns MEDIUM for 34', () => expect(pctToRisk(34)).toBe('MEDIUM'))
  it('returns MEDIUM for 66', () => expect(pctToRisk(66)).toBe('MEDIUM'))
  it('returns HIGH for 67', () => expect(pctToRisk(67)).toBe('HIGH'))
  it('returns HIGH for 100', () => expect(pctToRisk(100)).toBe('HIGH'))
})

describe('getRiskLabel', () => {
  it('returns Very conservative for 0', () =>
    expect(getRiskLabel(0)).toEqual({ label: 'Very conservative', color: '#16a34a' }))

  it('returns Very conservative for 20', () =>
    expect(getRiskLabel(20)).toEqual({ label: 'Very conservative', color: '#16a34a' }))

  it('returns Conservative for 21', () =>
    expect(getRiskLabel(21)).toEqual({ label: 'Conservative', color: '#22c55e' }))

  it('returns Conservative for 40', () =>
    expect(getRiskLabel(40)).toEqual({ label: 'Conservative', color: '#22c55e' }))

  it('returns Balanced for 41', () =>
    expect(getRiskLabel(41)).toEqual({ label: 'Balanced', color: '#f59e0b' }))

  it('returns Balanced for 60', () =>
    expect(getRiskLabel(60)).toEqual({ label: 'Balanced', color: '#f59e0b' }))

  it('returns Aggressive for 61', () =>
    expect(getRiskLabel(61)).toEqual({ label: 'Aggressive', color: '#f97316' }))

  it('returns Aggressive for 80', () =>
    expect(getRiskLabel(80)).toEqual({ label: 'Aggressive', color: '#f97316' }))

  it('returns Very aggressive for 81', () =>
    expect(getRiskLabel(81)).toEqual({ label: 'Very aggressive', color: '#ef4444' }))

  it('returns Very aggressive for 100', () =>
    expect(getRiskLabel(100)).toEqual({ label: 'Very aggressive', color: '#ef4444' }))
})
