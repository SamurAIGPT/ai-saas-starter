import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import config from "@/lib/config";
import { quoteRaw, rawToXno } from "@/lib/nano";

/**
 * Quote a feeless Nano (XNO) credit-topup: the exact amount to send and the
 * Nano account to send it to, for a chosen plan. The amount is the plan price
 * plus a tiny per-user tag in the last raw digits, so only this user can claim
 * the payment; `uri` is a `nano:` payment URI that makes wallets send exactly
 * that amount. The user pays from any Nano wallet, then posts the send block
 * hash to the nano webhook.
 */
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }
    if (!config.nano.account) {
      return NextResponse.json({ error: "Nano rail not configured (NANO_ACCOUNT unset)" }, { status: 503 });
    }

    const { searchParams } = new URL(req.url);
    const planId = searchParams.get("plan");
    const plan = config.nano.plans[planId];
    if (!plan) {
      return NextResponse.json({
        error: "Invalid or missing plan",
        plans: Object.fromEntries(Object.entries(config.nano.plans).map(([id, p]) => [id, { xno: p.xno, credits: p.credits }])),
      }, { status: 400 });
    }

    const raw = quoteRaw(plan.xno, session.user.id);
    return NextResponse.json({
      plan: planId,
      xno: rawToXno(raw),
      credits: plan.credits,
      raw: raw.toString(),
      account: config.nano.account,
      uri: `nano:${config.nano.account}?amount=${raw}`,
      rate: "feeless — no network fee, no issuer",
    });
  } catch (error) {
    console.error("Nano quote route error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
