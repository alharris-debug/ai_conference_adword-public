# Google Ads → Revenue Dashboard: Requirements (from user interview)

## Current state (manual)
1. Export campaign/keyword data (spend, leads) from Google Ads.
2. Paste it into an Excel spreadsheet.
3. Identify Google Ads leads in Salesforce: UTM tracking plus a "came from Google Ads" marker on the lead.
4. Pull a separate Salesforce report of revenue per customer. Check by hand: did the lead close and become a full-time customer? There is a lag between lead and close.
5. Merge the spreadsheets with formulas.
6. Build a report and present it to leadership.

Scale: AutoVitals' own account has about 8 campaigns. **Each campaign maps to a product line** (e.g. CRM, DVI).

Today's output is a set of Excel spreadsheets that aggregate the sales and marketing data.

## Pain points
- The work is manual: exports, spreadsheet merges, formulas, several reports.
- Google Ads and Salesforce revenue are not connected. The link exists only in the spreadsheet.
- The lead-to-close lag makes it hard to say which period's spend produced which revenue.

## How decisions get made today
- The goal is **account-level revenue**. There are no per-campaign revenue targets.
- Campaigns work as an ecosystem. For example, brand and retargeting campaigns support the others, so a campaign's own revenue undersells its value.
- Process: check the account level first. If it is off target, drill into campaigns to find the gap.
- Levers: pause wasted spend, adjust keywords, raise bids on revenue drivers, raise or cut total investment. Goals get raised (stretch) when they are being hit.
- Over the long term: if a channel produces no revenue for about 2 quarters, investment goes down.

## Cadence
- Data is reviewed often (weekly or monthly).
- **Large changes happen quarterly.** One month is too noisy to act on, and other variables move the numbers.
- Recommendations cover **budget (marketing spend) by campaign and product line**, including spotting product lines with market momentum or search-volume opportunity.
- Bookings and revenue goals are set by the CRO, but the analyst can flag opportunities to stretch them.

## Desired future state (the output)
- A **quarterly recommendation for the boss or CRO**: "put more money into these campaigns or product lines, cut these," with the supporting numbers. This replaces the stack of spreadsheets.
- A **product-line comparison**: which product lines perform better than others.
- A **dashboard** to open Monday morning that shows last week and last month, with no manual merging.
- **ROMI by campaign** (return on marketing investment), computed from revenue and ad spend, plus a **ranking** of campaigns.
- An **account-level master health score**, with drill-down to campaigns.
- Campaigns judged against **what each is supposed to do**: brand, retargeting and awareness campaigns have different benchmarks from direct-response campaigns.
- Top campaigns, ROMI, average revenue per customer, and trend over time.

## What gets presented to the CRO today (the big metrics)
- **Cost per lead (CPL)** = spend / leads
- **Cost per acquisition (CPA)** = spend / closed customers
- **ROMI / ROAS**

The goal is to **automate this existing workflow**, not to change what gets reported.

## Non-negotiable: data accuracy
- **The input data and computed metrics must be exactly right.** Wrong numbers break the story the report tells.
- AI judgment (the narrative and recommendations) only needs to be roughly 80–90% right. The numbers it works from have no such slack.
- Design rules:
  - Every metric is computed **deterministically in code** from the source data, never by the AI.
  - The AI only gets the computed numbers, may only cite them, and its text is labeled as AI-generated.
  - **Reconciliation checks** are shown on screen: spend totals match the Google Ads export, lead and revenue totals match Salesforce, and unmatched or unattributed leads are counted and flagged.
  - Every number can be traced back to its source rows.

## Answers so far
- Key metrics: **ROMI and ROAS**. Show both: ROAS = revenue / spend, ROMI = (revenue − spend) / spend.
- Revenue: **both contract value (the hard number booked this month) and lifetime value**, with a toggle between them.
- Lead-to-close lag: **30–45 days**.
- Campaigns are product lines (CRM, DVI, ...).

## Still open (we'll use mock values for the demo)
- The full list of 8 campaigns and product lines.
- Revenue goals and spend per product line. These aren't known yet, so the demo uses plausible mock values.
