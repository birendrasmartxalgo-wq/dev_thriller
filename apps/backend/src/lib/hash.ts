// Bun provides native argon2id via Bun.password — avoid pulling bcrypt.
export async function hashPassword(plain: string): Promise<string> {
  return Bun.password.hash(plain, { algorithm: "argon2id", memoryCost: 19456, timeCost: 2 });
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await Bun.password.verify(plain, hash);
  } catch {
    return false;
  }
}

export async function sha256Hex(data: string | ArrayBufferView | ArrayBuffer): Promise<string> {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(data as any);
  return hasher.digest("hex");
}

export function randomToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}
