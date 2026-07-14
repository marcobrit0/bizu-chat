import { createClient } from "redis";

import { isProductionEnvironment } from "@/lib/constants";
import { ChatbotError } from "@/lib/errors";

const MAX_MESSAGES = 10;
const TTL_SECONDS = 60 * 60;

/** Bounds the TCP connect attempt. */
const CONNECT_TIMEOUT_MS = 2000;
/**
 * Cap the reconnect attempts. Without this, `connect()` retries forever against
 * an unreachable server and its promise NEVER settles, so `checkIpRateLimit`
 * hangs instead of failing closed.
 */
const MAX_RECONNECT_RETRIES = 2;
const RECONNECT_BACKOFF_MS = 50;
const MAX_RECONNECT_BACKOFF_MS = 500;
/**
 * Backstop for the whole connect handshake. `connectTimeout` only bounds the
 * TCP connect: a peer that accepts the socket and then never speaks RESP (a
 * wedged proxy or load balancer) leaves `connect()` pending indefinitely, which
 * `connectTimeout` and `reconnectStrategy` do not catch. Must exceed
 * CONNECT_TIMEOUT_MS so the client's own, more specific error usually wins.
 */
const CONNECT_DEADLINE_MS = 3000;
/**
 * Backstop for every command round-trip. node-redis leaves `socket.timeout`
 * undefined and we must not set it: it is an *idle* socket timeout, and this
 * limiter's socket is idle between requests by design, so it would tear down
 * healthy connections. Without an explicit deadline a peer that completes the
 * handshake then goes silent (wedged proxy, half-open NAT, blocked server)
 * leaves `exec()` pending forever on the cached-ready-client path, which serves
 * nearly every request in a warm lambda.
 *
 * 1s is ~2 orders of magnitude above a healthy in-region round-trip
 * (single-digit ms), so a slow-but-alive Redis cannot trip it into spurious
 * 429s, while still failing closed far inside the function timeout.
 */
const EXEC_DEADLINE_MS = 1000;

type RedisClient = ReturnType<typeof createClient>;

let clientPromise: Promise<RedisClient> | null = null;

/** Reclaims a client that never finished connecting. */
function destroyIfOpen(client: RedisClient) {
  // `destroy()` throws ClientClosedError once the client has torn itself down,
  // which is exactly the state a rejected `connect()` leaves it in.
  if (client.isOpen) {
    client.destroy();
  }
}

function connectWithDeadline(client: RedisClient): Promise<RedisClient> {
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () =>
        reject(new Error(`Redis connect exceeded ${CONNECT_DEADLINE_MS}ms`)),
      CONNECT_DEADLINE_MS
    );
  });

  return Promise.race([client.connect().then(() => client), deadline]).finally(
    () => clearTimeout(timer)
  );
}

/** Same race as `connectWithDeadline`, for the hot-path command round-trip. */
function execWithDeadline<T>(exec: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Redis exec exceeded ${EXEC_DEADLINE_MS}ms`)),
      EXEC_DEADLINE_MS
    );
  });

  return Promise.race([exec, deadline]).finally(() => clearTimeout(timer));
}

function getClient(): Promise<RedisClient> | null {
  if (!process.env.REDIS_URL) {
    return null;
  }

  if (!clientPromise) {
    // `createClient` with options infers a wider generic instantiation than the
    // bare `ReturnType<typeof createClient>` alias, hence the cast.
    const client = createClient({
      socket: {
        connectTimeout: CONNECT_TIMEOUT_MS,
        reconnectStrategy: (retries) =>
          retries > MAX_RECONNECT_RETRIES
            ? false
            : Math.min(
                retries * RECONNECT_BACKOFF_MS,
                MAX_RECONNECT_BACKOFF_MS
              ),
      },
      url: process.env.REDIS_URL,
    }) as RedisClient;
    client.on("error", () => undefined);
    clientPromise = connectWithDeadline(client).catch((error) => {
      // Allow a later request to retry the connection.
      clientPromise = null;
      destroyIfOpen(client);
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
  let pending: Promise<RedisClient> | null = null;
  try {
    pending = getClient();
    if (!pending) {
      throw new Error("REDIS_URL is not configured");
    }
    redis = await pending;
  } catch (error) {
    throw new ChatbotError("rate_limit:chat", { cause: error });
  }

  let count: unknown;
  try {
    [count] = await execWithDeadline(
      redis
        .multi()
        .incr(`ip-rate-limit:${ip}`)
        .expire(`ip-rate-limit:${ip}`, TTL_SECONDS, "NX")
        .exec()
    );
  } catch (error) {
    // A client that connected and later died stays cached as a resolved-but-
    // dead promise, which would fail every future request forever. Drop it so
    // the next request builds a fresh one. Only discard the client we actually
    // used: a concurrent request may already have installed a healthy one.
    if (clientPromise === pending) {
      clientPromise = null;
    }
    destroyIfOpen(redis);
    throw new ChatbotError("rate_limit:chat", { cause: error });
  }

  if (typeof count !== "number" || count > MAX_MESSAGES) {
    throw new ChatbotError("rate_limit:chat");
  }
}
