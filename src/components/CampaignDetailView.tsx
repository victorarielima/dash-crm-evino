"use client";
// Tela de detalhe de UMA campanha: aberta ao clicar numa linha da tabela de
// campanhas do dashboard. Para Email traz a quebra por provedor, os cliques por
// link e os drops, que vêm do endpoint de statistics da campanha.
import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { CampaignDetail, MetricKey, PeriodId } from "@/lib/insider/types";
import { formatValue } from "@/lib/format";
import { PERIOD_LABELS } from "@/lib/insider/periods";
import Sidebar from "@/components/Sidebar";
import KpiCards from "@/components/KpiCards";
import IspTable from "@/components/IspTable";

const HERO_KEYS: MetricKey[] = ["revenue", "converted", "bottles"];

/** "https://www.evino.com.br/product/x?utm=1" → "evino.com.br/product/x" */
function shortLink(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "") + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return url;
  }
}

export default function CampaignDetailView() {
  const router = useRouter();
  const params = useSearchParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<CampaignDetail | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("iacrm-sidebar-collapsed");
    if (stored !== null) setSidebarCollapsed(stored === "true");
  }, []);
  useEffect(() => {
    window.localStorage.setItem("iacrm-sidebar-collapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const qs = params.toString();
  const nameParam = params.get("name") || params.get("id") || "";
  const periodParam = params.get("period") as PeriodId | null;

  const load = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/campaign?${qs}`);
      setDetail(await res.json());
    } catch (e: any) {
      setFetchError(e?.message || "Falha ao carregar a campanha.");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    load();
  }, [load]);

  const k = detail?.kpis ?? {};
  const ticket = k.revenue && k.converted ? k.revenue / k.converted : undefined;
  const heroStats = [
    { label: "Conversões", value: formatValue(k.converted, "int") },
    { label: "Garrafas", value: formatValue(k.bottles, "int") },
    { label: "Ticket médio", value: formatValue(ticket, "brl") },
  ].filter((s) => s.value !== "—");

  return (
    <div className={"app" + (sidebarCollapsed ? " is-collapsed" : "")}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((v) => !v)} />

      <main className="main">
        <div className="topbar camp-topbar">
          <button className="back-btn" type="button" onClick={() => router.back()}>
            <span aria-hidden="true">&larr;</span> Voltar
          </button>
          <div className="camp-title">
            <h1 title={detail?.name || nameParam}>{detail?.name || nameParam}</h1>
            <div className="camp-meta">
              {detail?.brandLabel && <span className="tag">{detail.brandLabel}</span>}
              {detail?.channelLabel && <span className="tag">{detail.channelLabel}</span>}
              {detail?.status && <span className="tag">{detail.status}</span>}
              {typeof detail?.hour === "number" && (
                <span className="tag">envio {String(detail.hour).padStart(2, "0")}h</span>
              )}
              {detail?.range && (
                <span className="sub">
                  {(periodParam && PERIOD_LABELS[periodParam]) || "Período"}: {detail.range.start} &rarr;{" "}
                  {detail.range.end}
                </span>
              )}
            </div>
          </div>
        </div>

        {loading && (
          <div className="empty">
            <div className="spinner" />
            Consultando a campanha na Insider e no Redshift…
          </div>
        )}
        {!loading && fetchError && <div className="note err">{fetchError}</div>}
        {!loading && detail && !detail.ok && (
          <div className="note err">{detail.error || "Não foi possível detalhar esta campanha."}</div>
        )}

        {!loading && detail && detail.ok && (
          <>
            <div className="hero">
              <div className="hero-main">
                <div className="hero-label">Receita da campanha</div>
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

            <KpiCards result={detail} exclude={HERO_KEYS} />

            {detail.isp.length > 0 && (
              <div className="card">
                <div className="card-head">
                  <h2>Quebra por provedor</h2>
                  <span className="card-hint">{detail.isp.length} provedores</span>
                </div>
                <IspTable rows={detail.isp} />
              </div>
            )}

            {detail.links.length > 0 && (
              <div className="card">
                <div className="card-head">
                  <h2>Cliques por link</h2>
                </div>
                <div className="tbl-scroll">
                  <table className="camp-table">
                    <thead>
                      <tr>
                        <th className="lft">Link</th>
                        <th className="num">Cliques</th>
                        <th className="num">Cliques únicos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.links.map((l, i) => (
                        <tr key={i}>
                          <td className="lft name">
                            <a href={l.link} target="_blank" rel="noreferrer" title={l.link}>
                              {shortLink(l.link)}
                            </a>
                          </td>
                          <td className="num">{formatValue(l.totalClicks, "int")}</td>
                          <td className="num">{formatValue(l.uniqueClicks, "int")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {detail.drops.length > 0 && (
              <div className="card">
                <div className="card-head">
                  <h2>Não enviados</h2>
                  <span className="card-hint">motivos reportados pela Insider</span>
                </div>
                <div className="kpis">
                  {detail.drops.map((d, i) => (
                    <div className="kpi" key={i}>
                      <div className="lab">{d.label}</div>
                      <div className="val">{formatValue(d.count, "int")}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.notes.map((n, i) => (
              <div className="note" key={i}>
                {n}
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
