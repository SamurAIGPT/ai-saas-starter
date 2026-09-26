import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

export const MUAPI_API_ROOT = "https://api.muapi.ai/api/v1/";
const MODEL_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*(?:\/[a-z0-9][a-z0-9._-]*)*$/i;
const IPV4_MAPPED_PATTERN = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;

export function resolveMuapiEndpoint({ endpoint = "predictions", model, inputImage = false } = {}) {
  if (typeof endpoint !== "string" || endpoint.includes(":") || endpoint.startsWith("/") || endpoint.includes("\\") || endpoint.includes("..") || endpoint.includes("?") || endpoint.includes("#")) {
    throw new Error("Unsupported AI endpoint");
  }

  const isLlm = endpoint === "chat/completions" || endpoint === "any-llm-models";
  if (!isLlm && endpoint !== "predictions") throw new Error("Unsupported AI endpoint");
  if (isLlm) return { endpoint: "any-llm-models", isLlm: true };

  const modelName = typeof model === "string" && model.trim() ? model.trim() : "nano-banana-2";
  if (!MODEL_NAME_PATTERN.test(modelName) || modelName.split("/").some((segment) => segment === "." || segment === "..")) {
    throw new Error("Invalid AI model name");
  }
  const resolvedModel = inputImage && ["nano-banana-2", "nano-banana-pro"].includes(modelName)
    ? `${modelName}-edit`
    : modelName;
  return { endpoint: resolvedModel, isLlm: false };
}

export function buildMuapiUrl({ endpoint = "predictions", model, inputImage = false, webhookUrl, webhookSecret } = {}) {
  const { endpoint: modelPath } = resolveMuapiEndpoint({ endpoint, model, inputImage });
  const url = new URL(modelPath, MUAPI_API_ROOT);
  if (url.origin !== "https://api.muapi.ai" || !url.pathname.startsWith("/api/v1/")) {
    throw new Error("Invalid AI provider URL");
  }
  if (webhookUrl) url.searchParams.set("webhook", webhookUrl);
  return url;
}

export function buildMuapiWebhookUrl(baseUrl, secret) {
  if (!secret) throw new Error("MUAPI webhook secret is required");
  const callback = new URL("/api/webhook/muapi", baseUrl);
  if (process.env.NODE_ENV === "production" ? callback.protocol !== "https:" : !/^https?:$/.test(callback.protocol)) {
    throw new Error("Invalid webhook URL protocol");
  }
  callback.searchParams.set("token", secret);
  return callback.toString();
}

export function validateCreditCost(value, max = 10000) {
  const cost = Number(value);
  if (!Number.isSafeInteger(cost) || cost < 1 || cost > max) {
    throw new Error(`Credit cost must be a whole number between 1 and ${max}`);
  }
  return cost;
}

export function hasValidFileSignature(type, bytes) {
  const data = Buffer.from(bytes);
  const startsWith = (...values) => values.every((value, index) => data[index] === value);
  if (type === "image/jpeg") return startsWith(0xff, 0xd8, 0xff);
  if (type === "image/png") return startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (type === "image/gif") return /^GIF8[79]a$/.test(data.subarray(0, 6).toString("ascii"));
  if (type === "image/webp") return data.length >= 12 && data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP";
  if (["audio/wav", "audio/x-wav"].includes(type)) return data.length >= 12 && data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WAVE";
  if (type === "audio/ogg") return data.subarray(0, 4).toString("ascii") === "OggS";
  if (["audio/mp4", "video/mp4", "video/quicktime"].includes(type)) return data.length >= 12 && data.subarray(4, 8).toString("ascii") === "ftyp";
  if (type === "video/webm" || type === "audio/webm") return startsWith(0x1a, 0x45, 0xdf, 0xa3);
  if (type === "audio/mpeg") return data.subarray(0, 3).toString("ascii") === "ID3" || (data[0] === 0xff && (data[1] & 0xe0) === 0xe0);
  return false;
}

export function isAllowedDownloadUrl(rawUrl, allowedHosts = []) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.port || isIP(url.hostname)) return false;
    const hosts = new Set(allowedHosts.map((host) => String(host).trim().toLowerCase()).filter(Boolean));
    return hosts.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function isPrivateAddress(address) {
  const mapped = address.match(IPV4_MAPPED_PATTERN);
  if (mapped) return isPrivateAddress(mapped[1]);
  const family = isIP(address);
  if (family === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19 || b === 51)) ||
      (a === 203 && b === 0);
  }
  if (family === 6) {
    // Accept only globally-routable unicast (2000::/3); deny loopback, link-local,
    // unique-local, multicast, and other special-purpose ranges by default.
    const normalized = address.toLowerCase();
    return !/^2[0-9a-f]{3}:/i.test(normalized) || normalized.startsWith("2001:db8:");
  }
  return true;
}

export async function assertPublicHost(hostname) {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("Target host resolves to a non-public address");
  }
}

export function verifySharedSecret(received, expected) {
  if (typeof received !== "string" || typeof expected !== "string" || !received || !expected) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function parsePayPalCapture(event, plans) {
  if (!event || typeof event !== "object" || event.event_type !== "PAYMENT.CAPTURE.COMPLETED" || !event.id) {
    throw new Error("Unsupported or malformed PayPal event");
  }
  const resource = event.resource;
  if (!resource || resource.status !== "COMPLETED") throw new Error("PayPal capture is not completed");
  const customId = resource.custom_id ?? resource.purchase_units?.[0]?.custom_id;
  if (typeof customId !== "string") throw new Error("Missing PayPal custom data");
  const parts = customId.split(":");
  if (parts.length !== 3) throw new Error("Invalid PayPal custom data");
  const [userId, planId, creditsText] = parts;
  const plan = plans[planId];
  const credits = Number(creditsText);
  const amount = Number(resource.amount?.value);
  const currency = resource.amount?.currency_code;
  const orderId = resource.supplementary_data?.related_ids?.order_id;
  if (!userId || !plan || !Number.isSafeInteger(credits) || credits !== plan.credits ||
      !Number.isFinite(amount) || amount !== Number(plan.price) || currency !== "USD" || !orderId) {
    throw new Error("PayPal capture does not match the configured plan");
  }
  return { eventId: event.id, captureId: resource.id, orderId, userId, planId, credits };
}
