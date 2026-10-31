import { describe, expect, it, vi } from "vitest";
import { dismissToast, readToasts, toast } from "../src/components/Toast.js";

describe("toast store", () => {
  it("queues messages and dismisses them by id", () => {
    vi.useFakeTimers();
    try {
      expect(readToasts()).toEqual([]);
      const first = toast("Satu", 10000);
      toast("Dua", 10000);
      expect(readToasts().map((item) => item.message)).toEqual(["Satu", "Dua"]);
      dismissToast(first);
      expect(readToasts().map((item) => item.message)).toEqual(["Dua"]);
      dismissToast(-1);
      expect(readToasts()).toHaveLength(1);
    } finally {
      vi.advanceTimersByTime(20000);
      vi.useRealTimers();
    }
    expect(readToasts()).toEqual([]);
  });

  it("auto-dismisses after the timeout", () => {
    vi.useFakeTimers();
    try {
      toast("Halo", 1000);
      expect(readToasts()).toHaveLength(1);
      vi.advanceTimersByTime(1000);
      expect(readToasts()).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});
