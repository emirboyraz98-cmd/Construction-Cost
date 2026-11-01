/** Server Action sonucu: hata mesajı ve alan bazında hatalar formda gösterilir. */
export type ActionFailure = { ok: false; error: string; fieldErrors?: Record<string, string> };
export type ActionResult = { ok: true } | ActionFailure;
