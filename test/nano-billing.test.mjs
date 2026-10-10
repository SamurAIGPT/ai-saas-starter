import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { NanoPayService } from "../src/lib/services/nano-billing.js";
import { quoteRaw } from "../src/lib/nano.js";

const GOOD_HASH = "BD5CD30557CED3AF306816FD9D2EEBB1A25E117AD56DB9527A327C1507876D3E";

let ledger;
let granted;

beforeEach(() => {
  ledger = new Set();
  granted = [];
  process.env.NANO_ACCOUNT = "nano_3i9twqnw5eqte1hhgg34aojnaibqsdntni479eat78pphr7qe3i5s6zdphtx";
});

// Stand-in for the route's Prisma transaction: a send hash is credited once.
async function claimAndCredit(sendHash, id, credits) {
  if (ledger.has(sendHash)) return false;
  ledger.add(sendHash);
  granted.push({ id, credits });
  return true;
}

const verified = async () => ({ sendHash: GOOD_HASH });

test("grants credits when the payment verifies on-chain", async () => {
  const res = await NanoPayService.verifyAndCredit({ planId: "starter", blockHash: GOOD_HASH, userId: "u1", claimAndCredit, check: verified });
  assert.equal(res.ok, true);
  assert.equal(res.credits, 100); // starter plan = 100 credits
  assert.deepEqual(granted, [{ id: "u1", credits: 100 }]);
});

test("asks the verifier for the amount quoted to this user", async () => {
  let asked;
  await NanoPayService.verifyAndCredit({
    planId: "starter", blockHash: GOOD_HASH, userId: "u1", claimAndCredit,
    check: async (o) => { asked = o; return null; },
  });
  assert.equal(asked.expectedRaw, quoteRaw("0.1", "u1"));
  assert.equal(asked.address, process.env.NANO_ACCOUNT);
});

test("credits one payment only once", async () => {
  const first = await NanoPayService.verifyAndCredit({ planId: "starter", blockHash: GOOD_HASH, userId: "u1", claimAndCredit, check: verified });
  const again = await NanoPayService.verifyAndCredit({ planId: "starter", blockHash: GOOD_HASH, userId: "u1", claimAndCredit, check: verified });
  assert.equal(first.ok, true);
  assert.equal(again.ok, false);
  assert.equal(again.reason, "already claimed");
  assert.equal(granted.length, 1);
});

test("never grants credits when verification fails closed", async () => {
  const res = await NanoPayService.verifyAndCredit({ planId: "starter", blockHash: GOOD_HASH, userId: "u1", claimAndCredit, check: async () => null });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "not verified");
  assert.equal(granted.length, 0);
});

test("rejects an unknown plan before verifying", async () => {
  const res = await NanoPayService.verifyAndCredit({ planId: "nope", blockHash: GOOD_HASH, userId: "u1", claimAndCredit, check: verified });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "invalid plan");
  assert.equal(granted.length, 0);
});

test("rejects a malformed block hash before verifying", async () => {
  const res = await NanoPayService.verifyAndCredit({ planId: "starter", blockHash: "not-a-hash", userId: "u1", claimAndCredit, check: verified });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "invalid block hash");
  assert.equal(granted.length, 0);
});

test("requires a user identity", async () => {
  const res = await NanoPayService.verifyAndCredit({ planId: "starter", blockHash: GOOD_HASH, claimAndCredit, check: verified });
  assert.equal(res.ok, false);
  assert.equal(res.reason, "missing user");
  assert.equal(granted.length, 0);
});
