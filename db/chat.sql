-- ============================================================
-- Chat de IA — histórico de conversas
-- Rode este script UMA VEZ no Supabase (SQL Editor).
-- O usuário é identificado pelo ID único do Google (user_id = token.sub).
-- ============================================================

create extension if not exists pgcrypto;

-- Uma conversa por thread do chat.
create table if not exists public.chat_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     text        not null,           -- Google sub (identificador único)
  user_email  text,                           -- e-mail corporativo (leitura humana)
  title       text        not null default 'Nova conversa',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_chat_conversations_user
  on public.chat_conversations (user_id, updated_at desc);

-- Mensagens de cada conversa (contexto que a IA relembra).
create table if not exists public.chat_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid        not null references public.chat_conversations (id) on delete cascade,
  role             text        not null check (role in ('user', 'assistant', 'system')),
  content          text        not null,
  -- contexto opcional selecionado no "+": canal, campanha, período
  context          jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists idx_chat_messages_conversation
  on public.chat_messages (conversation_id, created_at);
