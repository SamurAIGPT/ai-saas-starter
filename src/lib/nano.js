/**
 * @module lib/nano
 * Feeless Nano (XNO) credit-topup verification for the AI SaaS starter.
 *
 * Additive rail beside Stripe card billing: a user pays an exact XNO amount
 * to the app's Nano account, then the app verifies the payment was confirmed
 * on the Nano network and tops up credits through the SAME `UserService.addCredits`
 * path the Stripe webhook uses — no issuer, no fees, no private key anywhere.
 *
 * The verifier is keyless and fail-closed. It reads ledger state from a public
 * Nano RPC node (defaults to RPC Nano's public endpoint) and NEVER trusts a
 * client-supplied amount: the expected raw amount (plan price plus a per-user
 * tag) is the server's source of truth, and any error, unknown block,
 * unconfirmed block, wrong destination or wrong amount is rejected. No private
 * key is needed to verify: the payer's confirmed send block is enough.
 */

import { createHash } from "node:crypto";

// Nano uses 10^30 raw per XNO.
export const XNO_RAW = BigInt("1000000000000000000000000000000");

/** Convert a decimal XNO string to raw (bigint) — throws on invalid input. */
export function xnoToRaw(xno) {
  if (typeof xno === "bigint") return xno * XNO_RAW;
  if (typeof xno === "number") {
    if (!Number.isFinite(xno)) throw new Error("invalid XNO amount");
    return BigInt(xno) * XNO_RAW;
  }
  if (typeof xno !== "string") throw new Error("invalid XNO amount");
  const trimmed = xno.trim();
  if (trimmed === "") throw new Error("invalid XNO amount");
  const m = /^(\d+)(?:\.(\d{1,30}))?$/.exec(trimmed);
  if (!m) throw new Error("invalid XNO amount");
  const whole = BigInt(m[1]);
  const frac = (m[2] || "").padEnd(30, "0");
  return whole * XNO_RAW + BigInt(frac);
}

/**
 * Fetch one Nano block's state from a public RPC node.
 * `block_info` returns the block amount, confirmation state and the account.
 * @param {string} blockHash hex block hash
 * @param {(url:string, init?:object)=>Promise<Response>} [fetchImpl] injectable fetch
 * @param {string} [rpcUrl] public RPC endpoint
 */
export async function nanoBlockInfo(blockHash, fetchImpl = globalThis.fetch, rpcUrl = "https://rpc.nano.to") {
  const res = await fetchImpl(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: "block_info",
      json_block: "true",
      hash: blockHash,
    }),
  });
  if (!res.ok) {
    throw new Error(`Nano RPC error: HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(`Nano RPC error: ${data.error}`);
  // `block_account` is the account that owns (signed) the block; some nodes
  // also expose it as `account`. Normalize so callers can rely on `account`.
  if (!data.account && data.block_account) {
    data.account = data.block_account;
  }
  return data;
}

// Raw amounts below 10^24 (beyond the 6th XNO decimal) carry a per-user tag,
// so a payment can only be claimed by the user it was quoted for.
export const TAG_SPACE = BigInt("1000000000000");

/**
 * Deterministic per-user payment tag in [1, TAG_SPACE). Added to a plan's raw
 * price in the quote; the claim must match it exactly. Someone watching the
 * app's account on the public ledger therefore cannot claim another user's
 * payment under their own session.
 */
export function paymentTag(userId) {
  if (!userId) throw new Error("missing user");
  const digest = createHash("sha256").update(`nano-topup:${userId}`).digest("hex");
  return (BigInt("0x" + digest) % (TAG_SPACE - 1n)) + 1n;
}

/** The exact raw amount a given user must send for a plan priced in XNO. */
export function quoteRaw(xno, userId) {
  return xnoToRaw(xno) + paymentTag(userId);
}

/** Render a raw amount as an exact decimal XNO string (no rounding). */
export function rawToXno(raw) {
  const r = BigInt(raw);
  const whole = r / XNO_RAW;
  const frac = (r % XNO_RAW).toString().padStart(30, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

/**
 * Check one Nano block as a payment of exactly `expectedRaw` to `address`.
 *
 * Accepts either the payer's SEND block (subtype "send", destination
 * `contents.link_as_account` = address) or the app's RECEIVE block for it
 * (subtype "receive", `block_account` = address). Either way the result names
 * the SEND block hash, so the two hashes of one payment dedupe to one claim.
 *
 * Fail-closed: any RPC error, unknown or unconfirmed block, other subtype,
 * other destination, missing address, or amount that is not exactly
 * `expectedRaw` returns `null`.
 *
 * @returns {Promise<null | { sendHash: string, amountRaw: bigint }>}
 */
export async function checkNanoPayment({ blockHash, expectedRaw, address, fetch, rpcUrl }) {
  try {
    if (!address) return null;
    const raw = typeof expectedRaw === "bigint" ? expectedRaw : xnoToRaw(expectedRaw);
    const info = await nanoBlockInfo(blockHash, fetch, rpcUrl);
    const confirmed = info.confirmed === true || info.confirmed === "true";
    if (!confirmed) return null;
    const amountRaw = BigInt(info.amount ?? -1);
    if (amountRaw !== raw) return null;
    const contents = info.contents || {};
    let sendHash;
    if (info.subtype === "send" && contents.link_as_account === address) {
      sendHash = blockHash;
    } else if (info.subtype === "receive" && info.account === address && /^[0-9A-Fa-f]{64}$/.test(contents.link || "")) {
      sendHash = contents.link;
    } else {
      return null;
    }
    return { sendHash: sendHash.toUpperCase(), amountRaw };
  } catch {
    return null;
  }
}

/** Boolean form of `checkNanoPayment`. */
export async function verifyNanoPayment(opts) {
  return (await checkNanoPayment(opts)) !== null;
}

export default {
  checkNanoPayment,
  verifyNanoPayment,
  nanoBlockInfo,
  paymentTag,
  quoteRaw,
  rawToXno,
  xnoToRaw,
  XNO_RAW,
};
