/** Minimal bitset utilities over a byte buffer — index 0 = LSB of byte 0. */
export function emptyBitmap(totalBits: number): Buffer {
  return Buffer.alloc(Math.ceil(totalBits / 8));
}

export function setBit(buf: Buffer, i: number): Buffer {
  const byte = i >> 3;
  const bit = i & 7;
  if (byte >= buf.length) {
    const grown = Buffer.alloc(byte + 1);
    buf.copy(grown);
    buf = grown;
  }
  buf[byte]! |= 1 << bit;
  return buf;
}

export function getBit(buf: Buffer, i: number): boolean {
  const byte = i >> 3;
  if (byte >= buf.length) return false;
  return (buf[byte]! & (1 << (i & 7))) !== 0;
}

export function missingBits(buf: Buffer, totalBits: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < totalBits; i++) if (!getBit(buf, i)) out.push(i);
  return out;
}

export function countSet(buf: Buffer, totalBits: number): number {
  let n = 0;
  for (let i = 0; i < totalBits; i++) if (getBit(buf, i)) n++;
  return n;
}
