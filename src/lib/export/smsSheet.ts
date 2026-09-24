// Monta as linhas do SMS no layout EXATO da aba `insider_SMS` (37 colunas),
// a partir do detail[] do endpoint /v1/overall (uma chamada cobre o período).
// Colunas: A Campaign | B ID | C Status | D Campaign Type | E Message Type
//  F Tags | G Delivered | H Clicks | I Conversions | J Revenue | K Targeted
//  L Sent | M Dropped | N Delivery Rate | O Undelivered | P CTR | Q CR
//  R SMS Message Parts | S MMS Messages | T Unsubscribe Rate | U Unsubscribes
//  V Frequency Capped | W Duplicates | X Internal Errors | Y Country Code Drops
//  Z Invalid Phone Numbers | AA Coupon List Drops | AB IYS Drops | AC MMS Drops
//  AD Silent Hours | AE Carrier Violation | AF Hard Bounces | AG Soft Bounces
//  AH Delivery Failures | AI Delivery Report Missing | AJ Starts On | AK Ends On
import { insiderEnv } from "@/lib/insider/env";
import { insiderFetch, num, pick } from "@/lib/insider/http";
import { epochSec } from "@/lib/insider/periods";
import type { BrandId } from "@/lib/insider/types";

const BASE = "https://sms.useinsider.com/analytics";

type Cell = string | number;

// epoch (s) → serial de data do Sheets em horário local (BR = UTC-3).
function serialSP(sec: unknown): Cell {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return "";
  return (n * 1000 - 3 * 3600 * 1000) / 86400000 + 25569;
}
// "6,153" / "15,554.29" / "0" → número (vírgula = milhar).
function money(v: unknown): number {
  if (typeof v === "number") return v;
  const n = Number(String(v ?? "").replace(/,/g, "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}
// rate já vem como "97.27%" (texto) — passa direto; ausente → "0.00%".
function rate(v: unknown): string {
  const s = typeof v === "string" ? v : "";
  return s || "0.00%";
}

export async function buildSmsRows(brand: BrandId, start: Date, end: Date): Promise<Cell[][]> {
  const cap = Math.min(epochSec(end), epochSec(new Date())) - 1;
  const json = await insiderFetch(`${BASE}/v1/overall`, {
    method: "POST",
    headers: { "X-INS-AUTH-KEY": insiderEnv.smsKey(brand), "Content-Type": "application/json" },
    body: JSON.stringify({ startTime: epochSec(start), endTime: cap }),
  });
  const detail: any[] = (pick(json, "detail") as any[]) || [];

  const rows: Cell[][] = detail
    .slice()
    .sort((a, b) => num(a.startTime) - num(b.startTime)) // cronológico
    .map((d): Cell[] => {
      const dm = d.droppedMessages || {};
      const um = d.undeliveredMessages || {};
      const cnt = (o: any) => num(o?.count ?? o);
      const tags = Array.isArray(d.tags) ? d.tags.join(", ") : String(d.tags ?? "");
      return [
        String(d.campaignName ?? d.campaignId ?? ""), // A
        num(d.campaignId), // B
        String(d.status ?? ""), // C
        "", // D Campaign Type (não exposto no detail)
        "SMS", // E Message Type
        tags, // F
        num(pick(d, "delivery.count.delivered")), // G Delivered
        num(pick(d, "clickThrough.clicks")), // H Clicks
        num(pick(d, "conversion.conversions")), // I Conversions
        money(pick(d, "clickThrough.revenue")), // J Revenue
        num(d.targeted), // K Targeted
        num(d.sent), // L Sent
        num(d.dropped), // M Dropped
        rate(pick(d, "delivery.rate")), // N Delivery Rate
        num(pick(d, "delivery.count.undelivered")), // O Undelivered
        rate(pick(d, "clickThrough.rate")), // P CTR
        rate(pick(d, "conversion.rate")), // Q CR
        num(d.messageParts), // R SMS Message Parts
        num(d.mmsMessages), // S MMS Messages
        rate(pick(d, "unsubscribers.rate")), // T Unsubscribe Rate
        num(pick(d, "unsubscribers.count")), // U Unsubscribes
        cnt(dm.frequencyCapped), // V Frequency Capped
        cnt(dm.duplicates), // W Duplicates
        cnt(dm.internalErrors), // X Internal Errors
        cnt(dm.countryCodeDrops), // Y Country Code Drops
        cnt(dm.invalidPhoneNumbers), // Z Invalid Phone Numbers
        cnt(dm.couponListDrops), // AA Coupon List Drops
        cnt(dm.iysDrops), // AB IYS Drops
        cnt(dm.mmsDrops), // AC MMS Drops
        cnt(dm.silentHours), // AD Silent Hours
        cnt(um.carrierViolations), // AE Carrier Violation
        cnt(um.hardBounces), // AF Hard Bounces
        cnt(um.softBounces), // AG Soft Bounces
        cnt(um.deliveryFailures), // AH Delivery Failures
        cnt(um.deliveryReportMissing), // AI Delivery Report Missing
        serialSP(d.startTime), // AJ Starts On
        serialSP(d.endTime), // AK Ends On
      ];
    });

  return rows;
}
