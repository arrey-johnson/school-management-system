import argon2 from "argon2";

export function hashPassword(plain: string, testMode: boolean): Promise<string> {
  if (testMode) {
    return argon2.hash(plain, {
      type: argon2.argon2id,
      memoryCost: 2 ** 12,
      timeCost: 2,
      parallelism: 1,
    });
  }
  return argon2.hash(plain, { type: argon2.argon2id });
}

export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}
