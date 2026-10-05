import { timingSafeEqual } from 'node:crypto'

export function requireCronSecret(request: Request): Response | null {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('[cron] CRON_SECRET is not configured')
    return Response.json({ error: 'cron not configured' }, { status: 503 })
  }

  const authorization = request.headers.get('authorization') ?? ''
  const bearer = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : ''
  const supplied = request.headers.get('x-cron-secret') ?? bearer

  const a = Buffer.from(supplied)
  const b = Buffer.from(expected)
  const valid = a.length === b.length && timingSafeEqual(a, b)

  return valid ? null : Response.json({ error: 'Unauthorized' }, { status: 401 })
}
