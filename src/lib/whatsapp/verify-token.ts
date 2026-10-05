import crypto from 'node:crypto'
import { encrypt } from './encryption'

/** Decide what whatsapp_config.verify_token should hold after a config save. */
export function resolveVerifyTokenForSave(
  incoming: string | null | undefined,
  existingEncrypted: string | null,
): string | null {
  const trimmed = typeof incoming === 'string' ? incoming.trim() : ''
  if (trimmed) return encrypt(trimmed)
  return existingEncrypted ?? null
}

/**
 * Deterministic lookup key for webhook verification.
 *
 * The encrypted token uses a random IV, so it cannot be indexed. HMAC keeps
 * the plaintext verification token out of the database while giving the
 * webhook GET route an indexed equality lookup.
 */
export function hashVerifyToken(token: string): string {
  const key = process.env.ENCRYPTION_KEY
  if (!key) throw new Error('ENCRYPTION_KEY is required')
  return crypto
    .createHmac('sha256', Buffer.from(key, 'hex'))
    .update(token, 'utf8')
    .digest('hex')
}