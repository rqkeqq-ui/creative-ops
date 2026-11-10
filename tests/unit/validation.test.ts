import { describe, expect, it } from 'vitest'
import {
  aiUsageSchema,
  createTaskSchema,
  loginSchema,
  revisionSchema,
  submitWorkSchema,
} from '@/lib/services/validation'

const validTask = {
  offer: 'Crypto Wallet App',
  geo: 'DE, AT, CH',
  creativeType: 'ugc_video',
  quantity: 4,
  description: 'Нужны 4 UGC-видео с реальными людьми, вертикальный формат 9:16.',
  references: ['https://example.com/ref-1', 'https://example.com/ref-2'],
  priority: 'high',
  deadline: '2026-11-15T18:00:00.000Z',
}

describe('createTaskSchema', () => {
  it('accepts a complete valid payload and trims text', () => {
    const result = createTaskSchema.safeParse({ ...validTask, offer: '  Crypto Wallet App  ' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.offer).toBe('Crypto Wallet App')
      expect(result.data.references).toHaveLength(2)
    }
  })

  it('allows an empty references list', () => {
    const result = createTaskSchema.safeParse({ ...validTask, references: [] })
    expect(result.success).toBe(true)
  })

  it.each([
    ['missing offer', { ...validTask, offer: '' }],
    ['single-char offer', { ...validTask, offer: 'A' }],
    ['missing geo', { ...validTask, geo: '' }],
    ['zero quantity', { ...validTask, quantity: 0 }],
    ['negative quantity', { ...validTask, quantity: -3 }],
    ['fractional quantity', { ...validTask, quantity: 2.5 }],
    ['quantity above limit', { ...validTask, quantity: 201 }],
    ['too short description', { ...validTask, description: 'коротко' }],
    ['unknown priority', { ...validTask, priority: 'critical' }],
    ['unknown creative type', { ...validTask, creativeType: 'gif' }],
    ['unparsable deadline', { ...validTask, deadline: 'завтра' }],
    ['too many references', { ...validTask, references: Array.from({ length: 11 }, (_, i) => `https://example.com/${i}`) }],
    ['invalid reference url', { ...validTask, references: ['not a url'] }],
  ])('rejects %s', (_label, payload) => {
    expect(createTaskSchema.safeParse(payload).success).toBe(false)
  })

  it('reports field-level errors for the form', () => {
    const result = createTaskSchema.safeParse({ ...validTask, offer: '', quantity: 0 })
    expect(result.success).toBe(false)
    if (!result.success) {
      const fields = result.error.issues.map((issue) => issue.path[0])
      expect(fields).toContain('offer')
      expect(fields).toContain('quantity')
    }
  })
})

describe('submitWorkSchema', () => {
  it('requires a valid deliverable link', () => {
    expect(submitWorkSchema.safeParse({ deliverableUrl: 'https://drive.google.com/file/123' }).success).toBe(true)
    expect(submitWorkSchema.safeParse({ deliverableUrl: 'ftp://weird' }).success).toBe(false)
    expect(submitWorkSchema.safeParse({ deliverableUrl: '' }).success).toBe(false)
    expect(submitWorkSchema.safeParse({}).success).toBe(false)
  })

  it('trims the optional comment', () => {
    const result = submitWorkSchema.safeParse({
      deliverableUrl: 'https://drive.google.com/file/123',
      deliverableNote: '  4 видео, исходники в папке  ',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.deliverableNote).toBe('4 видео, исходники в папке')
  })
})

describe('revisionSchema', () => {
  it('requires a substantive comment', () => {
    expect(revisionSchema.safeParse({ comment: '' }).success).toBe(false)
    expect(revisionSchema.safeParse({ comment: 'fix' }).success).toBe(false)
    expect(revisionSchema.safeParse({ comment: 'Поменять первые 2 секунды' }).success).toBe(true)
  })
})

describe('aiUsageSchema', () => {
  it('accepts known services with positive credits', () => {
    expect(aiUsageSchema.safeParse({ service: 'Midjourney', credits: 12.5 }).success).toBe(true)
    expect(aiUsageSchema.safeParse({ service: 'Runway', credits: 1, note: 'генерация 4 клипов' }).success).toBe(true)
  })

  it('rejects zero/negative/excessive credits', () => {
    expect(aiUsageSchema.safeParse({ service: 'Midjourney', credits: 0 }).success).toBe(false)
    expect(aiUsageSchema.safeParse({ service: 'Midjourney', credits: -2 }).success).toBe(false)
    expect(aiUsageSchema.safeParse({ service: 'Midjourney', credits: 100_001 }).success).toBe(false)
    expect(aiUsageSchema.safeParse({ service: 'Midjourney', credits: Number.NaN }).success).toBe(false)
  })

  it('rejects unknown AI services', () => {
    expect(aiUsageSchema.safeParse({ service: 'UnknownAI', credits: 1 }).success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('validates email and password length', () => {
    expect(loginSchema.safeParse({ email: 'buyer@creativeops.demo', password: 'demo1234' }).success).toBe(true)
    expect(loginSchema.safeParse({ email: 'not-an-email', password: 'demo1234' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'buyer@creativeops.demo', password: '123' }).success).toBe(false)
  })
})