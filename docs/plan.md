# Build Plan: Google Ads ROI Dashboard (hackathon proof of concept)

The requirements are in [`requirements.md`](./requirements.md). This file covers how we build it.

## Goal
Replace the manual export → Excel → Salesforce merge → slides workflow with a dashboard that:
1. Shows the metrics the CRO already sees (**CPL, CPA, ROAS, ROMI**) for the account, each product-line campaign, and each quarter.
2. Ranks campaigns against **their own role's benchmarks** (brand, direct response, competitor, retargeting, awareness).
3. Shows **data checks** proving that the numbers tie back to Google Ads and Salesforce.
4. Has Claude write the **quarterly budget recommendation memo** for the CRO from the computed numbers.

## Architecture
```
src/lib/data/config.ts      campaigns, product lines, role benchmarks, quarterly goals (mock, edit here)
src/lib/data/generate.ts    seeded mock data: Google Ads weekly rows + Salesforce leads/opportunities
src/lib/metrics.ts          deterministic metric engine (integer cents, no AI)
src/lib/reconcile.ts        data-integrity checks (spend ties out, unattributed leads, maturing pipeline)
src/lib/types.ts            shared types: the contract between data, metrics and UI
src/app/api/memo/route.ts   Claude call: computed facts in → structured memo JSON out
src/app/page.tsx + src/components/*   dashboard UI
```

### Data accuracy rules
- Money is stored and summed in **integer cents**, and is only formatted for display.
- Every metric is a pure function of the source rows, with unit tests in `src/lib/*.test.ts`.
- The AI never computes numbers. It gets a facts table and returns structured JSON (schema-validated). The UI labels its output as AI-generated.
- Divide-by-zero gives `null` and is shown as "—", never as 0 or Infinity.

### Attribution model (POC)
- A lead belongs to a campaign through `utm_campaign`, the way he does it by hand today. Leads marked as Google Ads with no or unknown UTM are counted as **unattributed** and shown in the data checks.
- Revenue is counted when the deal closes (booked revenue, "the hard number this month"). Open opportunities are shown as pipeline.
- Revenue can be shown on either basis: **first-year contract value** or **lifetime value**.
- Leads under 45 days old are flagged as **maturing**, because the click-to-close lag is 30–45 days.

### Metric definitions
| Metric | Formula |
|---|---|
| CPL | spend ÷ CRM leads |
| CPA | spend ÷ closed-won customers |
| ROAS | revenue ÷ spend |
| ROMI | (revenue − spend) ÷ spend |
| Campaign score | weighted attainment against the campaign role's targets (CPL, CPA, ROAS), 0–100 |
| Account health | revenue vs. quarterly goal, account ROMI vs. target, CPA vs. target, 0–100 |

## Frontend
- Next.js (App Router) + Tailwind, Framer Motion for element animations, Lottie (JSON animations) for icons and status, Recharts for charts, NumberFlow for animated counters.
- Every card can be expanded into a detailed view.
- Sections:
  - Hero health score
  - KPI strip (CPL, CPA, ROAS, ROMI, spend, revenue)
  - Campaign leaderboard
  - Product-line comparison
  - Trend charts
  - Data-integrity panel
  - AI quarterly memo (with copy and print)
- Controls: quarter selector and revenue-basis toggle (contract value or lifetime value).

## Deployment
Vercel: import the GitHub repo, set `ANTHROPIC_API_KEY`, and deploy this branch. The key is only read server-side, in `/api/memo`.

## Out of scope for the POC
Live Google Ads API and Salesforce API connections, authentication, multi-touch attribution, and holdout and incrementality tests. The data layer is built so the mock generator can later be swapped for CSV upload or API pulls.
