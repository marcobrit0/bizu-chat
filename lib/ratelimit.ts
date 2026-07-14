import { createClient } from "redis";

import { isProductionEnvironment } from "@/lib/constants";
import { ChatbotError } from "@/lib/errors";

const MAX_MESSAGES = 10;
const TTL_SECONDS = 60 * 60;

type RedisClient = ReturnType<typeof createClient>;

let clientPromise: Promise<RedisClient> | null = null;

function getClient(): Promise<RedisClient> | null {
  if (!process.env.REDIS_URL) {
    return null;
  }

  if (!clientPromise) {
    const client = createClient({ url: process.env.REDIS_URL });
    client.on("error", () => undefined);
    clientPromise = client
      .connect()
      .then(() => client as RedisClient)
      .catch((error) => {
        // Allow a later request to retry the connection.
        clientPromise = null;
        throw error;
      });
  }

  return clientPromise;
}

/**
 * Per-IP abuse brake. Fails CLOSED: if Redis is unreachable in production we
 * reject rather than serve unmetered inference on the AI Gateway bill.
 */
export async function checkIpRateLimit(ip: string | undefined) {
  if (!isProductionEnvironment) {
    return;
  }

  if (!ip) {
    throw new ChatbotError("rate_limit:chat");
  }

  let redis: RedisClient;
  try {
    const pending = getClient();
    if (!pending) {
      throw new Error("REDIS_URL is not configured");
    }
    redis = await pending;
  } catch (error) {
    throw new ChatbotError("rate_limit:chat", { cause: error });
  }

  let count: unknown;
  try {
    [count] = await redis
      .multi()
      .incr(`ip-rate-limit:${ip}`)
      .expire(`ip-rate-limit:${ip}`, TTL_SECONDS, "NX")
      .exec();
  } catch (error) {
    throw new ChatbotError("rate_limit:chat", { cause: error });
  }

  if (typeof count === "number" && count > MAX_MESSAGES) {
    throw new ChatbotError("rate_limit:chat");
  }
}
