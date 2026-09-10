import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { askN8nAgent } from "@/lib/ai/n8n";
import {
  appendMessage,
  createConversation,
  getConversationForUser,
  getMessages,
  touchConversation,
} from "@/lib/ai/store";
import { BRAND_LABEL, DEFAULT_BRAND, isBrandId } from "@/lib/brands";
import type { BrandId, ChannelId, PeriodId } from "@/lib/insider/types";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const CHANNELS: ChannelId[] = ["email", "sms", "whatsapp", "webpush", "apppush"];

interface Body {
  conversationId?: string;
  message?: string;
  context?: { brand?: BrandId; channel?: ChannelId; period?: PeriodId; campaignName?: string };
}

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id || session?.user?.email;
  if (!userId) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const message = (body.message || "").trim();
  if (!message) return NextResponse.json({ ok: false, error: "Mensagem vazia." }, { status: 400 });

  const channel = body.context?.channel;
  if (channel && !CHANNELS.includes(channel)) {
    return NextResponse.json({ ok: false, error: "Canal inválido." }, { status: 400 });
  }

  const rawBrand = body.context?.brand;
  if (rawBrand !== undefined && !isBrandId(rawBrand)) {
    return NextResponse.json({ ok: false, error: "Conta inválida." }, { status: 400 });
  }
  const brand = isBrandId(rawBrand) ? rawBrand : DEFAULT_BRAND;
  // O agente precisa saber de qual conta são os dados (contas Insider distintas).
  const context = { ...(body.context ?? {}), brand, brandLabel: BRAND_LABEL[brand] };

  try {
    // 1) conversa (nova ou existente, sempre do próprio usuário)
    let conv: { id: string; title: string };
    let history: { role: "user" | "assistant" | "system"; content: string }[] = [];
    if (body.conversationId) {
      const found = await getConversationForUser(body.conversationId, userId);
      if (!found) return NextResponse.json({ ok: false, error: "Conversa não encontrada." }, { status: 404 });
      conv = found;
      history = await getMessages(conv.id, 20);
    } else {
      conv = await createConversation(userId, session?.user?.email ?? null, message);
    }

    // 2) envia tudo ao agente do n8n (que consulta o MCP da Insider).
    //    A "memória" vai no payload (history) — fonte única na chat_messages.
    const reply = await askN8nAgent({
      conversationId: conv.id,
      userId,
      userEmail: session?.user?.email ?? null,
      message,
      history,
      context,
    });

    // 3) persiste (usuário + resposta) e atualiza a conversa
    await appendMessage(conv.id, "user", message, context);
    await appendMessage(conv.id, "assistant", reply);
    await touchConversation(conv.id);

    return NextResponse.json({ ok: true, conversationId: conv.id, title: conv.title, reply });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Erro ao processar o chat." }, { status: 500 });
  }
}
