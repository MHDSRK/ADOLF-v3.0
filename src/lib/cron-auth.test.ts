import { beforeEach, describe, expect, it } from 'vitest'
import { requireCronSecret } from './cron-auth'

describe('requireCronSecret', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-cron-secret'
  })

  it('rejects missing credentials', () => {
    const response = requireCronSecret(new Request('https://example.test/api/cron'))
    expect(response?.status).toBe(401)
  })

  it('accepts the Bearer form used by the scheduler', () => {
    const response = requireCronSecret(
      new Request('https://example.test/api/cron', {
        headers: { authorization: 'Bearer test-cron-secret' },
      }),
    )
    expect(response).toBeNull()
  })

  it('accepts the legacy external-pinger header for compatibility', () => {
    const response = requireCronSecret(
      new Request('https://example.test/api/cron', {
        headers: { 'x-cron-secret': 'test-cron-secret' },
      }),
    )
    expect(response).toBeNull()
  })
})
