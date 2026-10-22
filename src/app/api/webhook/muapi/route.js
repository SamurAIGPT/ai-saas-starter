import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { transitionCreationAndMaybeRefund } from "@/lib/services/creation-transition";
import { hashMuapiWebhookToken, verifyMuapiWebhookToken } from "@/lib/services/muapi-webhook";

export async function POST(req) {
  try {
    const token = new URL(req.url).searchParams.get("token");
    const tokenHash = hashMuapiWebhookToken(token);
    if (!tokenHash) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const data = await req.json();
    const requestIdValue = data.id || data.request_id;
    if (typeof requestIdValue !== "string" || !requestIdValue.trim()) {
      return NextResponse.json({ error: "Missing prediction identifier" }, { status: 400 });
    }
    const requestId = requestIdValue.trim();

    const creation = await prisma.creation.findUnique({ where: { webhookTokenHash: tokenHash } });
    if (!creation || !verifyMuapiWebhookToken(token, creation.webhookTokenHash)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (creation.requestId && creation.requestId !== requestId) {
      return NextResponse.json({ error: "Request id does not match this webhook token" }, { status: 409 });
    }
    if (creation.status !== "processing") {
      return NextResponse.json({ success: true, message: "Already processed" });
    }

    const failed = Boolean(data.error) || data.status === "failed";
    if (failed) {
      const errorMessage = typeof data.error === "string" ? data.error : (data.error ? JSON.stringify(data.error) : "Async prediction failed");
      const transitioned = await transitionCreationAndMaybeRefund(creation, { requestId, status: "failed", error: errorMessage }, true);
      return NextResponse.json({ success: true, status: transitioned ? "failed_refunded" : "Already processed" });
    }

    const outputs = Array.isArray(data.outputs) ? data.outputs : [];
    const imageUrl = outputs[0] || data.output;
    if (!imageUrl) return NextResponse.json({ error: "No output URL provided" }, { status: 400 });

    const transitioned = await transitionCreationAndMaybeRefund(creation, {
      requestId,
      status: "completed",
      resultImage: imageUrl,
      error: null,
    });
    return NextResponse.json({ success: true, status: transitioned ? "completed" : "Already processed" });
  } catch (error) {
    console.error("MUAPI webhook processing error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
