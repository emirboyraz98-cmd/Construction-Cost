// Parametre tablosundaki türler. Oranlar koda gömülmez; Ayarlar > Parametreler'den yönetilir.

export const PARAMETER_KINDS = {
  kdv_orani: { label: "KDV oranı", unit: "%" },
  yapi_ruhsati_harci: { label: "Yapı ruhsatı harcı", unit: "TL/m²" },
  yapi_denetim_orani: { label: "Yapı denetim hizmet bedeli oranı", unit: "%" },
  damga_vergisi_orani: { label: "Damga vergisi oranı", unit: "binde" },
} as const;

export type KnownParameterKind = keyof typeof PARAMETER_KINDS;

export function parameterKindLabel(kind: string): string {
  return (PARAMETER_KINDS as Record<string, { label: string }>)[kind]?.label ?? kind;
}
