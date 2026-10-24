import 'dotenv/config';
import path from 'path';

const required = (name, fallback) => {
  const v = process.env[name];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing env var ${name}`);
  }
  return v;
};

export const config = {
  port: Number(process.env.PORT) || 4000,
  adminUsername: required('ADMIN_USERNAME', 'admin'),
  adminPassword: required('ADMIN_PASSWORD'),
  jwtSecret: required('JWT_SECRET'),
  dataDir: path.resolve(process.cwd(), process.env.DATA_DIR || 'data'),
  envGeminiKey: process.env.GEMINI_API_KEY || '',
  isProd: process.env.NODE_ENV === 'production',
  // Max upload size for audio (bytes)
  maxAudioBytes: 60 * 1024 * 1024,
  // Billing is per started minute
  billingUnitSeconds: 60,
};
