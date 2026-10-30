// Yarı detaylı metraj formülü (PLAN.md 6, seviye 2): dört işlem, parantez ve proje değişkenleri.
// Ör. "insaat_alani * 0,42" veya "(bolum_sayisi * 2 + 4) * 1,5". Kod çalıştırılmaz; ayrıştırıcı saftır.
import Decimal from "decimal.js";

export type FormulaResult = { ok: true; value: Decimal } | { ok: false; error: string };

type Token = { type: "num"; value: Decimal } | { type: "id"; name: string } | { type: "op"; op: string };

function tokenize(text: string): Token[] | string {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      i++;
    } else if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < text.length && /[0-9.,]/.test(text[j])) j++;
      const raw = text.slice(i, j).replace(",", ".");
      if (!/^\d+(\.\d+)?$/.test(raw)) return `“${text.slice(i, j)}” geçerli bir sayı değil.`;
      tokens.push({ type: "num", value: new Decimal(raw) });
      i = j;
    } else if (/[a-z_]/i.test(ch)) {
      let j = i;
      while (j < text.length && /[a-z0-9_]/i.test(text[j])) j++;
      tokens.push({ type: "id", name: text.slice(i, j).toLowerCase() });
      i = j;
    } else if ("+-*/()×".includes(ch)) {
      tokens.push({ type: "op", op: ch === "×" ? "*" : ch });
      i++;
    } else {
      return `“${ch}” formülde kullanılamaz.`;
    }
  }
  return tokens;
}

/** Formülü değişkenlerle hesaplar. Sonuç 4 haneye yuvarlanır. */
export function evaluateFormula(text: string, variables: Readonly<Record<string, Decimal>>): FormulaResult {
  const tokens = tokenize(text.trim());
  if (typeof tokens === "string") return { ok: false, error: tokens };
  if (tokens.length === 0) return { ok: false, error: "Formül boş." };
  let pos = 0;
  const fail = (error: string): never => {
    throw new Error(error);
  };
  const peek = () => tokens[pos];
  const isOp = (op: string) => {
    const t = peek();
    return t?.type === "op" && t.op === op;
  };
  function factor(): Decimal {
    const t = peek();
    if (!t) return fail("Formül eksik bitiyor.");
    if (t.type === "op" && t.op === "-") {
      pos++;
      return factor().neg();
    }
    if (t.type === "op" && t.op === "(") {
      pos++;
      const value = expr();
      if (!isOp(")")) fail("Kapanmayan parantez.");
      pos++;
      return value;
    }
    if (t.type === "num") {
      pos++;
      return t.value;
    }
    if (t.type === "id") {
      pos++;
      const value = variables[t.name];
      if (value === undefined) fail(`“${t.name}” bilinmeyen değişken.`);
      return value;
    }
    return fail(`Beklenmeyen “${t.op}”.`);
  }
  function term(): Decimal {
    let value = factor();
    while (isOp("*") || isOp("/")) {
      const op = (peek() as { op: string }).op;
      pos++;
      const right = factor();
      if (op === "/" && right.isZero()) fail("Sıfıra bölme.");
      value = op === "*" ? value.times(right) : value.div(right);
    }
    return value;
  }
  function expr(): Decimal {
    let value = term();
    while (isOp("+") || isOp("-")) {
      const op = (peek() as { op: string }).op;
      pos++;
      const right = term();
      value = op === "+" ? value.plus(right) : value.minus(right);
    }
    return value;
  }
  try {
    const value = expr();
    if (pos < tokens.length) return { ok: false, error: "Formülde fazladan ifade var." };
    return { ok: true, value: value.toDecimalPlaces(4, Decimal.ROUND_HALF_UP) };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
