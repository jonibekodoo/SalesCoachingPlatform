import crypto from 'crypto';

export const newId = (prefix = '') => {
  const ts = Date.now().toString(36);
  const rnd = crypto.randomBytes(5).toString('hex');
  return prefix ? `${prefix}_${ts}${rnd}` : `${ts}${rnd}`;
};

// API tokens: plaintext is shown once, only the hash is stored
export const newApiToken = () => `sci_${crypto.randomBytes(24).toString('hex')}`;
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
export const tokenPrefix = (token) => token.slice(0, 10);

export const nowIso = () => new Date().toISOString();
