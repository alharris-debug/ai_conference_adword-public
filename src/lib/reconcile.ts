// Data-integrity checks. These prove that the dashboard's numbers tie back to
// the raw Google Ads and Salesforce rows, and they flag anything that would make
// a number in the CRO report wrong.

import type { CampaignMetrics, IntegrityCheck, MetricSet, Period } from "./types";
import { UNATTRIBUTED, normalizeUtm, type Index } from "./attribution";
import { formatCents } from "./format";

const inRange = (date: string | null, p: { start: string; end: string }) =>
  date !== null && date >= p.start && date <= p.end;

export function runIntegrityChecks(
  idx: Index,
  period: Period,
  account: MetricSet,
  campaigns: CampaignMetrics[],
): IntegrityCheck[] {
  return [
    spendTieOut(idx, period, account, campaigns),
    unknownCampaigns(idx, period),
    leadAttribution(idx, period),
    utmNormalization(idx, period),
    conversionVariance(campaigns),
    wonDealAmounts(idx, period),
    orphanOpportunities(idx),
    duplicateIds(idx),
  ];
}

/** Raw export total = sum of campaign rows = account total, to the cent. */
function spendTieOut(idx: Index, period: Period, account: MetricSet, campaigns: CampaignMetrics[]): IntegrityCheck {
  let rawCents = 0;
  let rows = 0;
  for (const row of idx.ds.ads) {
    if (inRange(row.date, period)) {
      rawCents += row.costCents;
      rows++;
    }
  }
  const campaignSum = campaigns.reduce((s, c) => s + c.metrics.spendCents, 0);
  const ok = rawCents === campaignSum && campaignSum === account.spendCents;
  return {
    id: "spend-tie-out",
    label: "Spend ties out to the Google Ads export",
    status: ok ? "pass" : "fail",
    summary: ok
      ? `${formatCents(rawCents)} across ${rows.toLocaleString()} export rows matches the dashboard to the cent.`
      : `Mismatch: export ${formatCents(rawCents)}, campaigns ${formatCents(campaignSum)}, account ${formatCents(account.spendCents)}.`,
    details: [
      `Google Ads export rows in period: ${rows.toLocaleString()}`,
      `Export total: ${formatCents(rawCents)}`,
      `Sum of campaign rows: ${formatCents(campaignSum)}`,
      `Account total: ${formatCents(account.spendCents)}`,
    ],
  };
}

function unknownCampaigns(idx: Index, period: Period): IntegrityCheck {
  const unknown = new Set<string>();
  for (const row of idx.ds.ads) {
    if (inRange(row.date, period) && !idx.campaignIds.has(row.campaignId)) unknown.add(row.campaignId);
  }
  return {
    id: "campaign-coverage",
    label: "Every Google Ads campaign is mapped",
    status: unknown.size === 0 ? "pass" : "fail",
    summary: unknown.size === 0
      ? `All ${idx.campaignIds.size} campaigns in the export are mapped to a product line.`
      : `${unknown.size} campaign(s) in the export are not mapped, so their spend is missing from the totals.`,
    details: unknown.size ? [...unknown].map((id) => `Unmapped: ${id}`) : [],
  };
}

function leadAttribution(idx: Index, period: Period): IntegrityCheck {
  let total = 0;
  let missing = 0;
  let unmatched = 0;
  for (const lead of idx.ds.leads) {
    if (!inRange(lead.CreatedDate, period)) continue;
    total++;
    if (idx.leadCampaign.get(lead.Id) === UNATTRIBUTED) {
      if (lead.UTM_Campaign__c) unmatched++;
      else missing++;
    }
  }
  const unattributed = missing + unmatched;
  const share = total ? unattributed / total : 0;
  return {
    id: "lead-attribution",
    label: "Google Ads leads have a campaign",
    status: share === 0 ? "pass" : share <= 0.05 ? "warn" : "fail",
    summary: `${unattributed} of ${total} Google Ads leads (${(share * 100).toFixed(1)}%) have no usable utm_campaign. They are left out of campaign metrics and shown separately.`,
    details: [
      `Missing utm_campaign: ${missing}`,
      `utm_campaign that doesn't match any campaign: ${unmatched}`,
      "Fix: make the hidden UTM field required on the demo form.",
    ],
  };
}

