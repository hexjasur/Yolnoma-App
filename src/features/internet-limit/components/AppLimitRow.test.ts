import { describe, expect, it } from "vitest";
import { formatTrafficRate } from "./AppLimitRow";

describe("formatTrafficRate", () => {
  it("formats byte, kilobyte, and megabyte rates", () => {
    expect(formatTrafficRate(500)).toBe("500 B/s");
    expect(formatTrafficRate(1024)).toBe("1.0 KB/s");
    expect(formatTrafficRate(1024 * 1024)).toBe("1.0 MB/s");
  });
});
