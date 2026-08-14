// Cliente do agente n8n (via webhook). Só no servidor.
// O n8n é o "cérebro": recebe a mensagem + histórico + contexto selecionado,
// consulta o MCP da Insider e devolve a resposta. A persistência (fonte única)
// continua na chat_messages do Supabase, feita pelo route.ts.

export interface N8nChatPayload {
  conversationId: string;
  userId: string;
  userEmail: string | null;
  message: string;
  history: { role: "user" | "assistant" | "system"; content: string }[];
  context?: unknown; // seleção do "+": { channel, campaignName, period }
}

function webhookUrl(): string {
  const url = process.env.N8N_WEBHOOK_URL?.trim();
  if (!url) throw new Error("N8N_WEBHOOK_URL não configurada no .env.");
  return url;
}

/** Envia a conversa para o agente do n8n e devolve o texto da resposta. */
export async function askN8nAgent(payload: N8nChatPayload): Promise<string> {
  const url = webhookUrl();
  const secret = process.env.N8N_WEBHOOK_SECRET?.trim();

  // n8n + LLM + MCP pode demorar; abortamos antes do maxDuration (60s) da rota.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55_000);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "X-Webhook-Secret": secret } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("O agente do n8n demorou demais para responder.");
    throw new Error("Falha ao contatar o agente do n8n: " + (e?.message || String(e)));
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`n8n respondeu ${res.status}. ${text.slice(0, 300)}`);
  }

  return extractReply(await parseBody(res));
}

async function parseBody(res: Response): Promise<unknown> {
  const raw = await res.text();
  if (!raw) return "";
  try {
    return JSON.parse(raw);
  } catch {
    return raw; // Respond to Webhook devolvendo texto puro
  }
}

/**
 * Extrai o texto da resposta de vários formatos que o "Respond to Webhook"
 * pode retornar: texto puro, { reply }, { output }, { text }, arrays, { json }, etc.
 */
function extractReply(data: unknown): string {
  if (data == null) return "(sem resposta)";
  if (typeof data === "string") return data.trim() || "(sem resposta)";
  if (Array.isArray(data)) return data.length ? extractReply(data[0]) : "(sem resposta)";
  if (typeof data === "object") {
    const o = data as Record<string, unknown>;
    const cand = o.reply ?? o.output ?? o.text ?? o.answer ?? o.message ?? o.response;
    if (typeof cand === "string") return cand.trim() || "(sem resposta)";
    if (o.json !== undefined) return extractReply(o.json);
    if (o.data !== undefined) return extractReply(o.data);
  }
  return "(sem resposta)";
}
