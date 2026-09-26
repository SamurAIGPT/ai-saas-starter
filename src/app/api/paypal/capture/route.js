import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import PayPalService from "@/lib/services/paypal";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: "Missing orderId" }, { status: 400 });
    }

    const result = await PayPalService.captureOrder(orderId, session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("PayPal capture error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
