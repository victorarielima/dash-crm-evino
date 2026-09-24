// Registro de exportação por canal → aba nativa da planilha CRM.
// Só os canais com fonte de dados adequada têm `build`; os demais trazem o
// motivo (a UI mostra por canal). Ordem = ordem de gravação.
import type { BrandId, ChannelId } from "@/lib/insider/types";
import { buildEmailRows } from "./emailSheet";
import { buildSmsRows } from "./smsSheet";

type Cell = string | number;

export interface ChannelExport {
  tab: string;
  /** Célula da "última atualização" (só onde confirmada) — atualizada após gravar. */
  dateCell?: string;
  build?: (brand: BrandId, start: Date, end: Date) => Promise<Cell[][]>;
  /** Motivo quando ainda não é possível exportar este canal. */
  reason?: string;
}

export const CHANNEL_EXPORTS: Record<ChannelId, ChannelExport> = {
  email: { tab: "insider_News", dateCell: "C1", build: buildEmailRows },
  sms: { tab: "insider_SMS", build: buildSmsRows },
  webpush: {
    tab: "insider_WebPush",
    reason:
      "Web Push por campanha (Variant ID, links, drops) exige o endpoint overall-metrics — integração ainda não disponível.",
  },
  whatsapp: {
    tab: "insider_Whats",
    reason:
      "WhatsApp na planilha são broadcasts com as 54 métricas do Meta — fonte diferente das jornadas do dashboard; integração ainda não disponível.",
  },
  apppush: {
    tab: "insider_AppPush",
    reason:
      "App Push detalhado por variante não é exposto pela API (get_statistics cobre só o dia atual) — histórico 'este ano' indisponível.",
  },
};

export const EXPORT_ORDER: ChannelId[] = ["email", "sms", "webpush", "whatsapp", "apppush"];
