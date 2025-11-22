import crypto from 'crypto';

const CREDENTIAL_SECRET = process.env.USER_CREDENTIALS_KEY ?? process.env.NEXTAUTH_SECRET;

if (!CREDENTIAL_SECRET) {
  console.warn(
    '[crypto] USER_CREDENTIALS_KEY or NEXTAUTH_SECRET must be set to encrypt sensitive data.',
  );
}

const KEY = CREDENTIAL_SECRET
  ? crypto.createHash('sha256').update(CREDENTIAL_SECRET).digest()
  : null;

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export function encryptPayload<T>(data: T): string {
  if (!KEY) {
    throw new Error('Credential encryption key unavailable');
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  const json = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join('.');
}

export function decryptPayload<T>(payload: string): T {
  if (!KEY) {
    throw new Error('Credential encryption key unavailable');
  }
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error('Invalid encrypted payload');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const encrypted = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}


