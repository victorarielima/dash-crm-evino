// Registro de exportação por canal → aba nativa da planilha CRM.
// Cada export SUBSTITUI os dados da aba (não anexa). Só os canais com fonte de
// dados adequada têm `build`; os demais trazem o motivo (a UI mostra por canal).
import type { BrandId, ChannelId } from "@/lib/insider/types";
import { buildEmailRows } from "./emailSheet";
import { buildSmsRows } from "./smsSheet";
import { buildWebpushRows } from "./webpushSheet";
import { buildWhatsappRows } from "./whatsappSheet";

type Cell = string | number;

export interface ChannelExport {
  tab: string;
  /** sheetId (gid) da aba — presente nos canais com build. */
  gid?: number;
  /** Última coluna de dados (ex.: "AB"=28 col, "AK"=37 col). */
  lastCol?: string;
  /** Índices 0-based das colunas de data (serial → formato de data). */
  dateCols?: number[];
  /** Célula da "última atualização" (só onde confirmada). */
  dateCell?: string;
  build?: (brand: BrandId, start: Date, end: Date) => Promise<Cell[][]>;
  /** Motivo quando ainda não é possível exportar este canal. */
  reason?: string;
}

export const CHANNEL_EXPORTS: Record<ChannelId, ChannelExport> = {
  email: { tab: "insider_News", gid: 337976544, lastCol: "AB", dateCols: [1], dateCell: "C1", build: buildEmailRows },
  sms: { tab: "insider_SMS", gid: 792848495, lastCol: "AK", dateCols: [35, 36], build: buildSmsRows },
  webpush: { tab: "insider_WebPush", gid: 2070895140, lastCol: "W", dateCols: [14, 15], build: buildWebpushRows },
  whatsapp: { tab: "insider_Whats", gid: 609546471, lastCol: "BB", dateCols: [52, 53], build: buildWhatsappRows },
  apppush: {
    tab: "insider_AppPush",
    reason: "App Push — exportação desativada (a API só expõe o dia atual).",
  },
};

// App Push fora do export (a API só dá o dia atual). WhatsApp incluído.
export const EXPORT_ORDER: ChannelId[] = ["email", "sms", "webpush", "whatsapp"];
