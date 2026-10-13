import { describe, expect, it } from "vitest";
import { generateDataset } from "./data/generate";
import { buildDashboard, buildIndex, campaignScore, computeMetricSet, normalizeUtm, suggestBudget, UNATTRIBUTED } from "./metrics";
import { quarterKeys, quarterPeriod, weekStartOf } from "./dates";
import type { Campaign, Dataset, MetricSet } from "./types";

const ds = generateDataset();
const idx = buildIndex(ds);

describe("mock dataset", () => {
  it("is deterministic", () => {
    const again = generateDataset();
    expect(again.ads.length).toBe(ds.ads.length);
    expect(again.leads.length).toBe(ds.leads.length);
    expect(again.opportunities.at(-1)).toEqual(ds.opportunities.at(-1));
  });

  it("uses integer cents everywhere", () => {
    expect(ds.ads.every((r) => Number.isInteger(r.costCents))).toBe(true);
    expect(ds.opportunities.every((o) => Number.isInteger(o.AmountCents) && Number.isInteger(o.LifetimeValueCents))).toBe(true);
  });
});

describe("dates", () => {
  it("clips the current quarter to the as-of date", () => {
    const p = quarterPeriod("2026-Q4", "2026-10-06");
    expect(p.start).toBe("2026-10-01");
    expect(p.end).toBe("2026-10-06");
    expect(p.isPartial).toBe(true);
    expect(quarterPeriod("2026-Q3", "2026-10-06").isPartial).toBe(false);
  });

  it("lists quarters in order", () => {
    expect(quarterKeys("2025-Q3", "2026-10-06")).toEqual(["2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2", "2026-Q3", "2026-Q4"]);
  });

  it("finds the Monday of a week", () => {
    expect(weekStartOf("2026-10-04")).toBe("2026-09-28"); // Sunday
    expect(weekStartOf("2026-09-28")).toBe("2026-09-28"); // Monday
  });
});

describe("attribution", () => {
  it("normalizes UTM casing and dashes", () => {
    expect(normalizeUtm(" DVI-SEARCH ")).toBe("dvi_search");
    expect(normalizeUtm(null)).toBeNull();
  });
});

