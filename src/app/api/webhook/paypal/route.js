import { NextResponse } from "next/server";
import { headers } from "next/headers";
import PayPalService from "@/lib/services/paypal";

export async function POST(req) {
  try {
    const body = await req.text();
    const headersList = await headers();

    // PayPal webhook verification headers
    const transmissionId = headersList.get("paypal-transmission-id");
    const transmissionTime = headersList.get("paypal-transmission-time");
    const certUrl = headersList.get("paypal-cert-url");
    const authAlgo = headersList.get("paypal-auth-algo");
    const transmissionSig = headersList.get("paypal-transmission-sig");

    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
      return NextResponse.json({ error: "Missing PayPal headers" }, { status: 400 });
    }

    const result = await PayPalService.handleWebhook(body, headersList);
    return NextResponse.json(result);
  } catch (error) {
    console.error("PayPal webhook error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
