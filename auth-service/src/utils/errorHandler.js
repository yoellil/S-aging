export const ERROR_CODES = {
  INVALID_CREDENTIALS:    'invalid_credentials',
  USER_NOT_FOUND:         'user_not_found',
  EMAIL_EXISTS:           'email_exists',
  USERNAME_EXISTS:        'username_exists',
  SESSION_EXPIRED:        'session_expired',
  INVALID_TOKEN:          'invalid_token',
  WEAK_PASSWORD:          'weak_password',
  INVALID_EMAIL:          'invalid_email',
  INVALID_USERNAME:       'invalid_username',
  SERVER_ERROR:           'server_error',
  // ── Logout ──
  ALREADY_LOGGED_OUT:     'already_logged_out',
  UNAUTHORIZED:           'unauthorized',
  // ── Profile ──
  VALIDATION_FAILED:      'validation_failed',
  USERNAME_TAKEN:         'username_taken',
  PASSWORD_SAME:          'password_same_as_current',
  INVALID_CURRENT_PASSWORD: 'invalid_current_password',
  // ── File upload ──
  INVALID_FILE_TYPE:      'invalid_file_type',
  FILE_TOO_LARGE:         'file_too_large',
  INVALID_DIMENSIONS:     'invalid_dimensions',
  UPLOAD_FAILED:          'upload_failed',
  NO_PICTURE_FOUND:       'no_picture_found',
};

export function success(data, message = 'OK') {
  return { success: true, data, message };
}

export function failure(error, message) {
  return { success: false, error, message };
}
