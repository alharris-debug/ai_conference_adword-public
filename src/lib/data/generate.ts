// Deterministic mock data that mimics a Google Ads daily export plus the
// Salesforce Leads and Opportunities reports. It is seeded, so every run (server
// or browser) produces exactly the same rows.
//
// It also plants a few realistic data-quality problems so the integrity checks
// have something to find: leads with a missing UTM, UTM casing drift,
// Performance Max over-counting conversions, and one closed-won deal with a $0
// amount.

import type { AdsRow, Campaign, Dataset, SfLead, SfOpportunity, SfStage } from "../types";
import { CAMPAIGNS, DATA_AS_OF, QUARTER_GOALS } from "./config";
import { addDays, eachDay, quarterKeyOf } from "../dates";

/** Generation starts a quarter before the first reported quarter so deals closing early in it have history. */
export const GENERATION_START = "2025-04-01";

interface Profile {
  dailySpend: number; // dollars
  cpc: number; // dollars
  ctr: number;
  cvr: number[]; // click → lead, by quarter index (2025-Q2 .. 2026-Q4)
  oppRate: number;
  winRate: number[];
  contract: number; // average first-year contract value, dollars
  ltvYears: number;
  googleInflation: number; // Google conversions ÷ real leads
  spendTrend: number[]; // spend multiplier by quarter index
}

const Q = (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [a, b, c, d, e, f, g];

const PROFILES: Record<string, Profile> = {
  brand_search: {
    dailySpend: 110, cpc: 3.5, ctr: 0.18, cvr: Q(0.042, 0.043, 0.044, 0.045, 0.046, 0.046, 0.046),
    oppRate: 0.5, winRate: Q(0.34, 0.34, 0.35, 0.35, 0.36, 0.36, 0.36), contract: 6000, ltvYears: 4.5,
    googleInflation: 1.08, spendTrend: Q(0.95, 0.95, 1, 1, 1, 1.05, 1.05),
  },
  dvi_search: {
    dailySpend: 520, cpc: 9, ctr: 0.062, cvr: Q(0.038, 0.04, 0.041, 0.043, 0.045, 0.047, 0.047),
    oppRate: 0.4, winRate: Q(0.22, 0.23, 0.24, 0.25, 0.26, 0.27, 0.27), contract: 7200, ltvYears: 5,
    googleInflation: 1.07, spendTrend: Q(0.85, 0.88, 0.92, 0.95, 1, 1, 1),
  },
  crm_search: {
    dailySpend: 380, cpc: 8, ctr: 0.055, cvr: Q(0.05, 0.05, 0.048, 0.045, 0.04, 0.033, 0.032),
    oppRate: 0.38, winRate: Q(0.26, 0.26, 0.25, 0.25, 0.24, 0.22, 0.22), contract: 5400, ltvYears: 4,
    googleInflation: 1.1, spendTrend: Q(1, 1, 1.05, 1.05, 1.1, 1.1, 1.1),
  },
  scheduling_search: {
    dailySpend: 260, cpc: 6, ctr: 0.05, cvr: Q(0.038, 0.037, 0.036, 0.035, 0.035, 0.034, 0.034),
    oppRate: 0.3, winRate: Q(0.22, 0.21, 0.21, 0.2, 0.2, 0.19, 0.19), contract: 2400, ltvYears: 3,
    googleInflation: 1.12, spendTrend: Q(0.9, 0.95, 1, 1, 1, 1, 1),
  },
  competitor_conquest: {
    dailySpend: 300, cpc: 14, ctr: 0.04, cvr: Q(0.036, 0.037, 0.038, 0.038, 0.039, 0.039, 0.039),
    oppRate: 0.5, winRate: Q(0.32, 0.33, 0.34, 0.35, 0.36, 0.36, 0.36), contract: 11000, ltvYears: 5.5,
    googleInflation: 1.05, spendTrend: Q(0.8, 0.85, 0.9, 0.95, 1, 1, 1),
  },
  pmax_all: {
    dailySpend: 450, cpc: 4, ctr: 0.03, cvr: Q(0.03, 0.03, 0.029, 0.029, 0.028, 0.028, 0.028),
    oppRate: 0.25, winRate: Q(0.21, 0.21, 0.2, 0.2, 0.2, 0.2, 0.2), contract: 5000, ltvYears: 4,
    googleInflation: 1.6, spendTrend: Q(0.7, 0.8, 0.9, 1, 1, 1, 1),
  },
  remarketing_display: {
    dailySpend: 150, cpc: 2, ctr: 0.008, cvr: Q(0.019, 0.019, 0.02, 0.02, 0.02, 0.02, 0.02),
    oppRate: 0.35, winRate: Q(0.27, 0.27, 0.28, 0.28, 0.28, 0.28, 0.28), contract: 5500, ltvYears: 4.5,
    googleInflation: 1.15, spendTrend: Q(1, 1, 1, 1, 1, 1, 1),
  },
  youtube_awareness: {
    dailySpend: 220, cpc: 1.2, ctr: 0.012, cvr: Q(0.005, 0.0055, 0.006, 0.006, 0.006, 0.0062, 0.0062),
    oppRate: 0.25, winRate: Q(0.18, 0.19, 0.2, 0.2, 0.2, 0.2, 0.2), contract: 6000, ltvYears: 4.5,
    googleInflation: 1.2, spendTrend: Q(0.6, 0.8, 1, 1, 1, 1, 1),
  },
};

const QUARTER_INDEX: Record<string, number> = {
  "2025-Q2": 0, "2025-Q3": 1, "2025-Q4": 2, "2026-Q1": 3, "2026-Q2": 4, "2026-Q3": 5, "2026-Q4": 6,
};

const MULTI_PRODUCT_MIX: [string, number][] = [["DVI", 0.5], ["CRM", 0.3], ["Scheduling", 0.2]];

// mulberry32: a small, fast, seedable PRNG.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(rand: () => number, lambda: number): number {
  const l = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rand();
  } while (p > l);
  return k - 1;
}

