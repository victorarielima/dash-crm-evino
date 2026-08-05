// Receita / conversões / garrafas REAIS a partir dos pedidos no Redshift
// (dora_red_aggregations). Adaptado da consulta do Looker (last-click).
// A hora usa America/Sao_Paulo via `dateadd(hour,-3, created_at)`.
import { redshiftQuery } from "./redshift";
import { isoDay } from "./insider/periods";
import type { ChannelId } from "./insider/types";

// ChannelId do app → valor de `channel` no ev_last_click_full.
export const RS_CHANNEL: Partial<Record<ChannelId, string>> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
  webpush: "WebPush",
  apppush: "AppPush",
};

const FROM = `from dora_red_aggregations.ev_fact_order_item oi
  left join dora_red_aggregations.ev_last_click_full lc on lc.src_id_order = oi.src_id_order`;
// canal atribuído (mesma regra do Looker: override do ADVANTAGEROAS p/ Facebook)
const CH = `(case when lc.utm_medium='Ads' and lc.utm_campaign='ADVANTAGEROAS.PURCHASE' then 'Facebook' else lc.channel end)`;
// hora local (BR) da compra
const BR = `dateadd(hour,-3, lc.created_at)`;
// filtro de "receita válida" (mesmo do Looker)
const VALID = `oi.is_paid=1
  and coalesce(upper(oi.voucher_code),'') not ilike 'TV%'
  and coalesce(oi.payment_method,'') <> 'sac'
  and oi.order_increment_id not like 'BRI%'
  and (case when coalesce(oi.marketplace_provider,'')='vivino' then 1 else 0 end)=0`;
const REV = `coalesce(sum(oi.price_to_pay),0)+coalesce(sum(oi.item_shipping_amount),0)`;
const ORD = `count(distinct oi.order_increment_id)`;
const BOT = `coalesce(sum(case when oi.is_bottle=1 then oi.qty_ordered else 0 end),0)`;
const WHERE = `where ${CH}=$1 and ${BR} >= $2 and ${BR} <= $3 and (${VALID})`;

export interface RevAgg {
  revenue: number;
  orders: number;
  bottles: number;
}
const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const params = (channelDb: string, start: Date, end: Date): [string, string, string] => [
  channelDb,
  `${isoDay(start)} 00:00:00`,
  `${isoDay(end)} 23:59:59`,
];

export async function revenueSummary(channelDb: string, start: Date, end: Date): Promise<RevAgg> {
  const rows = await redshiftQuery<any>(
    `select ${REV} revenue, ${ORD} orders, ${BOT} bottles ${FROM} ${WHERE}`,
    params(channelDb, start, end),
  );
  const r = rows[0] || {};
  return { revenue: n(r.revenue), orders: n(r.orders), bottles: n(r.bottles) };
}

export async function revenueByDay(channelDb: string, start: Date, end: Date): Promise<Map<string, RevAgg>> {
  const rows = await redshiftQuery<any>(
    `select to_char(${BR},'YYYY-MM-DD') d, ${REV} revenue, ${ORD} orders, ${BOT} bottles ${FROM} ${WHERE} group by 1`,
    params(channelDb, start, end),
  );
  const m = new Map<string, RevAgg>();
  for (const r of rows) m.set(String(r.d), { revenue: n(r.revenue), orders: n(r.orders), bottles: n(r.bottles) });
  return m;
}

/** Array de 24 posições (hora 0–23) da compra real. */
export async function revenueByHour(channelDb: string, start: Date, end: Date): Promise<RevAgg[]> {
  const rows = await redshiftQuery<any>(
    `select extract(hour from ${BR}) hr, ${REV} revenue, ${ORD} orders, ${BOT} bottles ${FROM} ${WHERE} group by 1`,
    params(channelDb, start, end),
  );
  const arr: RevAgg[] = Array.from({ length: 24 }, () => ({ revenue: 0, orders: 0, bottles: 0 }));
  for (const r of rows) {
    const h = n(r.hr);
    if (h >= 0 && h < 24) arr[h] = { revenue: n(r.revenue), orders: n(r.orders), bottles: n(r.bottles) };
  }
  return arr;
}

/** Map de utm_campaign → agregados (casa com o nome da campanha da Insider). */
export async function revenueByCampaign(channelDb: string, start: Date, end: Date): Promise<Map<string, RevAgg>> {
  const rows = await redshiftQuery<any>(
    `select lc.utm_campaign camp, ${REV} revenue, ${ORD} orders, ${BOT} bottles ${FROM} ${WHERE} group by 1`,
    params(channelDb, start, end),
  );
  // Chave normalizada (minúsculo + trim): utm_campaign no Redshift costuma vir
  // em minúsculas, enquanto o nome da campanha na Insider preserva a caixa.
  const m = new Map<string, RevAgg>();
  for (const r of rows) if (r.camp) m.set(String(r.camp).trim().toLowerCase(), { revenue: n(r.revenue), orders: n(r.orders), bottles: n(r.bottles) });
  return m;
}
