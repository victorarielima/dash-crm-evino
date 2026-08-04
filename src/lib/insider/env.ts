// Leitura centralizada das credenciais Insider (só no servidor).
// A chave geral cobre Email, SMS e Architect (WhatsApp). Web Push e App Push
// costumam exigir chaves próprias — se ausentes, o adapter retorna erro claro.

const base = () => process.env.INSIDER_API_KEY?.trim() || "";

export const insiderEnv = {
  emailKey: () => process.env.INSIDER_EMAIL_AUTH_KEY?.trim() || base(),
  smsKey: () => process.env.INSIDER_SMS_AUTH_KEY?.trim() || base(),
  onsiteKey: () => process.env.INSIDER_ONSITE_AUTH_KEY?.trim() || base(),
  architectKey: () => process.env.INSIDER_ARCHITECT_TOKEN?.trim() || base(),
  // Web Push tem token próprio (Authorization: Bearer <key>); cai na geral se ausente.
  webpushKey: () => process.env.INSIDER_WEBPUSH_API_KEY?.trim() || base(),
  mobileKey: () => process.env.INSIDER_MOBILE_API_KEY?.trim() || "",
  webpushPartnerId: () => process.env.INSIDER_WEBPUSH_PARTNER_ID?.trim() || "",
  partnerName: () => process.env.INSIDER_PARTNER_NAME?.trim() || "",
};

export class InsiderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsiderError";
  }
}
