import { v4 as uuidv4 } from 'uuid';

export function generateSessionToken() {
  return uuidv4();
}

export function sessionExpiry(hours = 24) {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hours);
  return expiry.toISOString();
}
