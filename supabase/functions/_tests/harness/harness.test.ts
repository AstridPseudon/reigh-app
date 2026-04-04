import { describe, expect, it } from "vitest";
import { testCases } from "./cases.ts";
import { TestHarness } from "./index.ts";

const TEST_LABEL = "Smoke";
const harnessEnabled = Boolean(process.env.HARNESS_ENABLED) && process.env.HARNESS_ENABLED !== "0";

describe.skipIf(!harnessEnabled)(`${TEST_LABEL} Harness Integration`, () => {
  it(`${TEST_LABEL}: exposes TestHarness and deterministic cases`, () => {
    expect(TestHarness).toBeTypeOf("function");
    expect(testCases.length).toBeGreaterThan(0);
    expect(testCases.every((testCase) => typeof testCase.name === "string" && typeof testCase.message !== "undefined")).toBe(true);
  });
});
