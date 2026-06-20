import { describe, it, expect, vi, beforeEach } from "vitest";

global.fetch = vi.fn();

vi.mock("../utils/logger.js", () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock("fs", () => ({
  default: { readFileSync: vi.fn(() => Buffer.from("fake-image-data")) },
}));

const { runLabelDetection } = await import("../src/pipeline/labels.js");

describe("runLabelDetection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ML_SERVICE_URL = "http://ml:5000";
  });

  it("returns labels array from ml service", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ labels: ["dog", "grass", "outdoor"] }),
    });

    const result = await runLabelDetection("/app/uploads/test.png");
    expect(result).toEqual(["dog", "grass", "outdoor"]);
  });

  it("returns empty array when no labels", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ labels: [] }),
    });

    const result = await runLabelDetection("/app/uploads/test.png");
    expect(result).toEqual([]);
  });

  it("throws when ml service fails", async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => "Service Unavailable",
    });

    await expect(runLabelDetection("/app/uploads/test.png")).rejects.toThrow(
      "ML labels error 503",
    );
  });
});
