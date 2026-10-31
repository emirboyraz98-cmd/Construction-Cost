// Giriş deneme sınırı (saf modül): aynı e-postaya veya aynı adrese çok sayıda hatalı şifre
// denemesinde girişi bir süre kilitler. Bellekte tutulur (tek sunucu); program yeniden açılınca sıfırlanır.

export type LimitRule = { max: number; windowMs: number; lockMs: number };

export const EMAIL_RULE: LimitRule = { max: 5, windowMs: 15 * 60_000, lockMs: 15 * 60_000 };
export const IP_RULE: LimitRule = { max: 20, windowMs: 15 * 60_000, lockMs: 15 * 60_000 };

type Entry = { failures: number[]; lockedUntil: number };

export class AttemptLimiter {
  private entries = new Map<string, Entry>();
  constructor(private rule: LimitRule) {}

  /** Kilitliyse kalan süre (ms), değilse 0. */
  lockedFor(key: string, now = Date.now()): number {
    const e = this.entries.get(key);
    return e && e.lockedUntil > now ? e.lockedUntil - now : 0;
  }

  /** Hatalı deneme; sınır aşılırsa kilitler ve kilit süresini döndürür. */
  fail(key: string, now = Date.now()): number {
    const e = this.entries.get(key) ?? { failures: [], lockedUntil: 0 };
    e.failures = e.failures.filter((t) => now - t < this.rule.windowMs);
    e.failures.push(now);
    if (e.failures.length >= this.rule.max) {
      e.lockedUntil = now + this.rule.lockMs;
      e.failures = [];
    }
    this.entries.set(key, e);
    if (this.entries.size > 10_000) this.prune(now);
    return this.lockedFor(key, now);
  }

  /** Başarılı girişte sayaç sıfırlanır. */
  reset(key: string) {
    this.entries.delete(key);
  }

  private prune(now: number) {
    for (const [k, e] of this.entries) if (e.lockedUntil <= now && e.failures.every((t) => now - t >= this.rule.windowMs)) this.entries.delete(k);
  }
}

export const minutesText = (ms: number) => `${Math.max(1, Math.ceil(ms / 60_000))} dakika`;
