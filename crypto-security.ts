import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const appDir = (() => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      return path.dirname(fileURLToPath(import.meta.url));
    }
  } catch {}
  return process.cwd();
})();

const getKeyFilePath = () => {
  const rootKey = path.join(process.cwd(), '.encryption-key');
  if (fs.existsSync(rootKey)) return rootKey;
  const dirKey = path.join(appDir, '.encryption-key');
  if (fs.existsSync(dirKey)) return dirKey;
  const parentKey = path.join(appDir, '..', '.encryption-key');
  if (fs.existsSync(parentKey)) return parentKey;
  return rootKey;
};

// Persistent key storage file to guarantee identical keys across server restarts
const KEY_FILE = getKeyFilePath();

interface KeyStore {
  aesKeyHex: string;
  hmacKeyHex: string;
}

function loadOrGenerateKeys(): { aesKey: Buffer; hmacKey: Buffer } {
  // Check if keys are provided via environment variables
  if (process.env.APP_ENCRYPTION_KEY && process.env.APP_HMAC_KEY) {
    const aesKey = Buffer.from(process.env.APP_ENCRYPTION_KEY, 'hex');
    const hmacKey = Buffer.from(process.env.APP_HMAC_KEY, 'hex');
    if (aesKey.length === 32 && hmacKey.length === 32) {
      return { aesKey, hmacKey };
    }
  }

  // Load from local file if exists
  if (fs.existsSync(KEY_FILE)) {
    try {
      const data: KeyStore = JSON.parse(fs.readFileSync(KEY_FILE, 'utf-8'));
      if (data.aesKeyHex && data.hmacKeyHex) {
        const aesKey = Buffer.from(data.aesKeyHex, 'hex');
        const hmacKey = Buffer.from(data.hmacKeyHex, 'hex');
        if (aesKey.length === 32 && hmacKey.length === 32) {
          return { aesKey, hmacKey };
        }
      }
    } catch (e) {
      console.warn('[Crypto] Could not read existing key file, generating new keys...');
    }
  }

  // Generate new 256-bit cryptographically secure keys
  const aesKey = crypto.randomBytes(32);
  const hmacKey = crypto.randomBytes(32);

  try {
    const data: KeyStore = {
      aesKeyHex: aesKey.toString('hex'),
      hmacKeyHex: hmacKey.toString('hex')
    };
    fs.writeFileSync(KEY_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
  } catch (err) {
    console.error('[Crypto] Failed to save encryption keys to file:', err);
  }

  return { aesKey, hmacKey };
}

const { aesKey: MASTER_AES_KEY, hmacKey: MASTER_HMAC_KEY } = loadOrGenerateKeys();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 96 bits for GCM
const PREFIX = 'enc:v1:';

/**
 * Encrypts a string using AES-256-GCM.
 * Output format: enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
 */
export function encryptData(plaintext: string | null | undefined): string {
  if (plaintext === null || plaintext === undefined || plaintext === '') {
    return '';
  }

  // If already encrypted, return as is
  if (typeof plaintext === 'string' && plaintext.startsWith(PREFIX)) {
    return plaintext;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, MASTER_AES_KEY, iv);

  let ciphertext = cipher.update(String(plaintext), 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  return `${PREFIX}${iv.toString('hex')}:${authTag}:${ciphertext}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * If data is not encrypted (e.g. legacy plain text), returns it directly.
 */
export function decryptData(encryptedText: string | null | undefined): string {
  if (!encryptedText || typeof encryptedText !== 'string') {
    return '';
  }

  // If not encrypted with our format, return as is (graceful fallback)
  if (!encryptedText.startsWith(PREFIX)) {
    return encryptedText;
  }

  try {
    const parts = encryptedText.slice(PREFIX.length).split(':');
    if (parts.length !== 3) {
      return encryptedText;
    }

    const [ivHex, tagHex, cipherHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, MASTER_AES_KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (err) {
    // Graceful fallback if data was encrypted with an older temporary key
    return '';
  }
}

/**
 * Computes an HMAC-SHA256 blind index hash for exact searches (CPF, Phone)
 * Ensures consistent lookup while data remains encrypted in storage.
 */
export function computeBlindIndex(value: string | null | undefined): string {
  if (!value) return '';
  const clean = String(value).replace(/\D/g, '').trim();
  if (!clean) return '';
  return crypto.createHmac('sha256', MASTER_HMAC_KEY).update(clean).digest('hex');
}

/**
 * Computes an HMAC-SHA256 hash for emails or usernames
 */
export function computeStringIndex(value: string | null | undefined): string {
  if (!value) return '';
  const clean = String(value).trim().toLowerCase();
  return crypto.createHmac('sha256', MASTER_HMAC_KEY).update(clean).digest('hex');
}

/**
 * Securely hashes a password using scrypt with a random salt.
 * Output format: scrypt:v1:<salt_hex>:<hash_hex>
 */
export function hashPassword(password: string): string {
  if (!password) return '';
  const salt = crypto.randomBytes(16);
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `scrypt:v1:${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

/**
 * Verifies a password against a stored hash or legacy plaintext.
 */
export function verifyPassword(password: string, storedHashOrPlain: string | null | undefined): boolean {
  if (!password || !storedHashOrPlain) return false;

  if (storedHashOrPlain.startsWith('scrypt:v1:')) {
    const parts = storedHashOrPlain.split(':');
    if (parts.length !== 4) return false;
    const salt = Buffer.from(parts[2], 'hex');
    const originalHash = Buffer.from(parts[3], 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);

    try {
      return crypto.timingSafeEqual(originalHash, derivedKey);
    } catch {
      return false;
    }
  }

  // Legacy plaintext fallback:
  return password === storedHashOrPlain;
}

/**
 * Formats a CPF with privacy mask (e.g. 123.***.***-45)
 */
export function maskCPF(cpf: string | null | undefined): string {
  if (!cpf) return '';
  const digits = String(cpf).replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.***.***-${digits.slice(9, 11)}`;
}
