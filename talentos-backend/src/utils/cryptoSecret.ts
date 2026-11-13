import crypto from 'crypto';

const ENCRYPTED_PREFIX = 'enc:v1:';
const KNOWN_INSECURE_SETTINGS_KEYS = new Set([
  'dev_secret_key',
  'changeme',
  'your_settings_encryption_key',
  'replace-with-random-32-byte-secret',
]);

function deriveSettingsAesKey(): Buffer {
  const configured = (process.env.SETTINGS_ENCRYPTION_KEY || '').trim();
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    if (
      !configured ||
      configured.length < 16 ||
      KNOWN_INSECURE_SETTINGS_KEYS.has(configured.toLowerCase()) ||
      configured.toLowerCase().includes('replace-with')
    ) {
      throw new Error(
        'FATAL: SETTINGS_ENCRYPTION_KEY (minimum 16 characters) must be configured in production.'
      );
    }
  }

  const rawMaterial = configured || process.env.JWT_ACCESS_SECRET || 'talentos-dev-settings-encryption-key';
  return crypto.createHash('sha256').update(rawMaterial, 'utf8').digest();
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) return '';
  if (plaintext.startsWith(ENCRYPTED_PREFIX)) {
    return plaintext;
  }

  const key = deriveSettingsAesKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${iv.toString('base64url')}:${authTag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptSecret(stored: string): string {
  if (!stored) return '';
  if (!stored.startsWith(ENCRYPTED_PREFIX)) {
    // Legacy unencrypted row prior to encryption rollout
    return stored;
  }

  const payload = stored.slice(ENCRYPTED_PREFIX.length);
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted secret payload');
  }

  const [ivB64, tagB64, dataB64] = parts;
  const key = deriveSettingsAesKey();
  const iv = Buffer.from(ivB64, 'base64url');
  const authTag = Buffer.from(tagB64, 'base64url');
  const encrypted = Buffer.from(dataB64, 'base64url');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

export function escapeHtml(input: unknown): string {
  const str = String(input ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeEmailHtml(html: string): string {
  return String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed\b[^>]*\/?>/gi, '')
    .replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(['"])\s*(?:javascript|vbscript|data:text\/html):[^'"]*\2/gi, '$1=$2#$2');
}

