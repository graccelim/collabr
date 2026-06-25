import { describe, it, expect } from 'vitest'
import {
  evaluateCertification,
  CERT_THRESHOLDS,
  type CertFacts,
} from '@/lib/certification/criteria'

// Collabr Certified rules engine. Facts-only, hysteresis, "hard to lose".

// A creator who clears every strict earn threshold.
const passing: CertFacts = {
  completed: 8,
  reviews: 7,
  ratingAvg: 4.8,
  completionRate: 0.98,
  disputeRate: 0,
  unresolvedDisputes: 0,
  responseMedianHours: 12,
}

describe('evaluateCertification — earning the badge', () => {
  it('grants when all strict thresholds are met', () => {
    const r = evaluateCertification(passing, 'none')
    expect(r.certified).toBe(true)
    expect(r.status).toBe('certified')
    expect(r.suspendedReason).toBeNull()
  })

  it('new creator with no history is not certified (and not shown negatively)', () => {
    const r = evaluateCertification(
      { completed: 0, reviews: 0, ratingAvg: 0, completionRate: null, disputeRate: null, unresolvedDisputes: 0, responseMedianHours: null },
      'none',
    )
    expect(r.certified).toBe(false)
    expect(r.status).toBe('none')
  })

  it('does not grant just below the bar (rating 4.5 < 4.6)', () => {
    const r = evaluateCertification({ ...passing, ratingAvg: 4.5 }, 'none')
    expect(r.certified).toBe(false)
    expect(r.criteria.rating).toBe(false)
  })

  it('does not grant with fewer than 5 completed', () => {
    expect(evaluateCertification({ ...passing, completed: 4 }, 'none').certified).toBe(false)
  })

  it('missing response history does not block earning (insufficient data passes)', () => {
    const r = evaluateCertification({ ...passing, responseMedianHours: null }, 'none')
    expect(r.certified).toBe(true)
    expect(r.criteria.responsive).toBe(true)
  })
})

describe('evaluateCertification — hysteresis (hard to lose)', () => {
  it('one bad review (rating dips to 4.5, inside the band) keeps a certified creator', () => {
    const r = evaluateCertification({ ...passing, ratingAvg: 4.5 }, 'certified')
    expect(r.certified).toBe(true)
    expect(r.status).toBe('certified')
  })

  it('completion at 92% (≥90% suspend band) keeps a certified creator', () => {
    const r = evaluateCertification({ ...passing, completionRate: 0.92 }, 'certified')
    expect(r.certified).toBe(true)
  })

  it('suspends only when clearly under: rating below 4.4', () => {
    const r = evaluateCertification({ ...passing, ratingAvg: 4.3 }, 'certified')
    expect(r.certified).toBe(false)
    expect(r.status).toBe('suspended')
    expect(r.suspendedReason).toMatch(/rating/i)
  })

  it('suspends on any unresolved dispute immediately', () => {
    const r = evaluateCertification({ ...passing, unresolvedDisputes: 1 }, 'certified')
    expect(r.certified).toBe(false)
    expect(r.status).toBe('suspended')
    expect(r.suspendedReason).toMatch(/dispute/i)
  })

  it('suspends when completion falls below 90%', () => {
    expect(evaluateCertification({ ...passing, completionRate: 0.89 }, 'certified').status).toBe('suspended')
  })

  it('suspends when dispute rate rises above 4%', () => {
    expect(evaluateCertification({ ...passing, disputeRate: 0.05 }, 'certified').status).toBe('suspended')
  })

  it('suspends when median response exceeds 72h', () => {
    expect(evaluateCertification({ ...passing, responseMedianHours: 80 }, 'certified').status).toBe('suspended')
  })

  it('a suspended creator regains the badge once back above the strict bar', () => {
    const r = evaluateCertification(passing, 'suspended')
    expect(r.certified).toBe(true)
    expect(r.status).toBe('certified')
  })

  it('a suspended creator still under the bar stays suspended (not reset to none)', () => {
    const r = evaluateCertification({ ...passing, ratingAvg: 4.3 }, 'suspended')
    expect(r.certified).toBe(false)
    expect(r.status).toBe('suspended')
  })
})

describe('facts-only guarantee (no scores / rankings / percentiles)', () => {
  it('result exposes only facts-based fields and boolean criteria — never a numeric grade', () => {
    const r = evaluateCertification(passing, 'none')
    expect(Object.keys(r).sort()).toEqual(['certified', 'criteria', 'status', 'suspendedReason'])
    // No "score"/"percentile"/"rank" anywhere in the output shape.
    const json = JSON.stringify(r).toLowerCase()
    expect(json).not.toMatch(/score|percentile|rank/)
    // Every criterion is a boolean (met / not met), not a number.
    expect(Object.values(r.criteria).every((v) => typeof v === 'boolean')).toBe(true)
  })

  it('thresholds match the confirmed Phase-1 spec', () => {
    expect(CERT_THRESHOLDS.earn).toMatchObject({
      completed: 5, reviews: 5, rating: 4.6, completionRate: 0.95, disputeRate: 0.02, unresolvedDisputes: 0, responseHours: 48,
    })
    expect(CERT_THRESHOLDS.suspend).toMatchObject({
      rating: 4.4, completionRate: 0.9, disputeRate: 0.04, unresolvedDisputes: 1, responseHours: 72,
    })
  })
})
