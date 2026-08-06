"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { CHANNELS, PERIODS } from "@/lib/catalog";
import type { ChannelId, PeriodId } from "@/lib/insider/types";
import { IconAI, IconPlus, IconSend, IconCalendar } from "@/components/icons";

type Role = "user" | "assistant" | "system";
interface Msg {
  role: Role;
  content: string;
}
interface Conv {
  id: string;
  title: string;
  updated_at: string;
}
interface Ctx {
  channel?: ChannelId;
  campaignName?: string;
  period: PeriodId;
}

// ── mini-markdown seguro (negrito, listas, títulos) → JSX ──
function renderMarkdown(text: string) {
  const lines = text.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={"ul" + blocks.length}>
          {list.map((li, i) => (
            <li key={i}>{inline(li)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
    );
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\s*[-*]\s+/.test(line)) {
      list.push(line.replace(/^\s*[-*]\s+/, ""));
    } else if (/^#{1,4}\s+/.test(line)) {
      flush();
      blocks.push(<h4 key={"h" + blocks.length}>{inline(line.replace(/^#{1,4}\s+/, ""))}</h4>);
    } else if (line.trim() === "") {
      flush();
    } else {
      flush();
      blocks.push(<p key={"p" + blocks.length}>{inline(line)}</p>);
    }
  }
  flush();
  return blocks;
}

export default function ChatPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conv[]>([]);

  const [ctx, setCtx] = useState<Ctx>({ period: "30d" });

  // popover do "+"
  const [plusOpen, setPlusOpen] = useState(false);
  const [plusStep, setPlusStep] = useState<"channel" | "campaign">("channel");
  const [pickChannel, setPickChannel] = useState<ChannelId | null>(null);
  const [campaigns, setCampaigns] = useState<string[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [campFilter, setCampFilter] = useState("");

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const plusRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("iacrm-sidebar-collapsed");
    if (stored !== null) setSidebarCollapsed(stored === "true");
    loadConversations();
  }, []);
  useEffect(() => {
    window.localStorage.setItem("iacrm-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);
  // fecha o popover ao clicar fora
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (plusOpen && plusRef.current && !plusRef.current.contains(e.target as Node)) setPlusOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [plusOpen]);

  async function loadConversations() {
    try {
      const res = await fetch("/api/chat/conversations");
      const data = await res.json();
      if (data.ok) setConversations(data.conversations);
    } catch {
      /* silencioso */
    }
  }

  async function openConversation(id: string) {
    try {
      const res = await fetch(`/api/chat/conversations/${id}`);
      const data = await res.json();
      if (data.ok) {
        setConversationId(id);
        setMessages(data.messages.map((m: Msg) => ({ role: m.role, content: m.content })));
      }
    } catch {
      /* silencioso */
    }
  }

  function newConversation() {
    setConversationId(null);
    setMessages([]);
    setCtx({ period: "30d" });
  }

  async function loadCampaigns(ch: ChannelId, period: PeriodId) {
    setCampaignsLoading(true);
    setCampaigns([]);
    try {
      const res = await fetch(`/api/analytics?channel=${ch}&period=${period}`);
      const data = await res.json();
      const names: string[] = (data.campaigns || []).map((c: { name: string }) => c.name).filter(Boolean);
      setCampaigns(names);
    } catch {
      setCampaigns([]);
    }
    setCampaignsLoading(false);
  }

  function chooseChannel(ch: ChannelId) {
    setPickChannel(ch);
    setPlusStep("campaign");
    setCampFilter("");
    loadCampaigns(ch, ctx.period);
  }
  function chooseGeneral() {
    setCtx((c) => ({ period: c.period }));
    setPlusOpen(false);
    setPlusStep("channel");
    setPickChannel(null);
  }
  function chooseCampaign(name?: string) {
    if (!pickChannel) return;
    setCtx((c) => ({ channel: pickChannel, campaignName: name, period: c.period }));
    setPlusOpen(false);
    setPlusStep("channel");
  }

  const chipLabel = useMemo(() => {
    if (!ctx.channel) return "Análise geral (todos os canais)";
    const label = CHANNELS.find((c) => c.id === ctx.channel)?.label ?? ctx.channel;
    return ctx.campaignName ? `${label} · ${ctx.campaignName}` : `${label} · visão do canal`;
  }, [ctx]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          message: text,
          context: { channel: ctx.channel, campaignName: ctx.campaignName, period: ctx.period },
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Erro ao consultar a IA.");
      setConversationId(data.conversationId);
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      loadConversations();
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: "⚠️ " + (e?.message || "Erro inesperado.") }]);
    }
    setSending(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const filteredCampaigns = campaigns.filter((n) => n.toLowerCase().includes(campFilter.toLowerCase()));

  return (
    <div className={"app" + (sidebarCollapsed ? " is-collapsed" : "")}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((v) => !v)} />

      <main className="main chat-main">
        <div className="chat-layout">
          {/* Histórico */}
          <aside className="chat-history">
            <button className="chat-new" onClick={newConversation}>
              <IconPlus size={16} /> Nova conversa
            </button>
            <div className="chat-hist-list">
              {conversations.length === 0 && <div className="chat-hist-empty">Nenhuma conversa ainda.</div>}
              {conversations.map((c) => (
                <button
                  key={c.id}
                  className={"chat-hist-item" + (c.id === conversationId ? " on" : "")}
                  onClick={() => openConversation(c.id)}
                  title={c.title}
                >
                  {c.title}
                </button>
              ))}
            </div>
          </aside>

          {/* Painel de conversa */}
          <section className="chat-panel">
            <div className="chat-scroll" ref={scrollRef}>
              {messages.length === 0 && (
                <div className="chat-welcome">
                  <div className="chat-welcome-ic">
                    <IconAI size={30} />
                  </div>
                  <h2>Assistente de CRM</h2>
                  <p>
                    Pergunte sobre performance, campanhas, horários e sazonalidade. Use o <b>+</b> para focar num canal ou
                    campanha, ou pergunte direto para uma análise geral.
                  </p>
                  <div className="chat-suggestions">
                    {[
                      "Como foi a performance geral no período?",
                      "Quais campanhas de Web Push converteram melhor?",
                      "Em quais horários vendemos mais?",
                    ].map((s) => (
                      <button key={s} onClick={() => setInput(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={"chat-msg " + m.role}>
                  {m.role === "assistant" && (
                    <span className="chat-ava">
                      <IconAI size={16} />
                    </span>
                  )}
                  <div className="chat-bubble">{m.role === "assistant" ? renderMarkdown(m.content) : m.content}</div>
                </div>
              ))}
              {sending && (
                <div className="chat-msg assistant">
                  <span className="chat-ava">
                    <IconAI size={16} />
                  </span>
                  <div className="chat-bubble">
                    <span className="typing">
                      <i></i>
                      <i></i>
                      <i></i>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Composer */}
            <div className="chat-composer">
              <div className="chat-ctx-row">
                <span className="chat-chip">
                  {chipLabel}
                  {ctx.channel && (
                    <button className="chip-x" onClick={() => setCtx((c) => ({ period: c.period }))} aria-label="Limpar contexto">
                      ×
                    </button>
                  )}
                </span>
                <div className="chat-period">
                  <IconCalendar size={14} />
                  <select
                    value={ctx.period}
                    onChange={(e) => setCtx((c) => ({ ...c, period: e.target.value as PeriodId }))}
                    aria-label="Período"
                  >
                    {PERIODS.filter((p) => p.id !== "custom").map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="chat-input-row">
                <div className="plus-wrap" ref={plusRef}>
                  <button
                    className="chat-plus"
                    onClick={() => {
                      setPlusOpen((o) => !o);
                      setPlusStep("channel");
                    }}
                    aria-label="Selecionar canal/campanha"
                  >
                    <IconPlus size={18} />
                  </button>
                  {plusOpen && (
                    <div className="plus-pop">
                      {plusStep === "channel" && (
                        <>
                          <div className="plus-head">Analisar</div>
                          <button className="plus-opt" onClick={chooseGeneral}>
                            Análise geral (todos os canais)
                          </button>
                          <div className="plus-sep">Ou escolha um canal</div>
                          {CHANNELS.map((c) => (
                            <button key={c.id} className="plus-opt" onClick={() => chooseChannel(c.id)}>
                              {c.label}
                            </button>
                          ))}
                        </>
                      )}
                      {plusStep === "campaign" && (
                        <>
                          <div className="plus-head">
                            <button className="plus-back" onClick={() => setPlusStep("channel")}>
                              ‹
                            </button>
                            {CHANNELS.find((c) => c.id === pickChannel)?.label}
                          </div>
                          <button className="plus-opt strong" onClick={() => chooseCampaign(undefined)}>
                            Sem campanha específica (visão do canal)
                          </button>
                          <input
                            className="plus-search"
                            placeholder="Buscar campanha…"
                            value={campFilter}
                            onChange={(e) => setCampFilter(e.target.value)}
                          />
                          <div className="plus-list">
                            {campaignsLoading && <div className="plus-loading">Carregando campanhas…</div>}
                            {!campaignsLoading && filteredCampaigns.length === 0 && (
                              <div className="plus-loading">Nenhuma campanha no período.</div>
                            )}
                            {!campaignsLoading &&
                              filteredCampaigns.map((n) => (
                                <button key={n} className="plus-opt" onClick={() => chooseCampaign(n)} title={n}>
                                  {n}
                                </button>
                              ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <textarea
                  className="chat-input"
                  placeholder="Pergunte à IA sobre suas campanhas…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                />
                <button className="chat-send" onClick={send} disabled={sending || !input.trim()} aria-label="Enviar">
                  <IconSend size={18} />
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
