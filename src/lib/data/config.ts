// Mock configuration for AutoVitals' own Google Ads account.
// Campaign names, product lines, targets and goals are placeholders: replace
// them with the real values. Everything downstream reads from here.

import type { Campaign, CampaignRole, QuarterGoal } from "../types";

export const PRODUCT_LINES = ["DVI", "CRM", "Scheduling", "Multi-product"] as const;

export const ROLE_LABELS: Record<CampaignRole, string> = {
  brand: "Brand",
  direct: "Direct response",
  competitor: "Competitor",
  retargeting: "Retargeting",
  awareness: "Awareness",
};

/** How much each metric counts toward a campaign's score, by role. */
export const ROLE_WEIGHTS: Record<CampaignRole, { cpl: number; cpa: number; roas: number }> = {
  brand: { cpl: 0.2, cpa: 0.2, roas: 0.6 },
  direct: { cpl: 0.2, cpa: 0.3, roas: 0.5 },
  competitor: { cpl: 0.2, cpa: 0.4, roas: 0.4 },
  retargeting: { cpl: 0.4, cpa: 0.3, roas: 0.3 },
  awareness: { cpl: 0.6, cpa: 0.2, roas: 0.2 },
};

export const CAMPAIGNS: Campaign[] = [
  {
    id: "brand_search",
    name: "Brand — AutoVitals",
    productLine: "Multi-product",
    role: "brand",
    channel: "Search",
    targets: { cplCents: 9000, cpaCents: 90000, roas: 10 },
  },
  {
    id: "dvi_search",
    name: "DVI — Digital Inspection",
    productLine: "DVI",
    role: "direct",
    channel: "Search",
    targets: { cplCents: 22000, cpaCents: 260000, roas: 2.5 },
  },
  {
    id: "crm_search",
    name: "CRM — Shop Marketing",
    productLine: "CRM",
    role: "direct",
    channel: "Search",
    targets: { cplCents: 20000, cpaCents: 240000, roas: 2.5 },
  },
  {
    id: "scheduling_search",
    name: "Scheduling — Online Booking",
    productLine: "Scheduling",
    role: "direct",
    channel: "Search",
    targets: { cplCents: 16000, cpaCents: 180000, roas: 2 },
  },
  {
    id: "competitor_conquest",
    name: "Competitor Conquest",
    productLine: "DVI",
    role: "competitor",
    channel: "Search",
    targets: { cplCents: 32000, cpaCents: 350000, roas: 2 },
  },
  {
    id: "pmax_all",
    name: "Performance Max — All Products",
    productLine: "Multi-product",
    role: "direct",
    channel: "Performance Max",
    targets: { cplCents: 18000, cpaCents: 260000, roas: 2.2 },
  },
  {
    id: "remarketing_display",
    name: "Remarketing — Display",
    productLine: "Multi-product",
    role: "retargeting",
    channel: "Display",
    targets: { cplCents: 11000, cpaCents: 90000, roas: 6 },
  },
  {
    id: "youtube_awareness",
    name: "YouTube — Shop Owner Awareness",
    productLine: "Multi-product",
    role: "awareness",
    channel: "YouTube",
    targets: { cplCents: 20000, cpaCents: 400000, roas: 1 },
  },
];

/** Account-level quarterly goals, on the contract-revenue basis. */
export const QUARTER_GOALS: QuarterGoal[] = [
  { quarter: "2025-Q3", revenueGoalCents: 52_000_000, targetRomi: 1.6, targetCpaCents: 220000 },
  { quarter: "2025-Q4", revenueGoalCents: 56_000_000, targetRomi: 1.7, targetCpaCents: 220000 },
  { quarter: "2026-Q1", revenueGoalCents: 62_000_000, targetRomi: 1.8, targetCpaCents: 210000 },
  { quarter: "2026-Q2", revenueGoalCents: 64_000_000, targetRomi: 1.9, targetCpaCents: 210000 },
  { quarter: "2026-Q3", revenueGoalCents: 74_000_000, targetRomi: 2.0, targetCpaCents: 200000 },
  { quarter: "2026-Q4", revenueGoalCents: 80_000_000, targetRomi: 2.0, targetCpaCents: 200000 },
];

/** The lead-to-close lag. Leads younger than this are still maturing. */
export const MATURING_WINDOW_DAYS = 45;

export const DATA_AS_OF = "2026-10-06";

/** The first quarter offered in the dashboard (earlier generated data only seeds deal history). */
export const FIRST_REPORTED_QUARTER = "2025-Q3";
