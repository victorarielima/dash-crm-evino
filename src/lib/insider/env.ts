// Leitura centralizada das credenciais Insider (só no servidor), por marca.
// Cada marca (Evino / Grand Cru) é uma conta Insider distinta, com seu próprio
// conjunto de variáveis: a chave geral cobre Email, SMS, WhatsApp e Architect;
// Web Push e App Push exigem chaves próprias.
//
// NÃO existe fallback entre marcas — se a chave da Grand Cru não estiver
// configurada, o adapter falha com mensagem clara em vez de devolver dados da
// Evino silenciosamente.
import { BRAND_LABEL } from "../brands";
import type { BrandId } from "./types";

interface BrandVars {
  base: string;
  email: string;
  sms: string;
  whatsapp: string;
  onsite: string;
  architect: string;
  webpush: string;
  webpushPartnerId: string;
  mobile: string;
  partnerName: string;
}

// Evino mantém os nomes originais (retrocompatível); Grand Cru usa prefixo _GC_.
const VARS: Record<BrandId, BrandVars> = {
  evino: {
    base: "INSIDER_API_KEY",
    email: "INSIDER_EMAIL_AUTH_KEY",
    sms: "INSIDER_SMS_AUTH_KEY",
    whatsapp: "INSIDER_WHATSAPP_AUTH_KEY",
    onsite: "INSIDER_ONSITE_AUTH_KEY",
    architect: "INSIDER_ARCHITECT_TOKEN",
    webpush: "INSIDER_WEBPUSH_API_KEY",
    webpushPartnerId: "INSIDER_WEBPUSH_PARTNER_ID",
    mobile: "INSIDER_MOBILE_API_KEY",
    partnerName: "INSIDER_PARTNER_NAME",
  },
  grandcru: {
    base: "INSIDER_GC_API_KEY",
    email: "INSIDER_GC_EMAIL_AUTH_KEY",
    sms: "INSIDER_GC_SMS_AUTH_KEY",
    whatsapp: "INSIDER_GC_WHATSAPP_AUTH_KEY",
    onsite: "INSIDER_GC_ONSITE_AUTH_KEY",
    architect: "INSIDER_GC_ARCHITECT_TOKEN",
    webpush: "INSIDER_GC_WEBPUSH_API_KEY",
    webpushPartnerId: "INSIDER_GC_WEBPUSH_PARTNER_ID",
    mobile: "INSIDER_GC_MOBILE_API_KEY",
    partnerName: "INSIDER_GC_PARTNER_NAME",
  },
};

const read = (name: string): string => process.env[name]?.trim() || "";

/** Valor da variável específica do canal ou, se vazia, da chave geral da marca. */
function keyOf(brand: BrandId, field: keyof BrandVars): { value: string; varName: string } {
  const vars = VARS[brand];
  const own = read(vars[field]);
  if (own) return { value: own, varName: vars[field] };
  const base = read(vars.base);
  return { value: base, varName: `${vars[field]} (ou ${vars.base})` };
}

export class InsiderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsiderError";
  }
}

function required(brand: BrandId, field: keyof BrandVars, withFallback: boolean): string {
  const { value, varName } = withFallback
    ? keyOf(brand, field)
    : { value: read(VARS[brand][field]), varName: VARS[brand][field] };
  if (!value) {
    throw new InsiderError(
      `Conta ${BRAND_LABEL[brand]} sem credencial da Insider configurada: defina ${varName} no ambiente.`,
    );
  }
  return value;
}

export const insiderEnv = {
  emailKey: (brand: BrandId) => required(brand, "email", true),
  smsKey: (brand: BrandId) => required(brand, "sms", true),
  whatsappKey: (brand: BrandId) => required(brand, "whatsapp", true),
  onsiteKey: (brand: BrandId) => required(brand, "onsite", true),
  architectKey: (brand: BrandId) => required(brand, "architect", true),
  // Web Push tem token próprio (Authorization: Bearer <key>); cai na geral se ausente.
  webpushKey: (brand: BrandId) => required(brand, "webpush", true),
  // App Push usa a chave do projeto MOBILE — sem fallback para a chave geral.
  mobileKey: (brand: BrandId) => required(brand, "mobile", false),
  webpushPartnerId: (brand: BrandId) => required(brand, "webpushPartnerId", false),
  partnerName: (brand: BrandId) => read(VARS[brand].partnerName),
};
