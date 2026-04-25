import { ERROR_CODES, failure } from '../utils/errorHandler.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,50}$/;

export function validateEmail(email) {
  if (!email || !EMAIL_RE.test(email))
    return failure(ERROR_CODES.INVALID_EMAIL, 'Invalid email format.');
  return null;
}

export function validatePassword(password) {
  if (!password || !PASSWORD_RE.test(password))
    return failure(
      ERROR_CODES.WEAK_PASSWORD,
      'Password must be at least 8 characters with 1 uppercase letter, 1 number, and 1 special character.'
    );
  return null;
}

export function validateUsername(username) {
  if (!username || !USERNAME_RE.test(username))
    return failure(
      ERROR_CODES.INVALID_USERNAME,
      'Username must be 3-50 characters, letters, numbers, and underscores only.'
    );
  return null;
}
