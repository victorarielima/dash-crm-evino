// Cliente Supabase — SÓ NO SERVIDOR (usa a Service Role Key, nunca no client).
// Guarda o histórico de conversas do chat de IA.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Supabase não configurado: defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.");
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
