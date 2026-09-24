"use client";
import { useEffect, useMemo, useState } from "react";
import { CHANNELS, PERIODS } from "@/lib/catalog";
import type { AnalyticsResult, BrandId, ChannelId, MetricKey, PeriodId } from "@/lib/insider/types";
import { formatValue } from "@/lib/format";
import Sidebar from "@/components/Sidebar";
import { useBrand } from "@/components/BrandContext";
import { IconCalendar, IconExport } from "@/components/icons";
import KpiCards from "@/components/KpiCards";
import TrendChart from "@/components/TrendChart";
import CampaignTable from "@/components/CampaignTable";
import PerformanceChart from "@/components/PerformanceChart";

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const HERO_KEYS: MetricKey[] = ["revenue", "converted", "bottles"];

export default function Page() {
  const { brand, ready: brandReady } = useBrand();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [channel, setChannel] = useState<ChannelId>("email");
  const [period, setPeriod] = useState<PeriodId>("30d");
  const [customStart, setCustomStart] = useState(todayISO());
  const [customEnd, setCustomEnd] = useState(todayISO());

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyticsResult | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [metric, setMetric] = useState<MetricKey | null>(null);
  const [purchaseMetric, setPurchaseMetric] = useState<MetricKey>("revenue");
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("iacrm-sidebar-collapsed");
    if (stored !== null) setSidebarCollapsed(stored === "true");
  }, []);

  useEffect(() => {
    window.localStorage.setItem("iacrm-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const missingCustom = (pd: PeriodId) => pd === "custom" && (!customStart || !customEnd);

  async function run(options?: {
    brandArg?: BrandId;
    chArg?: ChannelId;
    pdArg?: PeriodId;
    startArg?: string;
    endArg?: string;
  }) {
    const brandArg = options?.brandArg ?? brand;
    const chArg = options?.chArg ?? channel;
    const pdArg = options?.pdArg ?? period;
    const startArg = options?.startArg ?? customStart;
    const endArg = options?.endArg ?? customEnd;

    if (pdArg === "custom" && (!startArg || !endArg)) return;
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams({ brand: brandArg, channel: chArg, period: pdArg });
      if (pdArg === "custom") {
        params.set("start", startArg);
        params.set("end", endArg);
      }
      const res = await fetch(`/api/analytics?${params.toString()}`);
      const data: AnalyticsResult = await res.json();
      setResult(data);
      setMetric(data.primary ?? data.metrics?.[0]?.key ?? null);
    } catch (e: any) {
      setFetchError(e?.message || "Falha ao buscar os dados.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  // Carregamento inicial (após ler a conta salva) e recarga a cada troca de conta.
  useEffect(() => {
    if (!brandReady) return;
    run({ brandArg: brand });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandReady, brand]);

  function pickChannel(c: ChannelId) {
    setChannel(c);
    run({ chArg: c });
  }

  function pickPeriod(next: PeriodId) {
    setPeriod(next);
    run({ pdArg: next });
  }

  function pickCustomStart(next: string) {
    setCustomStart(next);
    if (period === "custom") run({ pdArg: "custom", startArg: next, endArg: customEnd });
  }

  function pickCustomEnd(next: string) {
    setCustomEnd(next);
    if (period === "custom") run({ pdArg: "custom", startArg: customStart, endArg: next });
  }

  async function exportSheet() {
    if (exporting) return;
    setExporting(true);
    setExportMsg(null);
    try {
      const payload: Record<string, string> = { brand, channel, period };
      if (period === "custom") {
        payload.start = customStart;
        payload.end = customEnd;
      }
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setExportMsg(
        data.ok
          ? { ok: true, text: `${data.appended} campanha(s) exportada(s) para a aba ${data.tab}.` }
          : { ok: false, text: data.error || "Falha ao exportar." },
      );
    } catch (e: any) {
      setExportMsg({ ok: false, text: e?.message || "Falha ao exportar." });
    } finally {
      setExporting(false);
    }
  }

  const activeMetric = useMemo<MetricKey | null>(() => {
    if (!result) return null;
    if (metric && result.metrics.some((m) => m.key === metric)) return metric;
    return result.primary ?? result.metrics[0]?.key ?? null;
  }, [result, metric]);

  const hasData = result?.ok && result.series.length > 0;

  return (
    <div className={"app" + (sidebarCollapsed ? " is-collapsed" : "")}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((value) => !value)} />

      <main className="main">
        {/* Top bar: abas de canal + período + atualizar */}
        <div className="topbar">
          <div className="channel-tabs">
            {CHANNELS.map((c) => (
              <button
                key={c.id}
                className={"ch-tab" + (channel === c.id ? " on" : "")}
                onClick={() => pickChannel(c.id)}
              >
                {c.label}
                {!c.supportsHistory && <span className="flag">hoje</span>}
              </button>
            ))}
          </div>
          <div className="topbar-actions">
            <div className="period-pick">
              <IconCalendar size={16} />
              <select value={period} onChange={(e) => pickPeriod(e.target.value as PeriodId)} aria-label="Período">
                {PERIODS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="export-btn"
              onClick={exportSheet}
              disabled={exporting || !(result?.ok && result.campaigns.length > 0)}
              title="Exportar as campanhas para a planilha CRM"
            >
              <IconExport size={16} className={exporting ? "spin" : undefined} />
              {exporting ? "Exportando…" : "Exportar"}
            </button>
          </div>
        </div>

        {exportMsg && (
          <div className={"note" + (exportMsg.ok ? " ok" : " err")}>{exportMsg.text}</div>
        )}

        {period === "custom" && (
          <div className="custom-range">
            <label className="field">
              <span>Início</span>
              <input type="date" value={customStart} max={todayISO()} onChange={(e) => pickCustomStart(e.target.value)} />
            </label>
            <label className="field">
              <span>Fim</span>
              <input type="date" value={customEnd} max={todayISO()} onChange={(e) => pickCustomEnd(e.target.value)} />
            </label>
          </div>
        )}

        {/* Loading / errors */}
        {loading && (
          <div className="empty">
            <div className="spinner" />
            Consultando Insider e Redshift…
          </div>
        )}
        {!loading && fetchError && <div className="note err">{fetchError}</div>}
        {!loading && result && !result.ok && (
          <div className="note err">
            {result.channelLabel}: {result.error || "Não foi possível obter os dados."}
          </div>
        )}

        {!loading && result && result.ok && (
          <>
            {/* Hero: métricas de venda (Redshift) */}
            {(() => {
              const k = result.kpis;
              const ticket = k.revenue && k.converted ? k.revenue / k.converted : undefined;
              const heroStats = [
                { label: "Conversões", value: formatValue(k.converted, "int") },
                { label: "Garrafas", value: formatValue(k.bottles, "int") },
                { label: "Ticket médio", value: formatValue(ticket, "brl") },
              ].filter((s) => s.value !== "—");
              return (
                <div className="hero">
                  <div className="onda-vinho-fundo wave-left"></div>
                  <div className="onda-vinho-fundo wave-center"></div>
                  <div className="onda-vinho-fundo wave-right"></div>
                  <div className="onda-vinho-frente wave-left"></div>
                  <div className="onda-vinho-frente wave-center"></div>
                  <div className="onda-vinho-frente wave-right"></div>
                  <div className="hero-main">
                    <div className="hero-label">Receita no período</div>
                    <div className="hero-value">{formatValue(k.revenue, "brl")}</div>
                  </div>
                  {heroStats.length > 0 && (
                    <div className="hero-stats">
                      {heroStats.map((s, i) => (
                        <div className="hero-stat" key={i}>
                          <div className="hl">{s.label}</div>
                          <div className="hv">{s.value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            <KpiCards result={result} exclude={HERO_KEYS} />

            {/* Ressalvas do canal/conta (limitações de API, agregação, garrafas na GC…) */}
            {result.notes.map((n, i) => (
              <div className="note" key={i}>
                {n}
              </div>
            ))}

            {hasData && activeMetric && (
              <>
                <div className="card">
                  <div className="card-head">
                    <h2>Evolução no período</h2>
                    <div className="metric-select">
                      {result.metrics.map((m) => (
                        <button key={m.key} className={m.key === activeMetric ? "on" : ""} onClick={() => setMetric(m.key)}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <TrendChart result={result} metric={activeMetric} />
                </div>

                {result.campaigns.length > 0 && (
                  <div className="card">
                    <div className="card-head">
                      <h2>Campanhas</h2>
                      <span className="card-hint">Clique numa campanha para ver o detalhe</span>
                    </div>
                    <CampaignTable result={result} period={period} />
                  </div>
                )}

                {(() => {
                  const PURCHASE_METRICS: { key: MetricKey; label: string; format: "brl" | "int" }[] = [
                    { key: "revenue", label: "Receita", format: "brl" },
                    { key: "converted", label: "Conversões", format: "int" },
                    { key: "bottles", label: "Garrafas", format: "int" },
                  ];
                  const pm = PURCHASE_METRICS.find((m) => m.key === purchaseMetric) ?? PURCHASE_METRICS[0];
                  const hasHourly = result.hourly.some((h) => (h.metrics[pm.key] ?? 0) > 0);
                  return (
                    <div className="card">
                      <div className="card-head">
                        <h2>Horário real das compras</h2>
                        <div className="metric-select">
                          {PURCHASE_METRICS.map((m) => (
                            <button key={m.key} className={m.key === pm.key ? "on" : ""} onClick={() => setPurchaseMetric(m.key)}>
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {hasHourly ? (
                        <PerformanceChart
                          points={result.hourly.map((h) => ({
                            label: String(h.hour).padStart(2, "0") + "h",
                            value: h.metrics[pm.key] ?? 0,
                          }))}
                          format={pm.format}
                        />
                      ) : (
                        <div className="note">Sem compras registradas no período para este canal.</div>
                      )}
                    </div>
                  );
                })()}

              </>
            )}
          </>
        )}

        {!loading && !result && !fetchError && (
          <div className="empty">
            <b>Selecione canal e período</b>
            Escolha um canal e um período para carregar os dados automaticamente.
          </div>
        )}
      </main>
    </div>
  );
}
