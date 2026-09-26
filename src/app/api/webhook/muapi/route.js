import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { settleCreation } from "@/lib/services/creation-status";
import config from "@/lib/config";
import { verifySharedSecret } from "@/lib/security.mjs";

export async function POST(req) {
  try {
    const receivedToken = new URL(req.url).searchParams.get("token");
    if (!verifySharedSecret(receivedToken, config.ai.webhookSecret)) {
      return NextResponse.json({ error: "Unauthorized webhook" }, { status: 401 });
    }
    const data = await req.json();
    const requestId = data.id || data.request_id;

    if (!requestId) {
      return NextResponse.json({ error: "Missing prediction identifier" }, { status: 400 });
    }

    const creation = await prisma.creation.findFirst({
      where: { requestId },
    });

    if (!creation) {
      return NextResponse.json({ error: "Creation record not found" }, { status: 404 });
    }

    // Skip processing if already finished
    if (creation.status === "completed" || creation.status === "failed") {
      return NextResponse.json({ success: true, message: "Already processed" });
    }

    if (data.error || data.status === "failed" || data.state === "failed") {
      const result = await settleCreation(creation.id, {
        status: "failed",
        error: data.error || "Async prediction failed",
      });
      return NextResponse.json({ success: true, status: result?.status, refunded: result?.status === "failed" });
    } else if (["completed", "succeeded"].includes(data.status || data.state)) {
      const outputs = data.outputs || [];
      const imageUrl = outputs[0] || data.output;

      if (!imageUrl) {
        return NextResponse.json({ error: "No output URL provided" }, { status: 400 });
      }

      const result = await settleCreation(creation.id, {
        status: "completed",
        resultImage: imageUrl,
      });
      return NextResponse.json({ success: true, status: result?.status });
    }
    return NextResponse.json({ error: "Unsupported generation status" }, { status: 400 });
  } catch (error) {
    console.error("MUAPI webhook processing error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
