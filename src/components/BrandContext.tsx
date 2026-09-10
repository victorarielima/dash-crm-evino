"use client";
// Conta/marca ativa (Evino ou Grand Cru), compartilhada por todas as telas e
// persistida no navegador. Troca a logo da sidebar e a conta Insider/Redshift
// consultada pelas APIs.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_BRAND, brandDef, isBrandId, type BrandDef } from "@/lib/brands";
import type { BrandId } from "@/lib/insider/types";

const STORAGE_KEY = "iacrm-brand";

interface BrandState {
  brand: BrandId;
  def: BrandDef;
  setBrand: (b: BrandId) => void;
  /** false até ler o localStorage — evita consultar a conta errada no 1º render. */
  ready: boolean;
}

const BrandCtx = createContext<BrandState | null>(null);

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrandState] = useState<BrandId>(DEFAULT_BRAND);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isBrandId(stored)) setBrandState(stored);
    setReady(true);
  }, []);

  const setBrand = useCallback((next: BrandId) => {
    setBrandState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo<BrandState>(
    () => ({ brand, def: brandDef(brand), setBrand, ready }),
    [brand, setBrand, ready],
  );
  return <BrandCtx.Provider value={value}>{children}</BrandCtx.Provider>;
}

export function useBrand(): BrandState {
  const ctx = useContext(BrandCtx);
  if (!ctx) throw new Error("useBrand precisa estar dentro de <BrandProvider>.");
  return ctx;
}
