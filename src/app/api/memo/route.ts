// POST { quarter: "2026-Q3", basis: "contract" | "ltv" } → Memo
// The server recomputes every number from the source data; the client only says which view it wants.

import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getIndex } from "@/lib/dataset";
import { buildDashboard } from "@/lib/metrics";
import { quarterKeys } from "@/lib/dates";
import { FIRST_REPORTED_QUARTER } from "@/lib/data/config";
import { fallbackMemo, generateMemo } from "@/lib/ai/memo";

export const maxDuration = 120;

const Body = z.object({
  quarter: z.string(),
  basis: z.enum(["contract", "ltv"]),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Expected { quarter, basis }." }, { status: 400 });

  const idx = getIndex();
  if (!quarterKeys(FIRST_REPORTED_QUARTER, idx.ds.asOf).includes(parsed.data.quarter)) {
    return NextResponse.json({ error: `Unknown quarter ${parsed.data.quarter}.` }, { status: 400 });
  }
  const model = buildDashboard(idx, parsed.data.quarter, parsed.data.basis);

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(fallbackMemo(model, "no ANTHROPIC_API_KEY configured"));
  }
  try {
    return NextResponse.json(await generateMemo(model));
  } catch (err) {
    const reason =
      err instanceof Anthropic.RateLimitError ? "rate limited, try again in a minute"
      : err instanceof Anthropic.AuthenticationError ? "API key rejected"
      : err instanceof Anthropic.APIError ? `API error ${err.status}`
      : err instanceof Error ? err.message
      : "unknown error";
    console.error("memo generation failed:", err);
    return NextResponse.json(fallbackMemo(model, reason));
  }
}
