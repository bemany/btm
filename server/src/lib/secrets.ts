// AES-256-GCM Encrypt/Decrypt für sensible Per-User-Strings (aktuell nur
// Odoo-API-Keys, kann später für weitere Integrations erweitert werden).
//
// Master-Key wird aus BETTER_AUTH_SECRET via scrypt abgeleitet — kein
// separater Schlüssel-Lebenszyklus, kein KMS. Akzeptable Stufe für unser
// Threat-Modell (interner Tool, Postgres-Dump-Schutz). Bei Master-Leak
// sind alle abgelegten Secrets lesbar, aber dann sind sowieso auch alle
// Better-Auth-Sessions kompromittiert.
//
// Format pro Record:
//   enc: <ciphertext>:<auth-tag>  (hex-encoded, ':'-separiert)
//   iv:  12-Byte-Random (hex-encoded)

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const SALT = 'btm-secrets-v1';
const KEY_LENGTH = 32; // AES-256
const IV_LENGTH = 12;  // 12 Byte für GCM-Standard
const TAG_LENGTH = 16; // 128-bit Auth-Tag

let derivedKey: Buffer | null = null;

function getKey(): Buffer {
  if (derivedKey) return derivedKey;
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      `BETTER_AUTH_SECRET muss mindestens 32 Zeichen sein (ist ${secret?.length ?? 0}). ` +
      `Wird als Master-Key für die Secrets-Verschlüsselung genutzt.`,
    );
  }
  derivedKey = scryptSync(secret, SALT, KEY_LENGTH);
  return derivedKey;
}

export interface EncryptedSecret {
  enc: string; // ciphertext:tag in hex
  iv: string;  // hex
}

export function encryptSecret(plain: string): EncryptedSecret {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    enc: `${ct.toString('hex')}:${tag.toString('hex')}`,
    iv: iv.toString('hex'),
  };
}

export function decryptSecret(enc: string, iv: string): string {
  const [ctHex, tagHex] = enc.split(':');
  if (!ctHex || !tagHex || tagHex.length !== TAG_LENGTH * 2) {
    throw new Error('Invalid encrypted secret format');
  }
  const decipher = createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const pt = Buffer.concat([decipher.update(Buffer.from(ctHex, 'hex')), decipher.final()]);
  return pt.toString('utf-8');
}
