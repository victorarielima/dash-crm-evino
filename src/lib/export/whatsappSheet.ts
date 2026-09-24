// Monta as linhas do WhatsApp no layout EXATO da aba `insider_Whats` (54 col),
// via POST https://whatsapp.useinsider.com/v1/statistics/overall (details[]).
// Drops do Meta vêm como "XX.XX% (N)": % sobre o total de `drop` (dropDetails)
// ou de `undelivered` (undeliveredDetails). Taxas são sobre delivered/sent.
import { insiderEnv } from "@/lib/insider/env";
import { insiderFetch, num, pick } from "@/lib/insider/http";
import { epochSec } from "@/lib/insider/periods";
import type { BrandId } from "@/lib/insider/types";

const URL = "https://whatsapp.useinsider.com/v1/statistics/overall";

type Cell = string | number;

// epoch (s) → serial do Sheets em horário local (BR = UTC-3).
function serialSP(sec: unknown): Cell {
  const n = Number(sec);
  if (!Number.isFinite(n) || n <= 0) return "";
  return (n * 1000 - 3 * 3600 * 1000) / 86400000 + 25569;
}
const pct = (n: number, d: number): string => `${(d > 0 ? (n / d) * 100 : 0).toFixed(2)}%`;
const pctN = (n: number, d: number): string => `${(d > 0 ? (n / d) * 100 : 0).toFixed(2)}% (${n})`;
const brl = (v: unknown): string => `${Math.round(num(v)).toLocaleString("en-US")} BRL`;
const NA = "N/A";

export async function buildWhatsappRows(brand: BrandId, start: Date, end: Date): Promise<Cell[][]> {
  const endCap = Math.min(epochSec(end), epochSec(new Date()));
  const json = await insiderFetch(URL, {
    method: "POST",
    headers: { "X-INS-AUTH-KEY": insiderEnv.whatsappKey(brand), "Content-Type": "application/json" },
    body: JSON.stringify({
      start_time: epochSec(start),
      end_time: endCap,
      campaign_filter: { campaign_type_ids: ["all"], statuses: ["all"] },
    }),
  });
  const details: any[] = (pick(json, "details") as any[]) || [];

  return details
    .slice()
    .sort((a, b) => num(a.startsOn) - num(b.startsOn))
    .map((d): Cell[] => {
      const dd = d.dropDetails || {};
      const ud = d.undeliveredDetails || {};
      const delivered = num(d.delivered);
      const sent = num(d.sent);
      const drop = num(d.drop);
      const undel = num(d.undelivered);
      const dpct = (v: unknown) => pctN(num(v), drop); // sobre total de drops
      const upct = (v: unknown) => pctN(num(v), undel); // sobre total de undelivered
      return [
        String(d.campName ?? d.id ?? ""), // A Campaign
        num(d.id), // B ID
        String(d.status ?? ""), // C Status
        String(d.campaignType ?? ""), // D Campaign Type
        delivered, // E Delivered
        num(d.click), // F Clicks
        num(d.conversion), // G Conversions
        brl(d.revenue), // H Revenue
        num(d.targeted), // I Targeted
        sent, // J Sent
        drop, // K Dropped
        pct(delivered, sent), // L Delivery Rate
        undel, // M Undelivered
        num(d.deliveryPending), // N Delivery Pending
        pct(num(d.open), delivered), // O Open Rate
        num(d.open), // P Opens
        pct(num(d.click), delivered), // Q CTR
        pct(num(d.conversion), delivered), // R CR
        NA, // S Response Rate
        NA, // T Responses
        NA, // U Response Open Rate
        NA, // V Response Opens
        NA, // W Response CTR
        NA, // X Response Clicks
        NA, // Y Response CR
        NA, // Z Response Conversions
        NA, // AA Button Click Rate
        NA, // AB Button Clicks
        pct(num(d.unsubscribe), delivered), // AC Unsubscribe Rate
        num(d.unsubscribe), // AD Unsubscribes
        dpct(dd.frequencyCapped), // AE Frequency Capped
        dpct(dd.duplicates), // AF Duplicates
        dpct(dd.invalidPhoneNumbers), // AG Invalid Phone Numbers
        dpct(dd.tierLimitation), // AH Tier Limitation
        dpct(dd.templateFailures), // AI Template Failures
        dpct(dd.pausedTemplates), // AJ Paused Templates
        dpct(dd.recipientRelatedErrors), // AK Recipient Related Drops
        dpct(dd.metaTemporaryErrors), // AL Meta Temporary Errors
        dpct(dd.accountIntegrationErrors), // AM Account Registration Errors
        dpct(dd.internalErrors), // AN Internal Errors
        dpct(dd.rateLimits), // AO Rate Limits
        dpct(dd.policyFailures), // AP Policy Failures
        dpct(dd.countryCodeDrops), // AQ Country Code Drops
        upct(ud.recipientRelatedErrors), // AR Recipient Related Errors
        upct(ud.accountVerificationErrors), // AS Account Verification Errors
        upct(ud.mediaErrors), // AT Media Errors
        upct(ud.heldMessages), // AU Held Messages
        upct(ud.metaExperiment), // AV Meta Experiments
        upct(ud.metaErrors), // AW Meta Errors
        upct(ud.invalidMessages), // AX Invalid Messages
        upct(ud.deliveryReportMissing), // AY Delivery Report Missing
        upct(ud.metaRecipientLimitsErrors), // AZ Meta Recipient Limits
        serialSP(d.startsOn), // BA Starts On
        serialSP(d.endsOn), // BB Ends On
      ];
    });
}
