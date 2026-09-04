import Redis from "ioredis";

// Better Auth's SecondaryStorage interface (session cache + rate limit
// storage, ADR-001). getAndDelete/increment are required — the older
// get/set/delete-only shape isn't enough for atomic rate-limit counters.
function requireRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  return url;
}

let client: Redis | undefined;
function redis(): Redis {
  return (client ??= new Redis(requireRedisUrl()));
}

export const redisSecondaryStorage = {
  get: (key: string) => redis().get(key),
  getAndDelete: async (key: string) => {
    const value = await redis().get(key);
    if (value !== null) await redis().del(key);
    return value;
  },
  increment: async (key: string, ttl: number) => {
    const value = await redis().incr(key);
    if (value === 1) await redis().expire(key, ttl);
    return value;
  },
  set: (key: string, value: string, ttl?: number) =>
    ttl ? redis().set(key, value, "EX", ttl) : redis().set(key, value),
  delete: async (key: string) => {
    await redis().del(key);
  },
};
