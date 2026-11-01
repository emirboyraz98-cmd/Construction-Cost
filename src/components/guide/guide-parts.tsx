import type { ReactNode } from "react";
import { CalculatorIcon, LightbulbIcon, TriangleAlertIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Resimli kullanım kılavuzunun yapı taşları (sunucu bileşenleri, durum tutmaz).

export function GuideSection({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="grid scroll-mt-20 gap-5 border-t pt-8 first:border-t-0 first:pt-0">
      <div className="grid gap-1.5">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {intro && <p className="max-w-3xl text-sm text-muted-foreground">{intro}</p>}
      </div>
      {children}
    </section>
  );
}

export function GuideStep({ id, n, title, children }: { id?: string; n?: string; title: string; children: ReactNode }) {
  return (
    <div id={id} className="grid scroll-mt-20 gap-3">
      <h3 className="flex items-baseline gap-2 text-base font-semibold">
        {n && <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{n}</span>}
        <span>{title}</span>
      </h3>
      <div className="grid max-w-3xl gap-3 text-sm leading-relaxed [&_li]:pl-1 [&_ol]:grid [&_ol]:list-decimal [&_ol]:gap-1.5 [&_ol]:pl-5 [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </div>
  );
}

/** Ekran görüntüsü. `mobile` dar (telefon) görüntüler için. */
export function Shot({ src, alt, caption, mobile = false, eager = false }: { src: string; alt: string; caption?: ReactNode; mobile?: boolean; eager?: boolean }) {
  return (
    <figure className={cn("grid gap-1.5 break-inside-avoid", mobile ? "max-w-[300px] print:max-w-[5.5cm]" : "max-w-4xl print:max-w-[15cm]")}>
      {/* eslint-disable-next-line @next/next/no-img-element -- yerel, sabit boyutlu kılavuz görselleri */}
      <img src={`/kilavuz/${src}.jpg`} alt={alt} loading={eager ? "eager" : "lazy"} className="h-auto w-full rounded-lg border shadow-sm" />
      {caption && <figcaption className="text-xs text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
}

export function ShotRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-start gap-4">{children}</div>;
}

const TIP_STYLE = {
  tip: {
    icon: LightbulbIcon,
    className: "border-sky-200 bg-sky-50 text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100",
    label: "İpucu",
  },
  warn: {
    icon: TriangleAlertIcon,
    className: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100",
    label: "Dikkat",
  },
  calc: {
    icon: CalculatorIcon,
    className: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
    label: "Örnek hesap",
  },
} as const;

export function Tip({ tone = "tip", title, children }: { tone?: keyof typeof TIP_STYLE; title?: string; children: ReactNode }) {
  const s = TIP_STYLE[tone];
  const Icon = s.icon;
  return (
    <div className={cn("flex max-w-3xl gap-3 rounded-lg border p-3 text-sm break-inside-avoid", s.className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="grid gap-1">
        <p className="font-medium">{title ?? s.label}</p>
        <div className="leading-relaxed [&>*+*]:mt-1">{children}</div>
      </div>
    </div>
  );
}

/** Menü yolu / düğme adı: “Bütçe → Excel'den aktar”. */
export function Nav({ children }: { children: ReactNode }) {
  return <span className="box-decoration-clone rounded border bg-muted px-1.5 py-0.5 text-[0.8125rem] font-medium">{children}</span>;
}
