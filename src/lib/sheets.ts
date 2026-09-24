// Cliente mínimo do Google Sheets (append/update de valores) via service account.
// SÓ SERVIDOR. Lê GOOGLE_SERVICE_ACCOUNT_JSON (JSON inline OU caminho de arquivo)
// e GOOGLE_SHEET_ID. Usado pela exportação para a planilha de CRM.
import fs from "node:fs";
import { JWT } from "google-auth-library";

const API = "https://sheets.googleapis.com/v4/spreadsheets";

function serviceAccount(): { client_email: string; private_key: string } {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON não configurado.");
  const json = raw.startsWith("{") ? JSON.parse(raw) : JSON.parse(fs.readFileSync(raw, "utf8"));
  if (!json.client_email || !json.private_key) throw new Error("Service account inválido (faltam client_email/private_key).");
  return { client_email: json.client_email, private_key: json.private_key };
}

let _client: JWT | null = null;
function client(): JWT {
  if (_client) return _client;
  const sa = serviceAccount();
  _client = new JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
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

/** Traduz erros do Sheets em mensagens úteis (403 = falta Editor). */
function friendly(e: any): Error {
  const status = e?.response?.status ?? e?.status;
  const msg = e?.response?.data?.error?.message || e?.message || "Erro no Google Sheets.";
  if (status === 403) {
    return new Error(
      `Sem permissão de escrita na planilha. Dê acesso de Editor ao service account ${serviceAccountEmail()} e tente de novo.`,
    );
  }
  return new Error(msg);
}

type Cell = string | number;

/**
 * Anexa linhas ao fim da tabela da aba, herdando o formato da linha acima
 * (INSERT_ROWS) e sem reinterpretar os valores (RAW: número fica número,
 * "13.68%" fica texto, serial de data fica número com o formato da coluna).
 */
export async function appendRows(tab: string, rows: Cell[][]): Promise<number> {
  const range = encodeURIComponent(`${tab}!A2:AB2`);
  try {
    const res = await client().request<any>({
      url: `${API}/${sheetId()}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      method: "POST",
      data: { values: rows },
    });
    return res.data?.updates?.updatedRows ?? rows.length;
  } catch (e) {
    throw friendly(e);
  }
}

/** Atualiza uma única célula (ex.: a data de "última atualização"). */
export async function setCell(a1: string, value: Cell): Promise<void> {
  const range = encodeURIComponent(a1);
  try {
    await client().request({
      url: `${API}/${sheetId()}/values/${range}?valueInputOption=RAW`,
      method: "PUT",
      data: { values: [[value]] },
    });
  } catch (e) {
    throw friendly(e);
  }
}
