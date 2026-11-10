/**
 * UUID validation utility.
 * Threadline requires standard 36-character hexadecimal UUIDs for database entities.
 */
const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isValidUUID(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  return UUID_REGEX.test(val.trim());
}

