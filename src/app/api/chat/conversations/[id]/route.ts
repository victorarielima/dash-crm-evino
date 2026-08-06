import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getConversationForUser, getMessages } from "@/lib/ai/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  const userId = session?.user?.id || session?.user?.email;
  if (!userId) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  try {
    const conv = await getConversationForUser(params.id, userId);
    if (!conv) return NextResponse.json({ ok: false, error: "Conversa não encontrada." }, { status: 404 });
    const messages = await getMessages(conv.id, 100);
    return NextResponse.json({ ok: true, conversation: conv, messages });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Erro ao carregar conversa." }, { status: 500 });
  }
}
