// Cliente mínimo do Google Sheets via service account. SÓ SERVIDOR.
// Lê GOOGLE_SERVICE_ACCOUNT_JSON (JSON inline OU caminho) e GOOGLE_SHEET_ID.
// A exportação SUBSTITUI os dados da aba (limpa da linha 3 p/ baixo e reescreve),
// preservando o banner (linha 1) e o cabeçalho (linha 2).
import fs from "node:fs";
import { JWT } from "google-auth-library";

const API = "https://sheets.googleapis.com/v4/spreadsheets";

// Aceita o JSON inline (mesmo com sobra de caracteres no fim, como pode acontecer
// ao colar na Vercel), base64 de um JSON, ou um caminho de arquivo (dev local).
function parseSaJson(raw: string): any {
  try {
    return JSON.parse(raw);
  } catch {
    /* tenta as alternativas abaixo */
  }
  // base64 de um JSON
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8").trim();
    if (decoded.startsWith("{")) return JSON.parse(decoded);
  } catch {
    /* ignora */
  }
  // recorta do primeiro { ao último } (remove lixo antes/depois)
  const a = raw.indexOf("{");
  const b = raw.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(raw.slice(a, b + 1));
  throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não é um JSON válido (nem base64 de JSON).");
}

function serviceAccount(): { client_email: string; private_key: string } {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não configurado.");
  const looksPath =
    !raw.startsWith("{") && (raw.includes("/") || raw.includes("\\") || raw.toLowerCase().endsWith(".json"));
  const json = looksPath && fs.existsSync(raw) ? JSON.parse(fs.readFileSync(raw, "utf8")) : parseSaJson(raw);
  if (!json.client_email || !json.private_key) throw new Error("Service account inválido (faltam client_email/private_key).");
  // normaliza a private_key (caso os \n tenham vindo escapados como texto)
  const private_key = String(json.private_key).replace(/\\n/g, "\n");
  return { client_email: json.client_email, private_key };
}

let _client: JWT | null = null;
function client(): JWT {
  if (_client) return _client;
  const sa = serviceAccount();
  _client = new JWT({ email: sa.client_email, key: sa.private_key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  return _client;
}

export function serviceAccountEmail(): string {
  try {
    return serviceAccount().client_email;
  } catch {
    return "(service account não configurado)";
  }
}

function sheetId(): string {
  const id = process.env.GOOGLE_SHEET_ID?.trim();
  if (!id) throw new Error("GOOGLE_SHEET_ID não configurado.");
  return id;
}

function friendly(e: any): Error {
  const status = e?.response?.status ?? e?.status;
  const msg = e?.response?.data?.error?.message || e?.message || "Erro no Google Sheets.";
  if (status === 403) {
    return new Error(`Sem permissão de escrita na planilha. Dê acesso de Editor ao service account ${serviceAccountEmail()}.`);
  }
  return new Error(msg);
}

type Cell = string | number;

export interface ReplaceOpts {
  tab: string;
  /** sheetId (gid) da aba — necessário p/ formatar e crescer a grade. */
  gid: number;
  /** Última coluna de dados (ex.: "AB" p/ 28 col, "AK" p/ 37). */
  lastCol: string;
  /** Índices 0-based das colunas de data (serial → formato de data). */
  dateCols: number[];
  rows: Cell[][];
  /** Célula da "última atualização" (opcional). */
  dateCell?: string;
  dateValue?: string;
}

/**
 * SUBSTITUI os dados da aba: limpa A3:lastCol (mantém formatação), escreve as
 * linhas novas a partir de A3 (RAW) e reforça o formato de data. Retorna quantas
 * linhas foram escritas. Se `rows` vier vazio, NÃO limpa nada (evita apagar a
 * aba por engano) e retorna 0.
 */
export async function replaceData(opts: ReplaceOpts): Promise<number> {
  const { tab, gid, lastCol, dateCols, rows, dateCell, dateValue } = opts;
  if (!rows.length) return 0; // trava de segurança: nunca limpa com dados vazios
  const cli = client();
  const id = sheetId();
  try {
    // 1) garante linhas suficientes na grade (2 fixas + dados)
    const needed = 2 + rows.length;
    const meta = await cli.request<any>({ url: `${API}/${id}?fields=sheets(properties(sheetId,gridProperties(rowCount)))` });
    const props = (meta.data.sheets || []).find((s: any) => s.properties.sheetId === gid)?.properties;
    if ((props?.gridProperties?.rowCount ?? 0) < needed) {
      await cli.request({
        url: `${API}/${id}:batchUpdate`,
        method: "POST",
        data: { requests: [{ updateSheetProperties: { properties: { sheetId: gid, gridProperties: { rowCount: needed } }, fields: "gridProperties.rowCount" } }] },
      });
    }
    // 2) limpa os dados antigos (só valores; mantém banner/cabeçalho e formatação)
    await cli.request({ url: `${API}/${id}/values/${encodeURIComponent(`${tab}!A3:${lastCol}`)}:clear`, method: "POST", data: {} });
    // 3) escreve os dados novos (RAW: número fica número, "12.34%" fica texto, serial fica serial)
    await cli.request({
      url: `${API}/${id}/values/${encodeURIComponent(`${tab}!A3`)}?valueInputOption=RAW`,
      method: "PUT",
      data: { values: rows },
    });
    // 4) reforça o formato de data nas colunas de data (cobre linhas novas)
    if (dateCols.length) {
      await cli.request({
        url: `${API}/${id}:batchUpdate`,
        method: "POST",
        data: {
          requests: dateCols.map((col) => ({
            repeatCell: {
              range: { sheetId: gid, startRowIndex: 2, endRowIndex: 2 + rows.length, startColumnIndex: col, endColumnIndex: col + 1 },
              cell: { userEnteredFormat: { numberFormat: { type: "DATE_TIME", pattern: "dd/mm/yyyy hh:mm:ss" } } },
              fields: "userEnteredFormat.numberFormat",
            },
          })),
        },
      });
    }
    // 5) banner de "última atualização"
    if (dateCell && dateValue) {
      await cli.request({
        url: `${API}/${id}/values/${encodeURIComponent(`${tab}!${dateCell}`)}?valueInputOption=RAW`,
        method: "PUT",
        data: { values: [[dateValue]] },
      });
    }
    return rows.length;
  } catch (e) {
    throw friendly(e);
  }
}
