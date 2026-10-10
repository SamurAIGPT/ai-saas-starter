import { checkNanoPayment, quoteRaw } from "../nano.js";
import config from "../config.js";

/**
 * Feeless Nano (XNO) credit-topup decision, extracted from the route so it is
 * independently testable and reusable by any caller (API route, CLI, another
 * webhook). Mirrors the Stripe `checkout.session.completed` handler: verify the
 * payment on-chain, and only then top up credits.
 *
 * `claimAndCredit(sendHash, userId, credits)` must record the payment's send
 * hash and add the credits atomically, and return false when that send hash
 * was already claimed; the route does this in one Prisma transaction. That is
 * what stops one payment from being credited twice.
 */
export const NanoPayService = {
  /**
   * @param {object} opts
   * @param {string} opts.planId one of config.nano.plans
   * @param {string} opts.blockHash the payer's send block hash (or the app's receive block for it)
   * @param {string} opts.userId the signed-in user (from the server session, never from the request)
   * @param {(sendHash:string, userId:string, credits:number)=>Promise<boolean>} opts.claimAndCredit
   * @param {(opts:object)=>Promise<null|{sendHash:string}>} [opts.check] injectable verifier (defaults to on-chain checkNanoPayment)
   * @returns {Promise<{ok:boolean, credits?:number, reason?:string}>}
   */
  async verifyAndCredit({ planId, blockHash, userId, claimAndCredit, check }) {
    const plan = config.nano.plans[planId];
    if (!plan) return { ok: false, reason: "invalid plan" };
    const account = config.nano.account || process.env.NANO_ACCOUNT || "";
    if (!account) return { ok: false, reason: "nano not configured" };
    if (!blockHash || !/^[0-9A-Fa-f]{64}$/.test(blockHash)) return { ok: false, reason: "invalid block hash" };
    if (!userId) return { ok: false, reason: "missing user" };

    const verify = check || checkNanoPayment;
    const payment = await verify({
      blockHash,
      expectedRaw: quoteRaw(plan.xno, userId),
      address: account,
      rpcUrl: config.nano.rpcUrl,
    });
    if (!payment) return { ok: false, reason: "not verified" };

    const claimed = await claimAndCredit(payment.sendHash, userId, plan.credits);
    if (!claimed) return { ok: false, reason: "already claimed" };
    return { ok: true, credits: plan.credits };
  },
};
