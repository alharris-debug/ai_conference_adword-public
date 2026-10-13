// Attribution: which campaign a Salesforce lead belongs to, matched on utm_campaign
// the same way the manual process does it.

import type { Dataset, SfLead } from "./types";

export const UNATTRIBUTED = "__unattributed__";

/** Map a lead's utm_campaign to a campaign id: trimmed, lower-cased, dashes → underscores. */
export function normalizeUtm(utm: string | null): string | null {
  if (!utm) return null;
  return utm.trim().toLowerCase().replace(/-/g, "_");
}

export function attributeLead(lead: SfLead, campaignIds: Set<string>): string {
  const id = normalizeUtm(lead.UTM_Campaign__c);
  return id && campaignIds.has(id) ? id : UNATTRIBUTED;
}

/** Pre-joined view of the dataset; build it once and reuse it for every period. */
export interface Index {
  ds: Dataset;
  campaignIds: Set<string>;
  leadCampaign: Map<string, string>; // lead Id → campaign id or UNATTRIBUTED
  leadById: Map<string, SfLead>;
}

export function buildIndex(ds: Dataset): Index {
  const campaignIds = new Set(ds.campaigns.map((c) => c.id));
  const leadCampaign = new Map<string, string>();
  const leadById = new Map<string, SfLead>();
  for (const lead of ds.leads) {
    leadCampaign.set(lead.Id, attributeLead(lead, campaignIds));
    leadById.set(lead.Id, lead);
  }
  return { ds, campaignIds, leadCampaign, leadById };
}

