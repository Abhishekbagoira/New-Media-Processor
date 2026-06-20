import { describe, it, expect, vi, beforeEach } from "vitest";

global.fetch = vi.fn();

vi.mock("../utils/logger.js", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock("fs", () => ({
  default: { readFileSync: vi.fn(() => Buffer.from("fake-image-data")) },
}));

const { runSafeSearch } = await import("../src/pipeline/safety.js");

describe("runSafeSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ML_SERVICE_URL = "http://ml:5000";
  });

  it("returns flagged=false for safe image", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        flagged: false,
        details: { adult: "UNLIKELY", violence: "UNLIKELY", racy: "UNLIKELY" },
      }),
    });

    const result = await runSafeSearch("/app/uploads/safe.png");
    expect(result.flagged).toBe(false);
    expect(result.flaggedCategories).toEqual([]);
  });

  it("returns flagged=true when adult content is LIKELY", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        flagged: true,
        details: { adult: "LIKELY", violence: "UNLIKELY", racy: "UNLIKELY" },
      }),
    });

    const result = await runSafeSearch("/app/uploads/unsafe.png");
    expect(result.flagged).toBe(true);
    expect(result.flaggedCategories).toContain("adult");
  });

  it("returns flagged=true when violence is VERY_LIKELY", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        flagged: true,
        details: {
          adult: "UNLIKELY",
          violence: "VERY_LIKELY",
          racy: "UNLIKELY",
        },
      }),
    });

    const result = await runSafeSearch("/app/uploads/unsafe.png");
    expect(result.flagged).toBe(true);
    expect(result.flaggedCategories).toContain("violence");
  });

  it("returns flagged=false when likelihood is only POSSIBLE", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        flagged: false,
        details: { adult: "POSSIBLE", violence: "UNLIKELY", racy: "UNLIKELY" },
      }),
    });

    const result = await runSafeSearch("/app/uploads/test.png");
    expect(result.flagged).toBe(false);
  });

  it("throws when ml service fails", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Server Error",
    });

    await expect(runSafeSearch("/app/uploads/test.png")).rejects.toThrow(
      "ML safety error 500",
    );
  });
});
