"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PricingCard from "@/components/PricingCard";
import FeaturesSection from "@/components/FeaturesSection";
import { FaInfoCircle, FaArrowRight } from "react-icons/fa";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

const PLANS = [
  { id: "basic", name: "Basic Pack", price: "$5", credits: 100, description: "Perfect for testing custom prompts and exploring styles." },
  { id: "standard", name: "Standard Pack", price: "$10", credits: 250, description: "Ideal for regular creators wanting high resolution outputs." },
  { id: "pro", name: "Professional Pack", price: "$20", credits: 600, description: "Designed for power users demanding batch exports and high speed.", popular: true },
  { id: "business", name: "Business Pack", price: "$50", credits: 2000, description: "Maximum value pack for agency workflows and large volume generations." }
];

export default function Pricing() {
  const { data: session, status } = useSession();
  const [loadingPlan, setLoadingPlan] = useState(null);
  const router = useRouter();
  const captureStarted = useRef(false);

  useEffect(() => {
    const orderId = new URL(window.location.href).searchParams.get("token");
    if (!orderId || status !== "authenticated" || captureStarted.current) return;
    captureStarted.current = true;
    axios.post("/api/paypal/capture", { orderId })
      .then(() => toast.success("Payment completed. Your credits will be added shortly."))
      .catch((error) => {
        console.error("PayPal capture error:", error);
        toast.error(error.response?.data?.error || "Unable to complete PayPal payment.");
      })
      .finally(() => router.replace("/pricing", { scroll: false }));
  }, [router, status, session?.user?.id]);

  const handleCheckout = async (planId) => {
    if (status !== "authenticated") {
      toast.error("You must sign in to purchase credit packages.");
      return;
    }

    setLoadingPlan(planId);
    try {
      const { data } = await axios.post("/api/checkout", { planId });
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No redirection URL returned");
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to initiate PayPal checkout.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-bg-page select-none text-primary-text overflow-hidden">
      <Toaster position="top-right" />
      <Navbar />

      <main className="flex-1 w-full overflow-y-auto scrollbar-subtle">
        {/* Pricing Section Header */}
        <section className="w-full py-16 lg:py-24 px-4 sm:px-6 lg:px-8 border-b border-divider/30">
          <div className="max-w-6xl mx-auto text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full mb-2">
              <FaInfoCircle className="text-primary text-xs" />
              <span className="text-xs font-bold text-primary uppercase tracking-widest">Pricing Plans</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight uppercase">
              Simple, Transparent Pricing
            </h1>
            <p className="text-lg text-secondary-text max-w-2xl mx-auto leading-relaxed">
              Flexible credit packages for high-resolution AI generations. Pay once, use forever. Keep 100% of your profits.
            </p>
          </div>
        </section>

        {/* Pricing Cards Grid */}
        <section className="w-full py-16 lg:py-24 px-4 sm:px-6 lg:px-8 border-b border-divider/30">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {PLANS.map((plan) => (
                <PricingCard
                  key={plan.id}
                  plan={plan}
                  isPopular={plan.popular}
                  onPurchase={handleCheckout}
                  isLoading={loadingPlan === plan.id}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <FeaturesSection />

        {/* CTA Section */}
        <section className="w-full py-16 lg:py-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto bg-gradient-to-r from-primary/20 via-purple-500/20 to-pink-600/20 border border-primary/30 rounded-2xl p-12 text-center space-y-6">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Ready to Get Started?</h2>
            <p className="text-lg text-secondary-text">
              Join thousands of creators building amazing AI apps. Start for free, upgrade as you grow.
            </p>
            <button
              onClick={() => handleCheckout('pro')}
              disabled={loadingPlan !== null}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary hover:bg-primary-hover text-white text-lg font-bold rounded-full transition-all shadow-lg shadow-primary/30 active:scale-95"
            >
              Start Free Trial
              <FaArrowRight />
            </button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
