import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import config from "@/lib/config";
import { assertPublicHost, isAllowedDownloadUrl } from "@/lib/security.mjs";

const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

async function readLimitedBody(response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty download response");
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_DOWNLOAD_BYTES) {
      await reader.cancel();
      throw new Error("Download exceeds the 20 MB limit");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const imageUrl = searchParams.get("url");
  if (!imageUrl) return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  if (!isAllowedDownloadUrl(imageUrl, config.downloadAllowedHosts)) {
    return NextResponse.json({ error: "Download host is not allowed" }, { status: 400 });
  }
  try {
    const url = new URL(imageUrl);
    await assertPublicHost(url.hostname);
    const res = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
    const contentType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      return NextResponse.json({ error: "Unsupported download content type" }, { status: 415 });
    }
    const declaredSize = Number(res.headers.get("content-length") || 0);
    if (declaredSize > MAX_DOWNLOAD_BYTES) {
      return NextResponse.json({ error: "Download exceeds the 20 MB limit" }, { status: 413 });
    }
    const buffer = await readLimitedBody(res);
    const filename = (decodeURIComponent(url.pathname.split("/").pop() || "image")
      .replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "image");
    return new Response(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.byteLength),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("Download proxy error:", err);
    return NextResponse.json({ error: "Unable to download the requested image" }, { status: 502 });
  }
}
