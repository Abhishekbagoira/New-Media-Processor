import { describe, it, expect, vi, beforeEach } from "vitest";


global.fetch = vi.fn();

// Mock logger so tests don't produce noise
vi.mock("../utils/logger.js", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

// Mock fs so we don't need real files
vi.mock("fs", () => ({
  default: { readFileSync: vi.fn(() => Buffer.from("fake-image-data")) },
}));

const { runCaptioning } = await import("../src/pipeline/caption.js");

describe("runCaptioning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ML_SERVICE_URL = "http://ml:5000";
  });

  it("returns caption from ml service", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ caption: "a dog sitting on grass" }),
    });

    const result = await runCaptioning("/app/uploads/test.png");
    expect(result).toBe("a dog sitting on grass");
  });

  it("throws when ml service returns error", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "Internal Server Error",
    });

    await expect(runCaptioning("/app/uploads/test.png")).rejects.toThrow(
      "ML caption error 500",
    );
  });

  it("calls correct ml service url", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ caption: "test caption" }),
    });

    await runCaptioning("/app/uploads/test.png");

    expect(global.fetch).toHaveBeenCalledWith(
      "http://ml:5000/caption",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
