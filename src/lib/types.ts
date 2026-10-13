// Shared contract between the data layer, the metric engine and the UI.
// All money values are integer cents. Ratios are plain numbers (2.5 = 250%).
// A metric that cannot be computed (e.g. divide by zero) is null, never 0.

export type Cents = number;

export type CampaignRole =
  | "brand"
  | "direct"
  | "competitor"
  | "retargeting"
  | "awareness";

export type RevenueBasis = "contract" | "ltv";

export interface RoleTargets {
  cplCents: Cents;
  cpaCents: Cents;
  roas: number; // on the contract basis
}

export interface Campaign {
  id: string; // matches utm_campaign in Salesforce
  name: string;
  productLine: string;
  role: CampaignRole;
  channel: "Search" | "Performance Max" | "Display" | "YouTube";
  targets: RoleTargets;
}

/** One row of a Google Ads "Campaign performance by day" export. */
export interface AdsRow {
  date: string; // YYYY-MM-DD
  campaignId: string;
  impressions: number;
  clicks: number;
  costCents: Cents;
  conversions: number; // Google-reported form-fill conversions
}

/** Salesforce Lead, limited to the fields we need. */
export interface SfLead {
  Id: string;
  CreatedDate: string; // YYYY-MM-DD
  LeadSource: "Google Ads";
  UTM_Campaign__c: string | null;
  Status: "Open" | "Working" | "Disqualified" | "Converted";
  ConvertedOpportunityId: string | null;
}

export type SfStage =
  | "Discovery"
  | "Demo"
  | "Proposal"
  | "Closed Won"
  | "Closed Lost";

/** Salesforce Opportunity created from a converted lead. */
export interface SfOpportunity {
  Id: string;
  LeadId: string;
  CreatedDate: string;
  StageName: SfStage;
  IsClosed: boolean;
  IsWon: boolean;
  CloseDate: string | null;
  ProductLine: string;
  AmountCents: Cents; // first-year contract value
  LifetimeValueCents: Cents;
}

export interface QuarterGoal {
  quarter: string; // e.g. "2026-Q3"
  revenueGoalCents: Cents; // contract basis
  targetRomi: number; // account-level ROMI target, e.g. 1.5 = 150%
  targetCpaCents: Cents;
}

export interface Dataset {
  asOf: string; // last day with data, YYYY-MM-DD
  campaigns: Campaign[];
  ads: AdsRow[];
  leads: SfLead[];
  opportunities: SfOpportunity[];
  goals: QuarterGoal[];
}

export interface Period {
  key: string; // "2026-Q3"
  label: string; // "Q3 2026"
  start: string; // inclusive YYYY-MM-DD
  end: string; // inclusive YYYY-MM-DD
  isPartial: boolean; // quarter still in progress
  elapsedFraction: number; // 0..1, share of the quarter's days with data
}

export interface MetricSet {
  spendCents: Cents;
  impressions: number;
  clicks: number;
  ctr: number | null;
  googleConversions: number;
  leads: number; // Salesforce leads created in period
  opportunities: number; // opportunities created in period
  customers: number; // closed-won with CloseDate in period
  revenueCents: Cents; // on the selected basis, closed-won in period
  contractRevenueCents: Cents;
  ltvRevenueCents: Cents;
  pipelineCents: Cents; // open opportunities from leads created in period, selected basis
  cplCents: number | null;
  cpaCents: number | null;
  roas: number | null;
  romi: number | null;
  leadToCustomerRate: number | null;
}

export type ScoreStatus = "on-target" | "watch" | "underperforming";

export interface ScoreComponent {
  metric: "cpl" | "cpa" | "roas" | "revenue" | "romi";
  label: string;
  actual: number | null;
  target: number;
  attainment: number; // clamped 0..1.5, 1 = exactly on target
  weight: number;
}

export interface Score {
  value: number; // 0..100, 75 = exactly on target
  status: ScoreStatus;
  components: ScoreComponent[];
}

export interface TrendPoint {
  weekStart: string;
  spendCents: Cents;
  revenueCents: Cents;
  leads: number;
  customers: number;
}

export interface CampaignMetrics {
  campaign: Campaign;
  metrics: MetricSet;
  previous: MetricSet; // same metrics for the prior quarter
  score: Score;
  rank: number; // 1 = best score
  trend: TrendPoint[];
}

export interface ProductLineMetrics {
  productLine: string;
  campaignIds: string[];
  metrics: MetricSet;
  previous: MetricSet;
}

export type BudgetAction = "increase" | "hold" | "optimize" | "decrease";

export interface BudgetSuggestion {
  campaignId: string;
  action: BudgetAction;
  changePct: number; // e.g. 0.2 = +20% next quarter
  changeCents: Cents; // changePct × this period's spend, rounded
  reason: string;
}

export type CheckStatus = "pass" | "warn" | "fail" | "info";

export interface IntegrityCheck {
  id: string;
  label: string;
  status: CheckStatus;
  summary: string;
  details: string[];
}

export interface DashboardModel {
  period: Period;
  previousPeriod: Period;
  basis: RevenueBasis;
  goal: QuarterGoal | null;
  account: MetricSet;
  accountPrevious: MetricSet;
  accountScore: Score;
  campaigns: CampaignMetrics[]; // sorted by rank
  productLines: ProductLineMetrics[];
  accountTrend: TrendPoint[];
  unattributed: { leads: number; customers: number; revenueCents: Cents };
  maturing: { leads: number; openPipelineCents: Cents; windowDays: number };
  suggestions: BudgetSuggestion[];
  checks: IntegrityCheck[];
}
