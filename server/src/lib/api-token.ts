// API-Token-Helpers: prefix-prefixed, hashed-at-rest, niemals im Klartext gespeichert.
// Format: btm_<22-char-base62>  → User sieht den Token genau einmal beim Erstellen.

import { createHash, randomBytes } from 'node:crypto';

const PREFIX = 'btm_';
const ENTROPY_BYTES = 24; // 192 bit, in Base64URL ~32 chars

export function generateApiToken(): { plain: string; hash: string; prefix: string } {
  const buf = randomBytes(ENTROPY_BYTES);
  const body = buf.toString('base64url');
  const plain = `${PREFIX}${body}`;
  const hash = hashApiToken(plain);
  const prefix = plain.slice(0, 12); // "btm_xxxxxxxx" — gut genug für Disambiguierung in der UI
  return { plain, hash, prefix };
}

export function hashApiToken(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}
