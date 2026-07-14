import { beforeEach, describe, expect, it, vi } from "vitest";

const connectMock = vi.fn();
const createClientMock = vi.fn();

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
});
