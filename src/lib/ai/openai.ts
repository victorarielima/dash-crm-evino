// Wrapper mínimo do cliente OpenAI (servidor). Modelo configurável via env.
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

let client: OpenAI | null = null;

export function openai(): OpenAI {
  if (client) return client;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada no .env.");
  client = new OpenAI({ apiKey });
  return client;
}

export const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-4o";

export const SYSTEM_PROMPT = `Você é o analista de CRM interno da Evino (e-commerce de vinhos).
Sua função é dar ideias, diagnósticos e sugestões acionáveis sobre as campanhas de marketing
multicanal (Email, SMS, WhatsApp, Web Push e App Push), sempre com base nos DADOS fornecidos
no contexto (KPIs, campanhas, horários e sazonalidade).

Diretrizes:
- Responda em português do Brasil, de forma objetiva e prática.
- Baseie-se SOMENTE nos dados do contexto. Se um dado não estiver presente, diga que não tem essa informação — nunca invente números.
- Quando fizer sentido, destaque: melhores/piores campanhas, horários de melhor conversão, quedas de entrega, e oportunidades de teste A/B.
- Traga recomendações concretas (o que fazer a seguir), não só descrição.
- Use números do contexto para embasar (receita, conversões, CTR, entregabilidade).
- Formate com listas e negrito quando ajudar a leitura.`;

export async function chatComplete(messages: ChatCompletionMessageParam[]): Promise<string> {
  const res = await openai().chat.completions.create({
    model: OPENAI_MODEL,
    messages,
    temperature: 0.4,
  });
  return res.choices[0]?.message?.content?.trim() || "(sem resposta)";
}
