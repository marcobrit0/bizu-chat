import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const connectMock = vi.fn();
const createClientMock = vi.fn();

/** Must stay above the module's CONNECT_DEADLINE_MS. */
const PAST_CONNECT_DEADLINE_MS = 5000;
/** Must stay above the module's EXEC_DEADLINE_MS. */
const PAST_EXEC_DEADLINE_MS = 2000;

vi.mock("redis", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

vi.mock("@/lib/constants", () => ({ isProductionEnvironment: true }));

async function loadModule() {
  vi.resetModules();
  return await import("./ratelimit");
}

describe("checkIpRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.REDIS_URL = "";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("throws when REDIS_URL is not configured in production", async () => {
    const { checkIpRateLimit } = await loadModule();
    await expect(checkIpRateLimit("1.2.3.4")).rejects.toThrow();
  });

  it("throws when the ip is unknown in production", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    const { checkIpRateLimit } = await loadModule();
    await expect(checkIpRateLimit(undefined)).rejects.toThrow();
  });

  it("throws when redis fails to connect", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    connectMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    createClientMock.mockReturnValue({
      connect: connectMock,
      isReady: false,
      on: vi.fn(),
    });
    const { checkIpRateLimit } = await loadModule();
    await expect(checkIpRateLimit("1.2.3.4")).rejects.toThrow();
  });

  it("allows a request under the limit", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    connectMock.mockResolvedValueOnce(undefined);
    createClientMock.mockReturnValue({
      connect: connectMock,
      isReady: true,
      multi: () => ({
        incr: () => ({
          expire: () => ({ exec: async () => [1] }),
        }),
      }),
      on: vi.fn(),
    });
    const { checkIpRateLimit } = await loadModule();
    await expect(checkIpRateLimit("1.2.3.4")).resolves.toBeUndefined();
  });

  it("throws when over the limit", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    connectMock.mockResolvedValueOnce(undefined);
    createClientMock.mockReturnValue({
      connect: connectMock,
      isReady: true,
      multi: () => ({
        incr: () => ({
          expire: () => ({ exec: async () => [11] }),
        }),
      }),
      on: vi.fn(),
    });
    const { checkIpRateLimit } = await loadModule();
    await expect(checkIpRateLimit("1.2.3.4")).rejects.toThrow();
  });

  it("fails closed when exec resolves to an unexpected shape", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    connectMock.mockResolvedValueOnce(undefined);
    createClientMock.mockReturnValue({
      connect: connectMock,
      isReady: true,
      multi: () => ({
        incr: () => ({
          expire: () => ({ exec: async () => ["11"] }),
        }),
      }),
      on: vi.fn(),
    });
    const { checkIpRateLimit } = await loadModule();
    await expect(checkIpRateLimit("1.2.3.4")).rejects.toThrow();
  });

  it("bounds the connect attempt and the reconnect retries", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    connectMock.mockResolvedValueOnce(undefined);
    createClientMock.mockReturnValue({
      connect: connectMock,
      isReady: true,
      multi: () => ({
        incr: () => ({
          expire: () => ({ exec: async () => [1] }),
        }),
      }),
      on: vi.fn(),
    });
    const { checkIpRateLimit } = await loadModule();
    await checkIpRateLimit("1.2.3.4");

    // Without both of these, redis@6 retries an unreachable server forever and
    // `connect()` never settles.
    const { socket } = createClientMock.mock.calls[0][0];
    expect(socket.connectTimeout).toBeGreaterThan(0);
    expect(socket.connectTimeout).toBeLessThanOrEqual(5000);
    expect(socket.reconnectStrategy(0)).not.toBe(false);
    expect(socket.reconnectStrategy(99)).toBe(false);
  });

  it("rejects rather than hanging when connect never settles", async () => {
    vi.useFakeTimers();
    process.env.REDIS_URL = "redis://localhost:6379";
    // redis@6 against an unreachable server: connect() retries indefinitely and
    // its promise never settles. Nothing else in the module may await forever.
    connectMock.mockReturnValue(new Promise<never>(() => undefined));
    const destroyMock = vi.fn();
    createClientMock.mockReturnValue({
      connect: connectMock,
      destroy: destroyMock,
      isOpen: true,
      on: vi.fn(),
    });
    const { checkIpRateLimit } = await loadModule();

    const pending = checkIpRateLimit("1.2.3.4");
    const assertion = expect(pending).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(PAST_CONNECT_DEADLINE_MS);
    await assertion;

    // The half-open client is reclaimed rather than left retrying in the dark.
    expect(destroyMock).toHaveBeenCalledTimes(1);
  });

  it("rejects rather than hanging when exec never settles", async () => {
    vi.useFakeTimers();
    process.env.REDIS_URL = "redis://localhost:6379";
    connectMock.mockResolvedValueOnce(undefined);
    const destroyMock = vi.fn();
    createClientMock.mockReturnValue({
      connect: connectMock,
      destroy: destroyMock,
      isOpen: true,
      isReady: true,
      multi: () => ({
        incr: () => ({
          // A server that completes the handshake and then goes silent on
          // MULTI: exec() never settles. This is the cached-ready-client path,
          // which the connect deadline does not guard.
          expire: () => ({ exec: () => new Promise<never>(() => undefined) }),
        }),
      }),
      on: vi.fn(),
    });
    const { checkIpRateLimit } = await loadModule();

    const pending = checkIpRateLimit("1.2.3.4");
    const assertion = expect(pending).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(PAST_EXEC_DEADLINE_MS);
    await assertion;

    // The wedged client is discarded so the limiter recovers when Redis returns.
    expect(destroyMock).toHaveBeenCalledTimes(1);
  });

  it("fails closed when exec throws", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    connectMock.mockResolvedValueOnce(undefined);
    createClientMock.mockReturnValue({
      connect: connectMock,
      isReady: true,
      multi: () => ({
        incr: () => ({
          expire: () => ({
            exec: () => Promise.reject(new Error("connection lost")),
          }),
        }),
      }),
      on: vi.fn(),
    });
    const { checkIpRateLimit } = await loadModule();
    await expect(checkIpRateLimit("1.2.3.4")).rejects.toThrow();
  });

  it("builds a new client after a failed connect and recovers", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    connectMock
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce(undefined);
    createClientMock.mockReturnValue({
      connect: connectMock,
      isOpen: false,
      isReady: true,
      multi: () => ({
        incr: () => ({
          expire: () => ({ exec: async () => [1] }),
        }),
      }),
      on: vi.fn(),
    });
    const { checkIpRateLimit } = await loadModule();

    await expect(checkIpRateLimit("1.2.3.4")).rejects.toThrow();
    // The failed connect must not be cached: the next request retries.
    await expect(checkIpRateLimit("1.2.3.4")).resolves.toBeUndefined();
    expect(createClientMock).toHaveBeenCalledTimes(2);
  });

  it("discards a dead client so the limiter recovers after exec fails", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    connectMock.mockResolvedValue(undefined);
    const deadClient = {
      connect: connectMock,
      isOpen: false,
      isReady: true,
      multi: () => ({
        incr: () => ({
          expire: () => ({
            exec: () => Promise.reject(new Error("connection lost")),
          }),
        }),
      }),
      on: vi.fn(),
    };
    const liveClient = {
      connect: connectMock,
      isOpen: true,
      isReady: true,
      multi: () => ({
        incr: () => ({
          expire: () => ({ exec: async () => [1] }),
        }),
      }),
      on: vi.fn(),
    };
    createClientMock
      .mockReturnValueOnce(deadClient)
      .mockReturnValueOnce(liveClient);
    const { checkIpRateLimit } = await loadModule();

    await expect(checkIpRateLimit("1.2.3.4")).rejects.toThrow();
    // Without dropping the cached dead client this stays 429 forever, even
    // once Redis is healthy again.
    await expect(checkIpRateLimit("1.2.3.4")).resolves.toBeUndefined();
    expect(createClientMock).toHaveBeenCalledTimes(2);
  });
});