function normal(rand: () => number, mean: number, sd: number): number {
  const u = Math.max(rand(), 1e-12);
  const v = rand();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const WEEKDAY_FACTOR = [0.55, 1.1, 1.15, 1.15, 1.1, 1.0, 0.6]; // Sun..Sat

function pad(n: number, width = 6) {
  return String(n).padStart(width, "0");
}

export function generateDataset(seed = 20261006): Dataset {
  const rand = rng(seed);
  const ads: AdsRow[] = [];
  const leads: SfLead[] = [];
  const opportunities: SfOpportunity[] = [];
  let leadSeq = 0;
  let oppSeq = 0;

  for (const day of eachDay(GENERATION_START, DATA_AS_OF)) {
    const qi = QUARTER_INDEX[quarterKeyOf(day)];
    const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();

    for (const campaign of CAMPAIGNS) {
      const p = PROFILES[campaign.id];
      const spend = Math.max(0, p.dailySpend * p.spendTrend[qi] * WEEKDAY_FACTOR[weekday] * normal(rand, 1, 0.12));
      const costCents = Math.round(spend * 100);
      const cpc = p.cpc * normal(rand, 1, 0.08);
      const clicks = Math.max(0, Math.round(spend / cpc));
      const impressions = Math.round(clicks / (p.ctr * normal(rand, 1, 0.06)));
      const realLeads = poisson(rand, clicks * p.cvr[qi]);
      const conversions = Math.max(0, Math.round(realLeads * p.googleInflation + normal(rand, 0, 0.3)));

      ads.push({ date: day, campaignId: campaign.id, impressions, clicks, costCents, conversions });

      for (let i = 0; i < realLeads; i++) {
        const lead = makeLead(rand, campaign, day, ++leadSeq);
        leads.push(lead);
        if (rand() < p.oppRate) {
          const opp = makeOpportunity(rand, campaign, p, qi, lead, ++oppSeq);
          if (opp) {
            lead.Status = "Converted";
            lead.ConvertedOpportunityId = opp.Id;
            opportunities.push(opp);
          }
        }
      }
    }
  }

  plantZeroAmountDeal(opportunities);

  return {
    asOf: DATA_AS_OF,
    campaigns: CAMPAIGNS,
    ads,
    leads,
    opportunities,
    goals: QUARTER_GOALS,
  };
}

function makeLead(rand: () => number, campaign: Campaign, day: string, seq: number): SfLead {
  const r = rand();
  // ~3.5% of leads lose their UTM (form bugs, copied links), ~1.5% drift in casing.
  const utm = r < 0.035 ? null : r < 0.05 ? campaign.id.toUpperCase().replace("_", "-") : campaign.id;
  const age = daysBetween(day, DATA_AS_OF);
  return {
    Id: `00Q${pad(seq, 9)}`,
    CreatedDate: day,
    LeadSource: "Google Ads",
    UTM_Campaign__c: utm,
    Status: age < 10 ? "Open" : age < 21 ? "Working" : "Disqualified",
    ConvertedOpportunityId: null,
  };
}

function makeOpportunity(
  rand: () => number,
  campaign: Campaign,
  p: Profile,
  qi: number,
  lead: SfLead,
  seq: number,
): SfOpportunity | null {
  const created = addDays(lead.CreatedDate, Math.round(3 + rand() * 7));
  if (created > DATA_AS_OF) return null; // not converted yet
  const closeLag = Math.round(Math.min(75, Math.max(20, normal(rand, 37, 6))));
  const closeDate = addDays(lead.CreatedDate, closeLag);
  const won = rand() < p.winRate[qi];
  const amount = Math.round(p.contract * Math.max(0.4, normal(rand, 1, 0.3))) * 100;
  const ltv = Math.round(amount * p.ltvYears * Math.max(0.5, normal(rand, 1, 0.15)));
  const productLine = campaign.productLine === "Multi-product" ? pickProduct(rand) : campaign.productLine;
  const base = {
    Id: `006${pad(seq, 9)}`,
    LeadId: lead.Id,
    CreatedDate: created,
    ProductLine: productLine,
    AmountCents: amount,
    LifetimeValueCents: ltv,
  };

  if (closeDate > DATA_AS_OF) {
    const progress = 1 - daysBetween(DATA_AS_OF, closeDate) / closeLag;
    const stage: SfStage = progress < 0.35 ? "Discovery" : progress < 0.7 ? "Demo" : "Proposal";
    return { ...base, StageName: stage, IsClosed: false, IsWon: false, CloseDate: null };
  }
  return {
    ...base,
    StageName: won ? "Closed Won" : "Closed Lost",
    IsClosed: true,
    IsWon: won,
    CloseDate: closeDate,
  };
}

function pickProduct(rand: () => number): string {
  let r = rand();
  for (const [name, weight] of MULTI_PRODUCT_MIX) {
    if ((r -= weight) < 0) return name;
  }
  return MULTI_PRODUCT_MIX[0][0];
}

/** One closed-won deal in Q3 2026 was entered without an amount. */
function plantZeroAmountDeal(opps: SfOpportunity[]) {
  const target = opps.find((o) => o.IsWon && o.CloseDate !== null && o.CloseDate >= "2026-08-01" && o.CloseDate <= "2026-08-31");
  if (target) {
    target.AmountCents = 0;
    target.LifetimeValueCents = 0;
  }
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
