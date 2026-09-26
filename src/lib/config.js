const config = {
  appName: "AI Forge",
  auth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    secret: process.env.NEXTAUTH_SECRET,
    url: process.env.NEXTAUTH_URL || "http://localhost:3000",
    webhook_url: process.env.WEBHOOK_URL || process.env.NEXTAUTH_URL || "http://localhost:3000",
  },
  paypal: {
    clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
    webhookId: process.env.PAYPAL_WEBHOOK_ID,
    apiBase: process.env.PAYPAL_API_BASE || (process.env.PAYPAL_ENV === "sandbox"
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com"),
    plans: {
      basic: { id: "basic", name: "Basic Pack", credits: 100, price: "5.00", description: "100 AI Credits Pack" },
      standard: { id: "standard", name: "Standard Pack", credits: 250, price: "10.00", description: "250 AI Credits Pack" },
      pro: { id: "pro", name: "Professional Pack", credits: 600, price: "20.00", description: "600 AI Credits Pack" },
      business: { id: "business", name: "Business Pack", credits: 2000, price: "50.00", description: "2000 AI Credits Pack" },
    }
  },
  stripe: {
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
  ai: {
    apiKey: process.env.MUAPIAPP_API_KEY,
    webhookSecret: process.env.MUAPI_WEBHOOK_SECRET || process.env.NEXTAUTH_SECRET,
    generationCost: 1, // Default cost per AI call
  }
};

config.downloadAllowedHosts = (process.env.DOWNLOAD_ALLOWED_HOSTS || "cdn.muapi.ai,cdn.muapi.com,images.unsplash.com")
  .split(",")
  .map((host) => host.trim().toLowerCase())
  .filter(Boolean);

export default config;
