// Receita / conversões / garrafas REAIS a partir dos pedidos no Redshift
// (dora_red_aggregations). Adaptado da consulta do Looker (last-click).
// A hora usa America/Sao_Paulo via `dateadd(hour,-3, created_at)`.
//
// Cada marca tem seu próprio par de tabelas (ev_* para Evino, gc_* para Grand
// Cru) e pequenas diferenças de colunas — ver BRAND_SQL abaixo.
import { redshiftQuery } from "./redshift";
import { isoDay } from "./insider/periods";
import type { BrandId, ChannelId } from "./insider/types";

// ChannelId do app → valor de `channel` no *_last_click_full (igual nas 2 marcas).
export const RS_CHANNEL: Partial<Record<ChannelId, string>> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
  webpush: "WebPush",
  apppush: "AppPush",
};

interface BrandSql {
  /** Prefixo das tabelas no schema dora_red_aggregations. */
  prefix: string;
  /** Coluna do cupom usada no filtro "TV%". */
  voucherCol: string;
  /** Expressão de garrafas por item do pedido. */
  bottleQty: string;
  /** Grand Cru não tem marketplace_provider (filtro do Vivino é só da Evino). */
  excludeVivino: boolean;
  /** Aviso exibido na UI quando a métrica é aproximada. */
  note?: string;
}

const BRAND_SQL: Record<BrandId, BrandSql> = {
  evino: {
    prefix: "ev_",
    voucherCol: "voucher_code",
    bottleQty: "oi.qty_ordered",
    excludeVivino: true,
  },
  grandcru: {
    prefix: "gc_",
    voucherCol: "coupon_code",
    // gc_fact_order_item não expõe quantidade por item (qty_ordered / selection_qty
    // vêm nulas) → conta 1 garrafa por item de pedido marcado como garrafa.
    bottleQty: "1",
    excludeVivino: false,
    note:
      "Grand Cru: garrafas contadas por item do pedido — a tabela gc_fact_order_item não expõe quantidade por item.",
  },
};

/** Aviso da marca sobre a métrica de garrafas (undefined quando exata). */
export const brandRevenueNote = (brand: BrandId): string | undefined => BRAND_SQL[brand].note;

// hora local (BR) da compra
const BR = `dateadd(hour,-3, lc.created_at)`;
const REV = `coalesce(sum(oi.price_to_pay),0)+coalesce(sum(oi.item_shipping_amount),0)`;
const ORD = `count(distinct oi.order_increment_id)`;
// canal atribuído (mesma regra do Looker: override do ADVANTAGEROAS p/ Facebook)
const CH = `(case when lc.utm_medium='Ads' and lc.utm_campaign='ADVANTAGEROAS.PURCHASE' then 'Facebook' else lc.channel end)`;

interface Sql {
  from: string;
  where: string;
  bottles: string;
}

function sqlFor(brand: BrandId): Sql {
  const b = BRAND_SQL[brand];
  const from = `from dora_red_aggregations.${b.prefix}fact_order_item oi
  left join dora_red_aggregations.${b.prefix}last_click_full lc on lc.src_id_order = oi.src_id_order`;
  // filtro de "receita válida" (mesmo do Looker)
  const valid = [
    `oi.is_paid=1`,
    `coalesce(upper(oi.${b.voucherCol}),'') not ilike 'TV%'`,
    `coalesce(oi.payment_method,'') <> 'sac'`,
    `oi.order_increment_id not like 'BRI%'`,
    ...(b.excludeVivino
      ? [`(case when coalesce(oi.marketplace_provider,'')='vivino' then 1 else 0 end)=0`]
      : []),
  ].join("\n  and ");
  return {
    from,
    where: `where ${CH}=$1 and ${BR} >= $2 and ${BR} <= $3 and (${valid})`,
    bottles: `coalesce(sum(case when oi.is_bottle=1 then ${b.bottleQty} else 0 end),0)`,
  };
}

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

export async function revenueSummary(
  brand: BrandId,
  channelDb: string,
  start: Date,
  end: Date,
): Promise<RevAgg> {
  const q = sqlFor(brand);
  const rows = await redshiftQuery<any>(
    `select ${REV} revenue, ${ORD} orders, ${q.bottles} bottles ${q.from} ${q.where}`,
    params(channelDb, start, end),
  );
  const r = rows[0] || {};
  return { revenue: n(r.revenue), orders: n(r.orders), bottles: n(r.bottles) };
}

export async function revenueByDay(
  brand: BrandId,
  channelDb: string,
  start: Date,
  end: Date,
): Promise<Map<string, RevAgg>> {
  const q = sqlFor(brand);
  const rows = await redshiftQuery<any>(
    `select to_char(${BR},'YYYY-MM-DD') d, ${REV} revenue, ${ORD} orders, ${q.bottles} bottles ${q.from} ${q.where} group by 1`,
    params(channelDb, start, end),
  );
  const m = new Map<string, RevAgg>();
  for (const r of rows) m.set(String(r.d), { revenue: n(r.revenue), orders: n(r.orders), bottles: n(r.bottles) });
  return m;
}

/** Array de 24 posições (hora 0–23) da compra real. */
export async function revenueByHour(
  brand: BrandId,
  channelDb: string,
  start: Date,
  end: Date,
): Promise<RevAgg[]> {
  const q = sqlFor(brand);
  const rows = await redshiftQuery<any>(
    `select extract(hour from ${BR}) hr, ${REV} revenue, ${ORD} orders, ${q.bottles} bottles ${q.from} ${q.where} group by 1`,
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
export async function revenueByCampaign(
  brand: BrandId,
  channelDb: string,
  start: Date,
  end: Date,
): Promise<Map<string, RevAgg>> {
  const q = sqlFor(brand);
  const rows = await redshiftQuery<any>(
    `select lc.utm_campaign camp, ${REV} revenue, ${ORD} orders, ${q.bottles} bottles ${q.from} ${q.where} group by 1`,
    params(channelDb, start, end),
  );
  // Chave normalizada (minúsculo + trim): utm_campaign no Redshift costuma vir
  // em minúsculas, enquanto o nome da campanha na Insider preserva a caixa.
  const m = new Map<string, RevAgg>();
  for (const r of rows) if (r.camp) m.set(String(r.camp).trim().toLowerCase(), { revenue: n(r.revenue), orders: n(r.orders), bottles: n(r.bottles) });
  return m;
}
