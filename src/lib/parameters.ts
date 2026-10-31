// Parametre tablosundaki türler. Oranlar koda gömülmez; Ayarlar > Parametreler'den yönetilir.

export const PARAMETER_KINDS = {
  kdv_orani: { label: "KDV oranı", unit: "%" },
  yapi_ruhsati_harci: { label: "Yapı ruhsatı harcı", unit: "TL/m²" },
  yapi_denetim_orani: { label: "Yapı denetim hizmet bedeli oranı", unit: "%" },
  damga_vergisi_orani: { label: "Damga vergisi oranı", unit: "binde" },
  satis_kdv_konut_indirimli: { label: "Satış KDV – konut indirimli oran", unit: "%" },
  satis_kdv_konut_net_sinir: { label: "Satış KDV – indirimli oran için en fazla net alan", unit: "m²" },
  satis_kdv_genel: { label: "Satış KDV – genel oran (büyük konut, dükkân, ofis)", unit: "%" },
} as const;

export type KnownParameterKind = keyof typeof PARAMETER_KINDS;

export function parameterKindLabel(kind: string): string {
  return (PARAMETER_KINDS as Record<string, { label: string }>)[kind]?.label ?? kind;
}
