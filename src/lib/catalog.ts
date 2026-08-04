// Catálogo client-safe (sem segredos) para os seletores.
import type { ChannelId, PeriodId } from "./insider/types";

export const CHANNELS: { id: ChannelId; label: string; supportsHistory: boolean }[] = [
  { id: "email", label: "Email", supportsHistory: true },
  { id: "sms", label: "SMS", supportsHistory: true },
  { id: "whatsapp", label: "WhatsApp", supportsHistory: true },
  { id: "webpush", label: "Web Push", supportsHistory: true },
  { id: "apppush", label: "App Push", supportsHistory: false },
];

export const PERIODS: { id: PeriodId; label: string }[] = [
  { id: "year", label: "Este ano" },
  { id: "30d", label: "30 dias" },
  { id: "15d", label: "15 dias" },
  { id: "7d", label: "7 dias" },
  { id: "2d", label: "2 dias" },
  { id: "today", label: "Hoje" },
  { id: "custom", label: "Personalizado" },
];
