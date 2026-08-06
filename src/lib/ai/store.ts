// CRUD do histórico de chat no Supabase. Só no servidor.
import { supabase } from "@/lib/supabase";

export interface ConvRow {
  id: string;
  title: string;
  updated_at: string;
}
export interface MsgRow {
  role: "user" | "assistant" | "system";
  content: string;
}

function titleFrom(text: string): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length > 60 ? t.slice(0, 57) + "…" : t || "Nova conversa";
}

/** Cria uma conversa nova e retorna seu id + título. */
export async function createConversation(userId: string, email: string | null, firstMessage: string) {
  const { data, error } = await supabase()
    .from("chat_conversations")
    .insert({ user_id: userId, user_email: email, title: titleFrom(firstMessage) })
    .select("id, title")
    .single();
  if (error) throw new Error("Supabase (createConversation): " + error.message);
  return data as { id: string; title: string };
}

/** Confere se a conversa pertence ao usuário (evita acesso cruzado). */
export async function getConversationForUser(id: string, userId: string) {
  const { data, error } = await supabase()
    .from("chat_conversations")
    .select("id, title")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Supabase (getConversation): " + error.message);
  return data as { id: string; title: string } | null;
}

export async function listConversations(userId: string): Promise<ConvRow[]> {
  const { data, error } = await supabase()
    .from("chat_conversations")
    .select("id, title, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("Supabase (listConversations): " + error.message);
  return (data ?? []) as ConvRow[];
}

/** Últimas mensagens de uma conversa (ordem cronológica). */
export async function getMessages(conversationId: string, limit = 20): Promise<MsgRow[]> {
  const { data, error } = await supabase()
    .from("chat_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Supabase (getMessages): " + error.message);
  return ((data ?? []) as MsgRow[]).reverse();
}

export async function appendMessage(
  conversationId: string,
  role: MsgRow["role"],
  content: string,
  context?: unknown,
) {
  const { error } = await supabase()
    .from("chat_messages")
    .insert({ conversation_id: conversationId, role, content, context: context ?? null });
  if (error) throw new Error("Supabase (appendMessage): " + error.message);
}

export async function touchConversation(id: string) {
  await supabase().from("chat_conversations").update({ updated_at: new Date().toISOString() }).eq("id", id);
}
