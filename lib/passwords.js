'use strict';
/**
 * Password hashing with Node's built-in scrypt. The cost parameters are stored
 * inside each hash string, so the default can change later without breaking
 * existing users. Format: scrypt$N$r$p$saltB64$hashB64
 */
const crypto = require('crypto');

const DEFAULTS = { N: 1 << 16, r: 8, p: 1, keyLen: 32, saltLen: 16 };
const MIN_LENGTH = 12;
const COMMON = new Set([
  'password1234', 'password12345', '123456789012', 'qwertyuiop12', 'letmein12345',
  'administrator', 'changemenow1', 'welcome12345', 'iloveyou1234', 'markstack1234',
]);

function params(opts) { return { ...DEFAULTS, ...(opts || {}) }; }

function maxmem(P) { return 128 * P.N * P.r + (1 << 20) * 2; }

function derive(password, salt, P) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password.normalize('NFKC'), salt, P.keyLen, { N: P.N, r: P.r, p: P.p, maxmem: maxmem(P) },
      (err, key) => (err ? reject(err) : resolve(key)));
  });
}

/** Returns null when the password is acceptable, otherwise a short reason. */
function checkPasswordPolicy(password) {
  if (typeof password !== 'string') return 'Password must be text.';
  if (password.length < MIN_LENGTH) return `Password must be at least ${MIN_LENGTH} characters.`;
  if (password.length > 256) return 'Password is too long.';
  if (COMMON.has(password.toLowerCase())) return 'That password is too common.';
  return null;
}

async function hashPassword(password, opts) {
  const P = params(opts);
  const salt = crypto.randomBytes(P.saltLen);
  const key = await derive(password, salt, P);
  return ['scrypt', P.N, P.r, P.p, salt.toString('base64'), key.toString('base64')].join('$');
}

async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const P = { N: +N, r: +r, p: +p };
  // Refuse absurd costs from a tampered file so it cannot exhaust memory.
  if (!(P.N >= 1024 && P.N <= (1 << 20) && (P.N & (P.N - 1)) === 0 && P.r >= 1 && P.r <= 16 && P.p >= 1 && P.p <= 4)) return false;
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  if (salt.length < 8 || expected.length < 16) return false;
  const key = await derive(password, salt, { ...P, keyLen: expected.length });
  return crypto.timingSafeEqual(key, expected);
}

module.exports = { hashPassword, verifyPassword, checkPasswordPolicy, MIN_LENGTH, DEFAULTS };
