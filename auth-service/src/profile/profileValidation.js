import { ERROR_CODES, failure } from '../utils/errorHandler.js';

// ── Regex patterns ──────────────────────────────────────────────────────────
const USERNAME_RE  = /^[a-zA-Z0-9_]{3,50}$/;
const PASSWORD_RE  = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;
const FULL_NAME_RE = /^[a-zA-ZÀ-ÿ\s\-']{1,255}$/;
const PHONE_RE     = /^[+\d][\d\s\-]{9,19}$/;

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MIN_DIMENSION = 200;             // 200×200 px

// ── Validators ──────────────────────────────────────────────────────────────

export function validateNewUsername(username) {
  if (!username || typeof username !== 'string') {
    return failure(ERROR_CODES.VALIDATION_FAILED, 'Username is required.');
  }
  const trimmed = username.trim();
  if (!USERNAME_RE.test(trimmed)) {
    return failure(
      ERROR_CODES.VALIDATION_FAILED,
      'Username must be 3-50 characters, letters, numbers, and underscores only.'
    );
  }
  return null; // valid
}

export function validateNewPassword(password, username = null) {
  if (!password || typeof password !== 'string') {
    return failure(ERROR_CODES.VALIDATION_FAILED, 'Password is required.');
  }
  if (!PASSWORD_RE.test(password)) {
    return failure(
      ERROR_CODES.WEAK_PASSWORD,
      'Password must be at least 8 characters with 1 uppercase, 1 lowercase, 1 number, and 1 special character.'
    );
  }
  if (username && password.toLowerCase().includes(username.toLowerCase())) {
    return failure(ERROR_CODES.WEAK_PASSWORD, 'Password must not contain your username.');
  }
  return null;
}

export function validateFullName(name) {
  if (!name || typeof name !== 'string') return null; // optional field
  const trimmed = name.trim();
  if (trimmed.length === 0) return null; // allow clearing
  if (!FULL_NAME_RE.test(trimmed)) {
    return failure(
      ERROR_CODES.VALIDATION_FAILED,
      'Full name must be 1-255 characters. Only letters, spaces, hyphens, and apostrophes allowed.'
    );
  }
  return null;
}

export function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') return null; // optional
  const trimmed = phone.trim();
  if (trimmed.length === 0) return null; // allow clearing
  if (!PHONE_RE.test(trimmed)) {
    return failure(
      ERROR_CODES.VALIDATION_FAILED,
      'Phone must be 10-20 characters. Only digits, spaces, hyphens, and a leading plus sign allowed.'
    );
  }
  return null;
}

export function validateBio(bio) {
  if (!bio || typeof bio !== 'string') return null;
  if (bio.length > 500) {
    return failure(ERROR_CODES.VALIDATION_FAILED, 'Bio must be 500 characters or fewer.');
  }
  return null;
}

export function validateProfilePicture(file) {
  if (!file) {
    return failure(ERROR_CODES.VALIDATION_FAILED, 'No file provided.');
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    return failure(
      ERROR_CODES.INVALID_FILE_TYPE,
      `Only JPEG, PNG, WebP, and GIF images are allowed. Received: ${file.mimetype}`
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return failure(
      ERROR_CODES.FILE_TOO_LARGE,
      `File size must be under 5 MB. Your file is ${(file.size / (1024 * 1024)).toFixed(1)} MB.`
    );
  }
  return null;
}

export { MIN_DIMENSION, ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE };
