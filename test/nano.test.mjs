import { test } from "node:test";
import assert from "node:assert/strict";
import { checkNanoPayment, verifyNanoPayment, nanoBlockInfo, paymentTag, quoteRaw, rawToXno, xnoToRaw, XNO_RAW, TAG_SPACE } from "../src/lib/nano.js";

// A fake public RPC node we control, so tests are network-free and deterministic.
function rpcNode(responder) {
  return async (url, init) => {
    const body = JSON.parse(init.body);
    return {
      ok: true,
      status: 200,
      async json() {
        return responder(body);
      },
    };
  };
}

const SEND_HASH = "BA0AF45D57FC2AF2A9CD1780C453280082E8508F50D4B0BF3FEF60014860CF8A";
const RECEIVE_HASH = "BD5CD30557CED3AF306816FD9D2EEBB1A25E117AD56DB9527A327C1507876D3E";
const ACCOUNT = "nano_3dwhhr1rw3zfuy4ais45jsb1wi1ic7u4j77bkfmontmqyrnwoq44qzo4bby6";
const PAYER = "nano_3gicyjgohz3cycnwt7w1rjbki164x3aayn8np4zmzuu117683mwcufn7c6zg";
const OTHER = "nano_1otheraccount111111111111111111111111111111111111111111111pfgx7";

// Shaped like a real `block_info` (json_block) answer from a public node.
function sendBlock(amountRaw, { to = ACCOUNT, confirmed = "true" } = {}) {
  return rpcNode(() => ({
    block_account: PAYER,
    amount: amountRaw.toString(),
    confirmed,
    subtype: "send",
    contents: { type: "state", account: PAYER, link_as_account: to },
  }));
}

function receiveBlock(amountRaw, { by = ACCOUNT } = {}) {
  return rpcNode(() => ({
    block_account: by,
    amount: amountRaw.toString(),
    confirmed: "true",
    subtype: "receive",
    contents: { type: "state", account: by, link: SEND_HASH, link_as_account: PAYER },
  }));
}

const PRICE = quoteRaw("0.1", "u1");

test("xnoToRaw converts decimal XNO to raw", () => {
  assert.equal(xnoToRaw("1"), XNO_RAW);
  assert.equal(xnoToRaw("0.1"), BigInt("100000000000000000000000000000"));
  assert.equal(xnoToRaw("2.5"), BigInt("2500000000000000000000000000000"));
  assert.throws(() => xnoToRaw("abc"));
  assert.throws(() => xnoToRaw(""));
});

test("rawToXno renders raw exactly and round-trips", () => {
  assert.equal(rawToXno(XNO_RAW), "1");
  assert.equal(rawToXno(xnoToRaw("0.1")), "0.1");
  assert.equal(xnoToRaw(rawToXno(PRICE)), PRICE);
});

test("the per-user tag is stable, small, and differs between users", () => {
  assert.equal(paymentTag("u1"), paymentTag("u1"));
  assert.notEqual(paymentTag("u1"), paymentTag("u2"));
  assert.ok(paymentTag("u1") > 0n && paymentTag("u1") < TAG_SPACE);
  assert.equal(PRICE - xnoToRaw("0.1"), paymentTag("u1"));
  assert.throws(() => paymentTag(""));
});

test("accepts a confirmed send of the exact amount to the account", async () => {
  const res = await checkNanoPayment({ blockHash: SEND_HASH, expectedRaw: PRICE, address: ACCOUNT, fetch: sendBlock(PRICE) });
  assert.deepEqual(res, { sendHash: SEND_HASH, amountRaw: PRICE });
  assert.equal(await verifyNanoPayment({ blockHash: SEND_HASH, expectedRaw: PRICE, address: ACCOUNT, fetch: sendBlock(PRICE) }), true);
});

test("a receive block names the send it received, so both hashes dedupe", async () => {
  const res = await checkNanoPayment({ blockHash: RECEIVE_HASH, expectedRaw: PRICE, address: ACCOUNT, fetch: receiveBlock(PRICE) });
  assert.equal(res.sendHash, SEND_HASH);
});

test("rejects a send FROM the account (not a payment to it)", async () => {
  const fetch = rpcNode(() => ({ block_account: ACCOUNT, amount: PRICE.toString(), confirmed: "true", subtype: "send", contents: { link_as_account: PAYER } }));
  assert.equal(await checkNanoPayment({ blockHash: SEND_HASH, expectedRaw: PRICE, address: ACCOUNT, fetch }), null);
});

test("rejects a payment quoted for another user (tag mismatch)", async () => {
  const theirs = quoteRaw("0.1", "u2");
  assert.equal(await checkNanoPayment({ blockHash: SEND_HASH, expectedRaw: PRICE, address: ACCOUNT, fetch: sendBlock(theirs) }), null);
});

test("rejects an amount shortfall and an overpayment alike", async () => {
  assert.equal(await checkNanoPayment({ blockHash: SEND_HASH, expectedRaw: PRICE, address: ACCOUNT, fetch: sendBlock(PRICE - 1n) }), null);
  assert.equal(await checkNanoPayment({ blockHash: SEND_HASH, expectedRaw: PRICE, address: ACCOUNT, fetch: sendBlock(PRICE + XNO_RAW) }), null);
});

test("rejects an unconfirmed block", async () => {
  assert.equal(await checkNanoPayment({ blockHash: SEND_HASH, expectedRaw: PRICE, address: ACCOUNT, fetch: sendBlock(PRICE, { confirmed: "false" }) }), null);
});

test("rejects a send to a different account, and a receive by one", async () => {
  assert.equal(await checkNanoPayment({ blockHash: SEND_HASH, expectedRaw: PRICE, address: ACCOUNT, fetch: sendBlock(PRICE, { to: OTHER }) }), null);
  assert.equal(await checkNanoPayment({ blockHash: RECEIVE_HASH, expectedRaw: PRICE, address: ACCOUNT, fetch: receiveBlock(PRICE, { by: OTHER }) }), null);
});

test("rejects when no destination address is configured", async () => {
  assert.equal(await checkNanoPayment({ blockHash: SEND_HASH, expectedRaw: PRICE, address: "", fetch: sendBlock(PRICE) }), null);
});

test("fails closed on RPC error", async () => {
  const fetch = async () => ({ ok: false, status: 500, async json() { return {}; } });
  assert.equal(await verifyNanoPayment({ blockHash: SEND_HASH, expectedRaw: PRICE, address: ACCOUNT, fetch }), false);
});

test("fails closed on unknown block (error response)", async () => {
  const fetch = rpcNode(() => ({ error: "Block not found" }));
  assert.equal(await verifyNanoPayment({ blockHash: "0".repeat(64), expectedRaw: PRICE, address: ACCOUNT, fetch }), false);
});

test("nanoBlockInfo throws on HTTP error", async () => {
  const fetch = async () => ({ ok: false, status: 503, async json() { return {}; } });
  await assert.rejects(() => nanoBlockInfo(SEND_HASH, fetch), /HTTP 503/);
});

test("nanoBlockInfo throws on RPC error field", async () => {
  const fetch = rpcNode(() => ({ error: "Block not found" }));
  await assert.rejects(() => nanoBlockInfo(SEND_HASH, fetch), /Block not found/);
});
