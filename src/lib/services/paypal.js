import config from "../config";
import { UserService } from "./user";
import { prisma } from "../prisma";
import { parsePayPalCapture } from "../security.mjs";

const PAYPAL_API = config.paypal.apiBase || "https://api-m.paypal.com";

export const PayPalService = {
  // Get PayPal access token
  async getAccessToken() {
    const auth = Buffer.from(
      `${config.paypal.clientId}:${config.paypal.clientSecret}`
    ).toString("base64");

    try {
      const response = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error_description || "Failed to get access token");
      }

      return data.access_token;
    } catch (error) {
      console.error("PayPal token error:", error);
      throw error;
    }
  },

  // Create order
  async createOrder(planId, userId) {
    const plan = config.paypal.plans[planId];
    if (!plan) throw new Error("Invalid plan selected");

    const accessToken = await this.getAccessToken();

    try {
      const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              amount: {
                currency_code: "USD",
                value: plan.price,
              },
              description: plan.description,
              custom_id: `${userId}:${planId}:${plan.credits}`,
            },
          ],
          redirect_urls: {
            return_url: `${config.auth.url}/pricing?success=true`,
            cancel_url: `${config.auth.url}/pricing?canceled=true`,
          },
          application_context: {
            brand_name: config.appName,
            return_url: `${config.auth.url}/pricing?success=true`,
            cancel_url: `${config.auth.url}/pricing?canceled=true`,
            user_action: "PAY_NOW",
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to create PayPal order");
      }

      // Return the approval link
      const approvalLink = data.links.find((link) => link.rel === "approve");
      if (!data.id || !approvalLink?.href) throw new Error("PayPal did not return an order ID or approval link");
      await prisma.payPalOrder.create({
        data: { id: data.id, userId, planId, credits: plan.credits, price: plan.price },
      });
      return approvalLink.href;
    } catch (error) {
      console.error("PayPal order creation error:", error);
      throw error;
    }
  },

  // Capture payment
  async captureOrder(orderId, userId) {
    if (typeof orderId !== "string" || !/^[A-Z0-9-]{8,80}$/i.test(orderId)) {
      throw new Error("Invalid PayPal order ID");
    }
    const order = await prisma.payPalOrder.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== userId) throw new Error("PayPal order not found or access denied");
    const accessToken = await this.getAccessToken();

    try {
      const response = await fetch(
        `${PAYPAL_API}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to capture PayPal order");
      }

      const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
      if (data.status !== "COMPLETED" || capture?.status !== "COMPLETED" ||
          capture.amount?.currency_code !== "USD" || Number(capture.amount?.value) !== Number(order.price)) {
        throw new Error("PayPal capture does not match the stored order");
      }
      await prisma.payPalOrder.update({ where: { id: orderId }, data: { status: "COMPLETED" } });
      return { id: data.id, status: data.status };
    } catch (error) {
      console.error("PayPal capture error:", error);
      throw error;
    }
  },

  // Handle webhook
  async handleWebhook(body, requestHeaders) {
    try {
      const isValid = await this.verifyWebhookSignature(body, requestHeaders);
      if (!isValid) {
        throw new Error("Invalid webhook signature");
      }

      const event = JSON.parse(body);
      if (event.event_type !== "PAYMENT.CAPTURE.COMPLETED") return { success: true, ignored: true };
      const payment = parsePayPalCapture(event, config.paypal.plans);
      try {
        await prisma.$transaction(async (tx) => {
          const storedOrder = await tx.payPalOrder.findUnique({ where: { id: payment.orderId } });
          if (!storedOrder || storedOrder.userId !== payment.userId || storedOrder.planId !== payment.planId ||
              storedOrder.credits !== payment.credits || Number(storedOrder.price) !== Number(config.paypal.plans[payment.planId].price)) {
            throw new Error("PayPal event does not match a server-created order");
          }
          await tx.paymentEvent.create({
            data: { eventId: payment.eventId, captureId: payment.captureId, orderId: payment.orderId, eventType: event.event_type, userId: payment.userId, credits: payment.credits },
          });
          await UserService.addCredits(payment.userId, payment.credits, tx);
          await tx.payPalOrder.update({ where: { id: storedOrder.id }, data: { status: "COMPLETED" } });
        });
      } catch (error) {
        if (error.code === "P2002") return { success: true, duplicate: true };
        throw error;
      }
      return { success: true, userId: payment.userId, credits: payment.credits };
    } catch (error) {
      console.error("PayPal webhook error:", error);
      throw error;
    }
  },

  // Verify webhook signature
  async verifyWebhookSignature(body, requestHeaders) {
    try {
      if (!requestHeaders || !config.paypal.webhookId) return false;
      const accessToken = await this.getAccessToken();
      const header = (name) => requestHeaders.get(name);
      const verificationPayload = {
        auth_algo: header("paypal-auth-algo"),
        cert_url: header("paypal-cert-url"),
        transmission_id: header("paypal-transmission-id"),
        transmission_sig: header("paypal-transmission-sig"),
        transmission_time: header("paypal-transmission-time"),
        webhook_id: config.paypal.webhookId,
        webhook_event: JSON.parse(body),
      };
      if (Object.entries(verificationPayload).some(([key, value]) => key !== "webhook_event" && !value)) return false;
      const response = await fetch(`${PAYPAL_API}/v1/notifications/verify-webhook-signature`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(verificationPayload),
      });
      if (!response.ok) return false;
      const result = await response.json();
      return result.verification_status === "SUCCESS";
    } catch (error) {
      console.error("PayPal signature verification error:", error);
      return false;
    }
  },
};

export default PayPalService;
