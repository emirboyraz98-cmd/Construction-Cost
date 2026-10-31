"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

export type CashChartRow = { key: string; label: string; inflow: number; outflow: number; balance: number; past: boolean };

const COLORS = { inflow: "#2a78d6", outflow: "#eb6834", balance: "#1baf7a" } as const;
const H = 260;
const PAD = { top: 12, right: 12, bottom: 28, left: 64 };
const COL = 26;

/** Kısa TL gösterimi (eksen): 12,5 M / 850 B */
function short(v: number) {
  const a = Math.abs(v);
  const s = a >= 1e9 ? `${(a / 1e9).toFixed(1)} Mr` : a >= 1e6 ? `${(a / 1e6).toFixed(1)} M` : a >= 1e3 ? `${Math.round(a / 1e3)} B` : `${Math.round(a)}`;
  return `${v < 0 ? "−" : ""}${s.replace(".", ",")}`;
}

function niceStep(range: number) {
  const raw = range / 4;
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

/** Aylık nakit girişi (yukarı), çıkışı (aşağı) ve kümülatif bakiye çizgisi; tek TL ekseni. */
export function CashChart({ rows, currentKey }: { rows: CashChartRow[]; currentKey: string }) {
  const [hover, setHover] = useState<number | null>(null);
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Gösterilecek nakit hareketi yok.</p>;
  const max = Math.max(0, ...rows.map((r) => Math.max(r.inflow, r.balance)));
  const min = Math.min(0, ...rows.map((r) => Math.min(-r.outflow, r.balance)));
  const step = niceStep(max - min);
  const top = Math.ceil(max / step) * step || step;
  const bottom = Math.floor(min / step) * step;
  const width = PAD.left + PAD.right + rows.length * COL;
  const plotH = H - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + ((top - v) / (top - bottom)) * plotH;
  const x = (i: number) => PAD.left + i * COL + COL / 2;
  const ticks: number[] = [];
  for (let v = bottom; v <= top + step / 2; v += step) ticks.push(v);
  const bar = 9;
  const labelEvery = Math.max(1, Math.ceil(rows.length / 18));
  const line = rows.map((r, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(r.balance)}`).join(" ");
  const currentIndex = rows.findIndex((r) => r.key === currentKey);
  const h = hover != null ? rows[hover] : null;

  return (
    <div className="grid grid-cols-1 gap-2">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Lejant">
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: COLORS.inflow }} /> Giriş (tahsilat, taksit, satış)
        </li>
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: COLORS.outflow }} /> Çıkış (harcama, hakediş, bağlantı, plan, finansman)
        </li>
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded" style={{ background: COLORS.balance }} /> Kümülatif bakiye
        </li>
      </ul>
      <div className="relative overflow-x-auto">
        <svg width={width} height={H} role="img" aria-label="Aylık nakit akışı grafiği" className="block" onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "#a1a09a" : "#e7e6e2"} strokeWidth={1} />
              <text x={PAD.left - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-muted-foreground text-[10px]">
                {short(t)}
              </text>
            </g>
          ))}
          {currentIndex >= 0 && (
            <g>
              <line x1={x(currentIndex) - COL / 2} x2={x(currentIndex) - COL / 2} y1={PAD.top} y2={H - PAD.bottom} stroke="#a1a09a" strokeDasharray="3 3" />
              <text x={x(currentIndex) - COL / 2 + 3} y={PAD.top + 8} className="fill-muted-foreground text-[10px]">
                bugün
              </text>
            </g>
          )}
          {rows.map((r, i) => (
            <g key={r.key}>
              {hover === i && <rect x={x(i) - COL / 2} y={PAD.top} width={COL} height={plotH} fill="#f0efec" />}
              {r.inflow > 0 && <path d={roundedUp(x(i) - bar - 1, y(r.inflow), bar, y(0) - y(r.inflow))} fill={COLORS.inflow} opacity={r.past ? 0.55 : 1} />}
              {r.outflow > 0 && <path d={roundedDown(x(i) + 1, y(0), bar, y(-r.outflow) - y(0))} fill={COLORS.outflow} opacity={r.past ? 0.55 : 1} />}
              {(i % labelEvery === 0 || (i === rows.length - 1 && i % labelEvery >= Math.max(2, labelEvery / 2))) && (
                <text x={x(i)} y={H - PAD.bottom + 14} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                  {r.label}
                </text>
              )}
              <rect x={x(i) - COL / 2} y={PAD.top} width={COL} height={plotH} fill="transparent" onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${r.label}: giriş ${formatMoney(r.inflow)}, çıkış ${formatMoney(r.outflow)}, bakiye ${formatMoney(r.balance)}`} />
            </g>
          ))}
          <path d={line} fill="none" stroke={COLORS.balance} strokeWidth={2} pointerEvents="none" />
          {h && <circle cx={x(hover!)} cy={y(h.balance)} r={4} fill={COLORS.balance} stroke="#fcfcfb" strokeWidth={2} pointerEvents="none" />}
        </svg>
        {h && (
          <div
            className={cn("pointer-events-none absolute top-2 z-10 w-56 rounded-md border bg-popover p-2 text-xs shadow-md")}
            style={{ left: Math.min(Math.max(x(hover!) + 12, 0), width - 230) }}
          >
            <p className="mb-1 font-medium">
              {h.label} {h.past ? "· gerçekleşen" : "· plan"}
            </p>
            <p className="flex justify-between gap-2">
              <span>Giriş</span>
              <span className="tabular-nums">{formatMoney(h.inflow)}</span>
            </p>
            <p className="flex justify-between gap-2">
              <span>Çıkış</span>
              <span className="tabular-nums">{formatMoney(h.outflow)}</span>
            </p>
            <p className="flex justify-between gap-2 border-t pt-1">
              <span>Kümülatif bakiye</span>
              <span className={cn("tabular-nums", h.balance < 0 && "text-destructive")}>{formatMoney(h.balance)}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Üst köşeleri 4px yuvarlatılmış, tabana dik çubuk (yukarı). */
function roundedUp(x: number, top: number, w: number, h: number) {
  const r = Math.min(4, h, w / 2);
  return `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${top + h} Z`;
}

/** Alt köşeleri yuvarlatılmış çubuk (aşağı). */
function roundedDown(x: number, base: number, w: number, h: number) {
  const r = Math.min(4, h, w / 2);
  return `M${x},${base} V${base + h - r} Q${x},${base + h} ${x + r},${base + h} H${x + w - r} Q${x + w},${base + h} ${x + w},${base + h - r} V${base} Z`;
}