describe("metric engine on a hand-built dataset", () => {
  const campaign: Campaign = {
    id: "c1", name: "C1", productLine: "DVI", role: "direct", channel: "Search",
    targets: { cplCents: 10_000, cpaCents: 100_000, roas: 2 },
  };
  const tiny: Dataset = {
    asOf: "2026-09-30",
    campaigns: [campaign],
    goals: [],
    ads: [
      { date: "2026-07-01", campaignId: "c1", impressions: 1000, clicks: 100, costCents: 50_000, conversions: 5 },
      { date: "2026-07-02", campaignId: "c1", impressions: 1000, clicks: 100, costCents: 50_000, conversions: 5 },
      { date: "2026-06-30", campaignId: "c1", impressions: 1000, clicks: 100, costCents: 99_999, conversions: 5 }, // previous quarter
    ],
    leads: [
      { Id: "L1", CreatedDate: "2026-07-01", LeadSource: "Google Ads", UTM_Campaign__c: "c1", Status: "Converted", ConvertedOpportunityId: "O1" },
      { Id: "L2", CreatedDate: "2026-07-02", LeadSource: "Google Ads", UTM_Campaign__c: "C1", Status: "Converted", ConvertedOpportunityId: "O2" },
      { Id: "L3", CreatedDate: "2026-07-03", LeadSource: "Google Ads", UTM_Campaign__c: null, Status: "Disqualified", ConvertedOpportunityId: null },
      { Id: "L4", CreatedDate: "2026-07-03", LeadSource: "Google Ads", UTM_Campaign__c: "c1", Status: "Converted", ConvertedOpportunityId: "O3" },
    ],
    opportunities: [
      { Id: "O1", LeadId: "L1", CreatedDate: "2026-07-05", StageName: "Closed Won", IsClosed: true, IsWon: true, CloseDate: "2026-08-10", ProductLine: "DVI", AmountCents: 300_000, LifetimeValueCents: 1_200_000 },
      { Id: "O2", LeadId: "L2", CreatedDate: "2026-07-05", StageName: "Closed Lost", IsClosed: true, IsWon: false, CloseDate: "2026-08-10", ProductLine: "DVI", AmountCents: 500_000, LifetimeValueCents: 2_000_000 },
      { Id: "O3", LeadId: "L4", CreatedDate: "2026-07-06", StageName: "Demo", IsClosed: false, IsWon: false, CloseDate: null, ProductLine: "DVI", AmountCents: 200_000, LifetimeValueCents: 800_000 },
    ],
  };
  const tinyIdx = buildIndex(tiny);
  const q3 = { start: "2026-07-01", end: "2026-09-30" };

  it("computes CPL, CPA, ROAS and ROMI exactly", () => {
    const m = computeMetricSet(tinyIdx, new Set(["c1"]), q3, "contract");
    expect(m.spendCents).toBe(100_000);
    expect(m.leads).toBe(3); // L3 has no UTM
    expect(m.customers).toBe(1);
    expect(m.revenueCents).toBe(300_000);
    expect(m.cplCents).toBeCloseTo(100_000 / 3);
    expect(m.cpaCents).toBe(100_000);
    expect(m.roas).toBe(3);
    expect(m.romi).toBe(2);
    expect(m.pipelineCents).toBe(200_000);
  });

  it("switches to lifetime value", () => {
    const m = computeMetricSet(tinyIdx, new Set(["c1"]), q3, "ltv");
    expect(m.revenueCents).toBe(1_200_000);
    expect(m.roas).toBe(12);
    expect(m.pipelineCents).toBe(800_000);
  });

  it("puts leads without a UTM in the unattributed bucket", () => {
    const m = computeMetricSet(tinyIdx, new Set([UNATTRIBUTED]), q3, "contract");
    expect(m.leads).toBe(1);
    expect(m.spendCents).toBe(0);
  });

  it("returns null instead of dividing by zero", () => {
    const m = computeMetricSet(tinyIdx, new Set(["c1"]), { start: "2026-01-01", end: "2026-01-31" }, "contract");
    expect(m.cplCents).toBeNull();
    expect(m.cpaCents).toBeNull();
    expect(m.roas).toBeNull();
    expect(m.romi).toBeNull();
  });

  it("scores exactly-on-target as 75", () => {
    const onTarget = { cplCents: 10_000, cpaCents: 100_000, roas: 2, contractRevenueCents: 1, ltvRevenueCents: 1 } as MetricSet;
    expect(campaignScore(campaign, onTarget, "contract").value).toBe(75);
  });

  it("never cuts a brand campaign by more than 10%", () => {
    const m = { spendCents: 100_000, roas: 0.1 } as MetricSet;
    const s = suggestBudget({
      campaign: { ...campaign, role: "brand" },
      metrics: m,
      previous: m,
      score: { value: 10, status: "underperforming", components: [] },
    });
    expect(s.changePct).toBe(-0.1);
    expect(s.changeCents).toBe(-10_000);
  });
});

describe("dashboard model on the mock dataset", () => {
  const model = buildDashboard(idx, "2026-Q3", "contract");

  it("ties spend out across the export, campaigns and account", () => {
    const campaignSum = model.campaigns.reduce((s, c) => s + c.metrics.spendCents, 0);
    expect(campaignSum).toBe(model.account.spendCents);
    expect(model.checks.find((c) => c.id === "spend-tie-out")?.status).toBe("pass");
  });

  it("product lines add up to the account", () => {
    const sum = model.productLines.reduce((s, p) => s + p.metrics.revenueCents, 0);
    expect(sum).toBe(model.account.revenueCents);
  });

  it("ranks campaigns by score", () => {
    const scores = model.campaigns.map((c) => c.score.value);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(model.campaigns[0].rank).toBe(1);
  });

  it("finds the planted data-quality issues", () => {
    const status = Object.fromEntries(model.checks.map((c) => [c.id, c.status]));
    expect(status["won-amounts"]).toBe("warn");
    expect(status["conversion-variance"]).toBe("warn");
    expect(status["lead-attribution"]).toBe("warn");
    expect(status["duplicates"]).toBe("pass");
    expect(status["orphan-opps"]).toBe("pass");
  });

  it("prints a summary for eyeballing", () => {
    const rows = model.campaigns.map((c) => ({
      rank: c.rank,
      name: c.campaign.name,
      score: c.score.value,
      spend: Math.round(c.metrics.spendCents / 100),
      leads: c.metrics.leads,
      cust: c.metrics.customers,
      cpl: c.metrics.cplCents && Math.round(c.metrics.cplCents / 100),
      cpa: c.metrics.cpaCents && Math.round(c.metrics.cpaCents / 100),
      roas: c.metrics.roas?.toFixed(2),
      action: model.suggestions.find((s) => s.campaignId === c.campaign.id)?.action,
    }));
    console.table(rows);
    console.log("account", { score: model.accountScore.value, spend: model.account.spendCents / 100, rev: model.account.revenueCents / 100, roas: model.account.roas, goal: model.goal });
    expect(rows.length).toBe(8);
  });
});
