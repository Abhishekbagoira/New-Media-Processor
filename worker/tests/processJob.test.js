import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB
vi.mock("../src/config/db.js", () => ({
  default: {
    query: vi.fn(),
  },
}));

// Mock dependencies
vi.mock("../src/pipeline/caption.js", () => ({
  runCaptioning: vi.fn(),
}));

vi.mock("../src/pipeline/labels.js", () => ({
  runLabelDetection: vi.fn(),
}));

vi.mock("../src/pipeline/safety.js", () => ({
  runSafeSearch: vi.fn(),
}));

vi.mock("../src/utils/logger.js", () => ({
  default: { info: vi.fn(), error: vi.fn() },
}));

vi.mock("../src/storage/fileStorage.js", () => ({
  assertFileExists: vi.fn(),
}));

// Imports after mocks
const pool = (await import("../src/config/db.js")).default;
const mockQuery = pool.query;

const { runCaptioning } = await import("../src/pipeline/caption.js");
const { runLabelDetection } = await import("../src/pipeline/labels.js");
const { runSafeSearch } = await import("../src/pipeline/safety.js");
const { assertFileExists } = await import("../src/storage/fileStorage.js");
const { processJob } = await import("../src/pipeline/processJob.js");

const makeBullJob = (data = {}) => ({
  data: { jobId: "test-job-id", ...data },
});

const mockDbJob = {
  id: "test-job-id",
  user_id: "test-user-id",
  file_path: "/app/uploads/test.png",
  status: "pending",
};

describe("processJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default DB responses
    mockQuery
      .mockResolvedValueOnce({ rows: [mockDbJob] }) // SELECT job
      .mockResolvedValueOnce({ rows: [] }) // UPDATE processing
      .mockResolvedValueOnce({ rows: [] }); // UPDATE completed

    assertFileExists.mockResolvedValue("/app/uploads/test.png");
    runCaptioning.mockResolvedValue("a dog on grass");
    runLabelDetection.mockResolvedValue(["dog", "grass"]);
    runSafeSearch.mockResolvedValue({
      flagged: false,
      flaggedCategories: [],
      details: { adult: "UNLIKELY", violence: "UNLIKELY", racy: "UNLIKELY" },
    });
  });

  it("completes successfully for safe image", async () => {
    await processJob(makeBullJob());
const allCalls = mockQuery.mock.calls;

expect(
  allCalls.some((c) => Array.isArray(c[1]) && c[1].includes("processing")),
).toBe(true);

expect(
  allCalls.some((c) => Array.isArray(c[1]) && c[1].includes("completed")),
).toBe(true);
  });

  it("runs all three AI steps", async () => {
    await processJob(makeBullJob());

    expect(runCaptioning).toHaveBeenCalledOnce();
    expect(runLabelDetection).toHaveBeenCalledOnce();
    expect(runSafeSearch).toHaveBeenCalledOnce();
  });

  it("creates notification when image is flagged", async () => {
    mockQuery
      .mockReset()
      .mockResolvedValueOnce({ rows: [mockDbJob] }) // SELECT job
      .mockResolvedValueOnce({ rows: [] }) // UPDATE processing
      .mockResolvedValueOnce({ rows: [] }) // UPDATE completed
      .mockResolvedValueOnce({ rows: [] }); // INSERT notification

    runSafeSearch.mockResolvedValue({
      flagged: true,
      flaggedCategories: ["adult"],
      details: { adult: "LIKELY", violence: "UNLIKELY", racy: "UNLIKELY" },
    });

    await processJob(makeBullJob());

    const insertCall = mockQuery.mock.calls.find((c) =>
      c[0].includes("INSERT INTO notifications"),
    );
    expect(insertCall).toBeDefined();
  });

  it("does not create notification for safe image", async () => {
    await processJob(makeBullJob());

    const insertCall = mockQuery.mock.calls.find((c) =>
      c[0].includes("INSERT INTO notifications"),
    );
    expect(insertCall).toBeUndefined();
  });

  it("marks job as failed and throws when AI step errors", async () => {
    mockQuery
      .mockReset()
      .mockResolvedValueOnce({ rows: [mockDbJob] }) // SELECT job
      .mockResolvedValueOnce({ rows: [] }) // UPDATE processing
      .mockResolvedValueOnce({ rows: [] }); // UPDATE failed

    runCaptioning.mockRejectedValue(new Error("ML service down"));

    await expect(processJob(makeBullJob())).rejects.toThrow("ML service down");

    const failCall = mockQuery.mock.calls.find((c) =>
      c[0].includes("'failed'"),
    );
    expect(failCall).toBeDefined();
  });

  it("increments retry_count on failure", async () => {
    mockQuery
      .mockReset()
      .mockResolvedValueOnce({ rows: [mockDbJob] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    runCaptioning.mockRejectedValue(new Error("timeout"));

    await expect(processJob(makeBullJob())).rejects.toThrow();

    const failCall = mockQuery.mock.calls.find((c) =>
      c[0].includes("retry_count"),
    );
    expect(failCall).toBeDefined();
  });

  it("throws if job not found in DB", async () => {
    mockQuery.mockReset().mockResolvedValueOnce({ rows: [] });

    await expect(processJob(makeBullJob())).rejects.toThrow("Job not found");
  });
});
