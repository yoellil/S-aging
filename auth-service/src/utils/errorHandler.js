export const ERROR_CODES = {
  INVALID_CREDENTIALS: 'invalid_credentials',
  USER_NOT_FOUND:      'user_not_found',
  EMAIL_EXISTS:        'email_exists',
  USERNAME_EXISTS:     'username_exists',
  SESSION_EXPIRED:     'session_expired',
  INVALID_TOKEN:       'invalid_token',
  WEAK_PASSWORD:       'weak_password',
  INVALID_EMAIL:       'invalid_email',
  INVALID_USERNAME:    'invalid_username',
  SERVER_ERROR:        'server_error',
};

export function success(data, message = 'OK') {
  return { success: true, data, message };
}

export function failure(error, message) {
  return { success: false, error, message };
}
