import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMuapiUrl,
  buildMuapiWebhookUrl,
  hasValidFileSignature,
  isAllowedDownloadUrl,
  isPrivateAddress,
  parsePayPalCapture,
  resolveMuapiEndpoint,
  validateCreditCost,
  verifySharedSecret,
} from "../src/lib/security.mjs";
import { isAdminEmail } from "../src/lib/admin-role.mjs";

const plans = {
  basic: { id: "basic", credits: 100, price: "5.00" },
  pro: { id: "pro", credits: 600, price: "20.00" },
};

const validPaypalEvent = {
  id: "WH-1",
  event_type: "PAYMENT.CAPTURE.COMPLETED",
  resource: {
    id: "CAP-1",
    status: "COMPLETED",
    custom_id: "user-1:basic:100",
    amount: { value: "5.00", currency_code: "USD" },
    supplementary_data: { related_ids: { order_id: "ORDER-1" } },
  },
};

test("MUAPI endpoints cannot point to attacker-controlled origins", () => {
  for (const endpoint of ["https://attacker.test/steal", "http://127.0.0.1", "//attacker.test", "predictions?x=1", "predictions/../../x"]) {
    assert.throws(() => resolveMuapiEndpoint({ endpoint }));
  }
  const callback = buildMuapiWebhookUrl("https://app.example", "secret");
  const url = buildMuapiUrl({ endpoint: "predictions", model: "nano-banana-2", webhookUrl: callback });
  assert.equal(url.origin, "https://api.muapi.ai");
  assert.equal(url.pathname, "/api/v1/nano-banana-2");
  assert.match(url.searchParams.get("webhook"), /token=secret/);
  assert.deepEqual(resolveMuapiEndpoint({ endpoint: "chat/completions" }), { endpoint: "any-llm-models", isLlm: true });
});

test("credit costs must be positive bounded integers", () => {
  assert.equal(validateCreditCost(4), 4);
  for (const value of [0, -1, 1.25, "NaN", 10001, Infinity]) {
    assert.throws(() => validateCreditCost(value));
  }
});

test("download proxy allows only exact HTTPS hostnames and rejects private IPs", () => {
  const hosts = ["cdn.example.test"];
  assert.equal(isAllowedDownloadUrl("https://cdn.example.test/image.png", hosts), true);
  assert.equal(isAllowedDownloadUrl("https://sub.cdn.example.test/image.png", hosts), false);
  assert.equal(isAllowedDownloadUrl("http://cdn.example.test/image.png", hosts), false);
  assert.equal(isAllowedDownloadUrl("https://user@cdn.example.test/image.png", hosts), false);
  assert.equal(isAllowedDownloadUrl("https://127.0.0.1/image.png", ["127.0.0.1"]), false);
  for (const address of ["127.0.0.1", "10.0.0.2", "172.20.1.3", "192.168.1.1", "169.254.1.1", "::1", "fd00::1", "fe80::1", "2001:db8::1"]) {
    assert.equal(isPrivateAddress(address), true, `${address} must be private or reserved`);
  }
  assert.equal(isPrivateAddress("1.1.1.1"), false);
  assert.equal(isPrivateAddress("2606:4700:4700::1111"), false);
});

test("upload MIME types are checked against actual file signatures", () => {
  assert.equal(hasValidFileSignature("image/png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);
  assert.equal(hasValidFileSignature("image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x00])), true);
  assert.equal(hasValidFileSignature("image/png", Buffer.from("not png")), false);
  assert.equal(hasValidFileSignature("image/svg+xml", Buffer.from("<svg/>")), false);
});

test("PayPal events must match a completed server-defined plan and contain a server order ID", () => {
  assert.deepEqual(parsePayPalCapture(validPaypalEvent, plans), {
    eventId: "WH-1", captureId: "CAP-1", orderId: "ORDER-1", userId: "user-1", planId: "basic", credits: 100,
  });
  assert.throws(() => parsePayPalCapture({ ...validPaypalEvent, resource: { ...validPaypalEvent.resource, amount: { value: "0.01", currency_code: "USD" } } }, plans));
  assert.throws(() => parsePayPalCapture({ ...validPaypalEvent, resource: { ...validPaypalEvent.resource, custom_id: "user-1:pro:999999" } }, plans));
  assert.throws(() => parsePayPalCapture({ ...validPaypalEvent, event_type: "PAYMENT.PENDING" }, plans));
  assert.throws(() => parsePayPalCapture({ ...validPaypalEvent, resource: { ...validPaypalEvent.resource, supplementary_data: undefined } }, plans));
});

test("shared webhook secrets compare safely and reject missing or incorrect tokens", () => {
  assert.equal(verifySharedSecret("long-secret", "long-secret"), true);
  assert.equal(verifySharedSecret("wrong", "long-secret"), false);
  assert.equal(verifySharedSecret(null, "long-secret"), false);
  assert.equal(verifySharedSecret("secret", ""), false);
});

test("admin access is opt-in and matched case-insensitively", () => {
  process.env.ADMIN_EMAILS = "owner@example.test,ops@example.test";
  assert.equal(isAdminEmail("Owner@Example.Test"), true);
  assert.equal(isAdminEmail("user@example.test"), false);
  assert.equal(isAdminEmail(null), false);
  delete process.env.ADMIN_EMAILS;
});
