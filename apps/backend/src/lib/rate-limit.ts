import { redis, keys } from "@/db/dragonfly";
import { Errors } from "./errors";

interface Options {
  bucket: string;
  limit: number;
  windowSec: number;
}

export async function enforceRateLimit(identity: string, opts: Options): Promise<void> {
  const key = keys.rateLimit(opts.bucket, identity);
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, opts.windowSec);
  if (count > opts.limit) throw Errors.tooMany(`Rate limit exceeded for ${opts.bucket}`);
}
