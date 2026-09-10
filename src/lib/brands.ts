// Catálogo de marcas/contas (client-safe: só rótulos e caminhos de logo).
// Cada marca aponta para uma conta Insider própria (chaves no ambiente,
// resolvidas em src/lib/insider/env.ts) e para as tabelas dela no Redshift.
import type { BrandId } from "./insider/types";

export interface BrandDef {
  id: BrandId;
  label: string;
  /** Sigla usada quando a sidebar está recolhida. */
  short: string;
  /** Logo horizontal (sidebar expandida). */
  wordmark: string;
  /** Logo reduzida (sidebar recolhida). */
  mark: string;
}

export const BRANDS: BrandDef[] = [
  { id: "evino", label: "Evino", short: "EV", wordmark: "/evino-logo.png", mark: "/logo-reduzida.png" },
  { id: "grandcru", label: "Grand Cru", short: "GC", wordmark: "/grandcru-logo.png", mark: "/logo-reduzida-gc.png" },
];

export const DEFAULT_BRAND: BrandId = "evino";

export const BRAND_IDS: BrandId[] = BRANDS.map((b) => b.id);

export const BRAND_LABEL: Record<BrandId, string> = BRANDS.reduce(
  (acc, b) => ({ ...acc, [b.id]: b.label }),
  {} as Record<BrandId, string>,
);

export function isBrandId(v: unknown): v is BrandId {
  return typeof v === "string" && (BRAND_IDS as string[]).includes(v);
}

/** Marca pelo id, caindo no default se vier algo inválido. */
export function brandDef(id: unknown): BrandDef {
  return BRANDS.find((b) => b.id === id) ?? BRANDS[0];
}
