import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listConversations } from "@/lib/ai/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id || session?.user?.email;
  if (!userId) return NextResponse.json({ ok: false, error: "Não autenticado." }, { status: 401 });
  try {
    const conversations = await listConversations(userId);
    return NextResponse.json({ ok: true, conversations });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Erro ao listar conversas." }, { status: 500 });
  }
}
