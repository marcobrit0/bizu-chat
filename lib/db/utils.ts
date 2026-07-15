import { generateId } from "ai";
import { genSaltSync, hashSync } from "bcrypt-ts";

export function generateHashedPassword(password: string) {
  const salt = genSaltSync(10);
  const hash = hashSync(password, salt);

  return hash;
}

export function generateDummyPassword() {
  const password = generateId();
  const hashedPassword = generateHashedPassword(password);

  return hashedPassword;
}

/**
 * Collision-safe guest email. `Date.now()` collided when two guests were
 * provisioned in the same millisecond. Length: 6 + 36 + 11 = 53 <= varchar(64).
 */
export function buildGuestEmail() {
  return `guest-${crypto.randomUUID()}@bizu.local`;
}
