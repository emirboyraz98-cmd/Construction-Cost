import { describe, expect, it } from "vitest";
import { AttemptLimiter, minutesText } from "./rate-limit";

describe("giriş deneme sınırı", () => {
  const rule = { max: 3, windowMs: 60_000, lockMs: 120_000 };

  it("sınırda kilitler, süre dolunca açar", () => {
    const l = new AttemptLimiter(rule);
    expect(l.fail("a@x", 0)).toBe(0);
    expect(l.fail("a@x", 1000)).toBe(0);
    expect(l.fail("a@x", 2000)).toBe(120_000);
    expect(l.lockedFor("a@x", 60_000)).toBe(62_000);
    expect(l.lockedFor("a@x", 122_001)).toBe(0);
    expect(l.lockedFor("b@x", 2000)).toBe(0);
    expect(minutesText(62_000)).toBe("2 dakika");
  });

  it("pencere dışındaki hatalar sayılmaz; başarılı giriş sıfırlar", () => {
    const l = new AttemptLimiter(rule);
    l.fail("a@x", 0);
    l.fail("a@x", 1000);
    expect(l.fail("a@x", 70_000)).toBe(0);
    l.reset("a@x");
    l.fail("a@x", 71_000);
    expect(l.fail("a@x", 72_000)).toBe(0);
  });
});
