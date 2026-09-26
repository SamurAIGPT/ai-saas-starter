import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import config from "@/lib/config";
import { hasValidFileSignature, isAllowedDownloadUrl } from "@/lib/security.mjs";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/ogg", "audio/webm",
  "video/mp4", "video/webm", "video/quicktime",
]);

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const declaredLength = Number(req.headers.get("content-length") || 0);
    if (declaredLength > MAX_UPLOAD_BYTES + 64 * 1024) {
      return NextResponse.json({ error: "File exceeds the 15 MB limit" }, { status: 413 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const apiKey = config.ai.apiKey;

    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "No valid file uploaded" }, { status: 400 });
    }
    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: "File must be between 1 byte and 15 MB" }, { status: 413 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });
    }
    const fileBytes = await file.arrayBuffer();
    if (!hasValidFileSignature(file.type, fileBytes)) {
      return NextResponse.json({ error: "File content does not match its declared type" }, { status: 415 });
    }

    if (!apiKey || apiKey.includes("your_") || apiKey.trim() === "") {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Upload provider is not configured" }, { status: 503 });
      }
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: "Local uploads are limited to 5 MB" }, { status: 413 });
      }
      // Offline/Local Base64 Fallback
      const buffer = Buffer.from(fileBytes);
      const base64Url = `data:${file.type};base64,${buffer.toString("base64")}`;
      return NextResponse.json({ url: base64Url });
    }

    const uploadFormData = new FormData();
    uploadFormData.append("file", file);

    const uploadRes = await fetch("https://api.muapi.ai/api/v1/upload_file", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
      },
      body: uploadFormData,
    });

    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      return NextResponse.json({ error: `CDN upload failed: ${errorText}` }, { status: 500 });
    }

    const result = await uploadRes.json();
    const uploadedUrl = result.url || result.file_url;
    if (!isAllowedDownloadUrl(uploadedUrl, config.downloadAllowedHosts)) {
      return NextResponse.json({ error: "Upload provider returned an unsupported file URL" }, { status: 502 });
    }
    return NextResponse.json({ url: uploadedUrl });
  } catch (error) {
    console.error("File upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
