// Leitura centralizada das credenciais Insider (só no servidor), por marca.
// Cada marca (Evino / Grand Cru) é uma conta Insider distinta, com seu próprio
// conjunto de variáveis. **Uma única chave geral atende todos os canais** — as
// variáveis por canal são overrides, só necessárias se a conta emitir um token
// exclusivo para aquele canal.
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

export class InsiderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsiderError";
  }
}

/**
 * Chave de um canal: usa a variável específica se existir, senão a chave geral
 * da conta. Só falha quando as duas estão vazias.
 */
function channelKey(brand: BrandId, field: keyof BrandVars): string {
  const vars = VARS[brand];
  const own = read(vars[field]);
  if (own) return own;
  const base = read(vars.base);
  if (base) return base;
  throw new InsiderError(
    `Conta ${BRAND_LABEL[brand]} sem chave da Insider: preencha ${vars.base} no .env ` +
      `(a mesma chave atende todos os canais) e reinicie o servidor — o Next lê o .env ` +
      `apenas ao subir. Se esta conta emitir um token exclusivo deste canal, use ${vars[field]}.`,
  );
}

export const insiderEnv = {
  emailKey: (brand: BrandId) => channelKey(brand, "email"),
  smsKey: (brand: BrandId) => channelKey(brand, "sms"),
  whatsappKey: (brand: BrandId) => channelKey(brand, "whatsapp"),
  onsiteKey: (brand: BrandId) => channelKey(brand, "onsite"),
  architectKey: (brand: BrandId) => channelKey(brand, "architect"),
  // Web Push tem token próprio (Authorization: Bearer <key>); cai na geral se ausente.
  webpushKey: (brand: BrandId) => channelKey(brand, "webpush"),
  // App Push costuma ter chave do projeto MOBILE, mas também cai na geral: se a
  // conta usar a mesma chave, funciona; se não, a própria Insider responde
  // "Bad Api Key" e o aviso aparece no canal.
  mobileKey: (brand: BrandId) => channelKey(brand, "mobile"),
  /** partner_id do Web Push: identificador da conta, NÃO uma chave — sem fallback. */
  webpushPartnerId: (brand: BrandId): string => {
    const vars = VARS[brand];
    const v = read(vars.webpushPartnerId);
    if (v) return v;
    throw new InsiderError(
      `Web Push da conta ${BRAND_LABEL[brand]}: falta ${vars.webpushPartnerId}. ` +
        `Não é uma chave de API — é o partner_id (ID numérico da conta no InOne, ` +
        `como o 10014458 da Evino) que a API do Web Push exige no corpo da requisição.`,
    );
  },
  partnerName: (brand: BrandId) => read(VARS[brand].partnerName),
};