function utmNormalization(idx: Index, period: Period): IntegrityCheck {
  let normalized = 0;
  for (const lead of idx.ds.leads) {
    const raw = lead.UTM_Campaign__c;
    if (inRange(lead.CreatedDate, period) && raw && raw !== normalizeUtm(raw) && idx.campaignIds.has(normalizeUtm(raw)!)) normalized++;
  }
  return {
    id: "utm-normalization",
    label: "UTM values cleaned up",
    status: "info",
    summary: normalized
      ? `${normalized} leads had inconsistent casing or dashes in utm_campaign (e.g. "DVI-SEARCH"). They were matched to the right campaign.`
      : "No UTM clean-up was needed.",
    details: ["Rule: trim, lower-case, dashes → underscores, then match on campaign id."],
  };
}

/** Google counts form fills; Salesforce counts real, de-duplicated leads. A big gap means junk or double counting. */
function conversionVariance(campaigns: CampaignMetrics[]): IntegrityCheck {
  const flagged = campaigns
    .filter((c) => c.metrics.leads > 0)
    .map((c) => ({ c, gap: (c.metrics.googleConversions - c.metrics.leads) / c.metrics.leads }))
    .filter(({ gap }) => Math.abs(gap) > 0.2);
  return {
    id: "conversion-variance",
    label: "Google conversions match Salesforce leads",
    status: flagged.length ? "warn" : "pass",
    summary: flagged.length
      ? `${flagged.length} campaign(s) report over 20% more conversions in Google than leads in Salesforce. Google-reported CPL would look better than it really is.`
      : "Google-reported conversions are within 20% of Salesforce leads for every campaign.",
    details: flagged.map(
      ({ c, gap }) => `${c.campaign.name}: Google ${c.metrics.googleConversions} vs. Salesforce ${c.metrics.leads} (${gap > 0 ? "+" : ""}${(gap * 100).toFixed(0)}%)`,
    ),
  };
}

function wonDealAmounts(idx: Index, period: Period): IntegrityCheck {
  const bad = idx.ds.opportunities.filter((o) => o.IsWon && inRange(o.CloseDate, period) && o.AmountCents <= 0);
  return {
    id: "won-amounts",
    label: "Closed-won deals have an amount",
    status: bad.length ? "warn" : "pass",
    summary: bad.length
      ? `${bad.length} closed-won opportunity has a $0 amount. It counts as a customer but adds no revenue until it's fixed in Salesforce.`
      : "Every closed-won opportunity in the period has an amount.",
    details: bad.map((o) => `Opportunity ${o.Id} (lead ${o.LeadId}), closed ${o.CloseDate}`),
  };
}

function orphanOpportunities(idx: Index): IntegrityCheck {
  const orphans = idx.ds.opportunities.filter((o) => !idx.leadById.has(o.LeadId));
  return {
    id: "orphan-opps",
    label: "Every opportunity links to a lead",
    status: orphans.length ? "fail" : "pass",
    summary: orphans.length
      ? `${orphans.length} opportunities reference a lead that isn't in the export.`
      : `All ${idx.ds.opportunities.length.toLocaleString()} opportunities link to a Google Ads lead.`,
    details: orphans.slice(0, 10).map((o) => `Opportunity ${o.Id} → missing lead ${o.LeadId}`),
  };
}

function duplicateIds(idx: Index): IntegrityCheck {
  const dupes = (ids: string[]) => ids.length - new Set(ids).size;
  const leadDupes = dupes(idx.ds.leads.map((l) => l.Id));
  const oppDupes = dupes(idx.ds.opportunities.map((o) => o.Id));
  const rowKeys = idx.ds.ads.map((r) => `${r.date}|${r.campaignId}`);
  const rowDupes = dupes(rowKeys);
  const total = leadDupes + oppDupes + rowDupes;
  return {
    id: "duplicates",
    label: "No duplicate records",
    status: total ? "fail" : "pass",
    summary: total
      ? `${total} duplicate records found; totals would be double counted.`
      : "No duplicate leads, opportunities or ad rows.",
    details: [
      `Duplicate lead Ids: ${leadDupes}`,
      `Duplicate opportunity Ids: ${oppDupes}`,
      `Duplicate ad rows (date + campaign): ${rowDupes}`,
    ],
  };
}
