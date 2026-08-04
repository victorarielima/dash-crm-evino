import { insiderEnv } from "../env";
import { epochSec, hourOfEpoch } from "../periods";
import { insiderFetch, num, pick } from "../http";
import type { CampaignRow, MetricSet } from "../types";
import { M, type ChannelAdapter } from "./base";

const BASE = "https://sms.useinsider.com/analytics";

async function overall(start: Date, end: Date): Promise<any> {
  const cap = Math.min(epochSec(end), epochSec(new Date())) - 1;
  const body = JSON.stringify({ startTime: epochSec(start), endTime: cap });
  return insiderFetch(`${BASE}/v1/overall`, {
    method: "POST",
    headers: { "X-INS-AUTH-KEY": insiderEnv.smsKey(), "Content-Type": "application/json" },
    body,
  });
}

export const smsAdapter: ChannelAdapter = {
  id: "sms",
  label: "SMS",
  metrics: [M.sent, M.delivered, M.clicked, M.converted, M.revenue, M.bottles, M.unsubscribed],
  primary: "revenue",
  supportsHistory: true,
  async fetchRange(start, end): Promise<MetricSet> {
    const json = await overall(start, end);
    const s = pick(json, "summary") as any;
    if (!s) return {};
    const mtm = (pick(s, "messageTypeMetrics") as any[]) || [];
    const revenue = mtm.length ? num(mtm[0].revenue) : num(pick(s, "clickThrough.revenue"));
    return {
      sent: num(s.sent),
      delivered: num(pick(s, "delivery.count.delivered")),
      clicked: num(pick(s, "clickThrough.clicks")),
      converted: num(pick(s, "conversion.conversions")),
      revenue,
      unsubscribed: num(pick(s, "unsubscribers.count")),
    };
  },
  async fetchCampaigns(start, end): Promise<CampaignRow[]> {
    const json = await overall(start, end);
    const detail: any[] = (pick(json, "detail") as any[]) || [];
    return detail.map((d) => ({
      name: String(d.campaignName || d.campaignId || "—"),
      status: d.status,
      hour: d.startTime ? hourOfEpoch(num(d.startTime)) : undefined,
      metrics: {
        sent: num(d.sent),
        delivered: num(pick(d, "delivery.count.delivered")),
        clicked: num(pick(d, "clickThrough.clicks")),
        converted: num(pick(d, "conversion.conversions")),
        revenue: num(pick(d, "clickThrough.revenue")),
      },
    }));
  },
};
