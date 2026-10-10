import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NanoPayService } from "@/lib/services/nano-billing";

/**
 * Feeless Nano (XNO) credit-topup claim.
 *
 * Additive rail beside the Stripe `checkout.session.completed` path. The
 * signed-in user posts the plan they bought and the hash of the send block
 * that paid for it; we verify on-chain that it is a confirmed payment of
 * exactly the amount quoted to THIS user, to OUR Nano account, and only then
 * record the payment and top up credits in one transaction. A send hash can be
 * claimed once.
 *
 * Fail-closed: an unverified or already-claimed payment never grants credits.
 */
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }
    const userId = session.user.id;

    const body = await req.json().catch(() => ({}));
    const { planId, blockHash } = body || {};

    const result = await NanoPayService.verifyAndCredit({
      planId,
      blockHash,
      userId,
      claimAndCredit: async (sendHash, id, credits) => {
        try {
          await prisma.$transaction([
            prisma.nanoPayment.create({ data: { sendHash, userId: id, credits } }),
            prisma.user.update({ where: { id }, data: { credits: { increment: credits } } }),
          ]);
          return true;
        } catch (error) {
          if (error && error.code === "P2002") return false; // send hash already claimed
          throw error;
        }
      },
    });

    if (!result.ok) {
      const status = {
        "invalid plan": 400,
        "invalid block hash": 400,
        "missing user": 401,
        "nano not configured": 503,
        "already claimed": 409,
      }[result.reason] || 402;
      return NextResponse.json({ error: result.reason }, { status });
    }
    return NextResponse.json({ success: true, credits: result.credits, plan: planId });
  } catch (error) {
    console.error("Nano webhook processing error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
