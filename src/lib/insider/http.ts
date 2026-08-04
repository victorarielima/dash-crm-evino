import { InsiderError } from "./env";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RETRY_DELAYS = [400, 1000, 2200]; // backoff p/ 429 / 5xx / rede

export async function insiderFetch(url: string, init: RequestInit): Promise<any> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS[attempt - 1]);
    let res: Response;
    try {
      res = await fetch(url, { ...init, cache: "no-store" });
    } catch (e: any) {
      lastErr = new InsiderError(`Falha de rede: ${e?.message || e}`);
      continue; // erro de rede → tenta de novo
    }
    const text = await res.text();
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }
    if (!res.ok) {
      const msg = json?.message || json?.error || json?.raw || `HTTP ${res.status}`;
      const err = new InsiderError(typeof msg === "string" ? msg : JSON.stringify(msg));
      // 429 (rate limit) e 5xx são transitórios → retry; 4xx (auth/params) não.
      if (res.status === 429 || res.status >= 500) {
        lastErr = err;
        continue;
      }
      throw err;
    }
    // alguns endpoints retornam 200 com corpo de erro
    if (typeof json?.message === "string" && /unauthor|invalid key|bad api/i.test(json.message)) {
      throw new InsiderError(json.message);
    }
    return json;
  }
  throw lastErr ?? new InsiderError("Falha ao consultar a Insider após retries.");
}

/** Converte para número tolerando strings tipo "15,554" ou "93.67%". */
export function num(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const cleaned = v.replace(/%/g, "").replace(/\./g, "").replace(/,/g, ".");
    // heurística: "15,554" (milhar BR) vs "93,67" (decimal). Mantém simples: remove separador de milhar.
    const n = parseFloat(v.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : (Number.isFinite(parseFloat(cleaned)) ? parseFloat(cleaned) : 0);
  }
  return 0;
}

/** Lê o primeiro caminho existente em um objeto (ex.: pick(o, "data.summary.sent")). */
export function pick(obj: any, ...paths: string[]): unknown {
  for (const path of paths) {
    let cur = obj;
    let ok = true;
    for (const part of path.split(".")) {
      if (cur == null || !(part in cur)) {
        ok = false;
        break;
      }
      cur = cur[part];
    }
    if (ok && cur != null) return cur;
  }
  return undefined;
}
