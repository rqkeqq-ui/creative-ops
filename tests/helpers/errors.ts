import { expect } from 'vitest'
import { AppError } from '@/lib/services/errors'

export async function expectAppError(fn: () => unknown, code: string): Promise<AppError> {
  try {
    await fn()
  } catch (error) {
    expect(error).toBeInstanceOf(AppError)
    const appError = error as AppError
    expect(appError.code, `expected code ${code}, got ${appError.code}: ${appError.message}`).toBe(code)
    return appError
  }
  throw new Error(`Expected AppError with code ${code}, but call succeeded`)
}