import bcrypt from "bcryptjs";

const ROUNDS = 10;

/* Compared against when the email is unknown, so that a wrong email and a
   wrong password take about the same time and give the same answer. */
let dummyHash: Promise<string> | undefined;

export function hashPassword(password: string) {
  return bcrypt.hash(password, ROUNDS);
}

export async function verifyPassword(password: string, hash: string | null | undefined) {
  if (!hash) {
    dummyHash ??= bcrypt.hash("petjet-unknown-account", ROUNDS);
    await bcrypt.compare(password, await dummyHash);
    return false;
  }
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
