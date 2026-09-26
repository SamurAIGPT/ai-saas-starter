"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { FaPlus, FaRobot, FaVideo, FaMicrophone, FaMusic, FaTrash, FaExternalLinkAlt, FaChartBar, FaFire } from "react-icons/fa";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    let active = true;
    const loadApps = async () => {
      try {
        const access = await axios.get("/api/admin/access");
        if (!access.data?.isAdmin) {
          router.replace("/dashboard");
          return;
        }
        const response = await axios.get("/api/apps");
        if (active) setApps(response.data.data || []);
      } catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          router.replace("/dashboard");
          return;
        }
        console.error("Error fetching apps:", error);
        if (active) toast.error("Failed to load apps");
      } finally {
        if (active) setLoading(false);
      }
    };
    loadApps();
    return () => { active = false; };
  }, [status, router]);

  const templates = [
    {
      id: 1,
      name: "AI Image Studio",
      description: "Launch a custom AI art and photo studio. Perfect for generating cyberpunk cityscapes, custom oil paintings, and...",
      icon: FaRobot,
      color: "from-purple-500 to-pink-500"
    },
    {
      id: 2,
      name: "AI Video Studio",
      description: "Generate AI-powered videos from text prompts or source images. Create motion clips, animated scenes, and cinematic...",
      icon: FaVideo,
      color: "from-blue-500 to-cyan-500"
    },
    {
      id: 3,
      name: "AI Companion Chatbot",
      description: "Create customized companion personalities or expert support bots. Fits standard chat timelines and floating...",
      icon: FaMicrophone,
      color: "from-green-500 to-emerald-500"
    },
    {
      id: 4,
      name: "Audio Transcription Suite",
      description: "Turn audio files, podcasts, and recordings into accurate written text, SRT captions, and meeting notes.",
      icon: FaMusic,
      color: "from-orange-500 to-red-500"
    }
  ];

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg-page">
        <div className="text-primary-text text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg-page text-primary-text">
      <Toaster position="top-right" />
      <Navbar />

      <main className="flex-1 w-full overflow-y-auto scrollbar-subtle">
        {/* Header Section */}
        <div className="border-b border-divider/30 px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-4xl sm:text-5xl font-black tracking-tight">APP BUILDER CONSOLE</h1>
                <p className="text-secondary-text mt-2">Deploy custom template-driven AI SaaS apps dynamically.</p>
              </div>
              <button
                onClick={() => router.push("/store")}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-white font-bold rounded-full transition-all shadow-lg shadow-primary/30 w-fit"
              >
                <FaPlus size={16} />
                Launch New App
              </button>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="border-b border-divider/30 px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-bg-card border border-divider/50 rounded-lg p-6 space-y-2">
                <div className="text-secondary-text text-sm font-bold uppercase tracking-wide">Deployed Apps</div>
                <div className="text-4xl font-black text-primary">{apps.length}</div>
                <div className="text-xs text-secondary-text">Custom active workspaces</div>
              </div>

              <div className="bg-bg-card border border-divider/50 rounded-lg p-6 space-y-2">
                <div className="text-secondary-text text-sm font-bold uppercase tracking-wide">Total Generations</div>
                <div className="text-4xl font-black text-primary">0</div>
                <div className="text-xs text-secondary-text">Completed AI predictions</div>
              </div>

              <div className="bg-bg-card border border-divider/50 rounded-lg p-6 space-y-2">
                <div className="text-secondary-text text-sm font-bold uppercase tracking-wide">Active Balance</div>
                <div className="text-4xl font-black text-primary">${session?.user?.credits || 0}</div>
                <div className="text-xs text-secondary-text">Available platform credits</div>
              </div>
            </div>
          </div>
        </div>

        {/* Deployed Apps Section */}
        {apps.length > 0 && (
          <div className="border-b border-divider/30 px-4 sm:px-6 lg:px-8 py-8">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center gap-2 mb-6">
                <FaChartBar className="text-primary text-lg" />
                <h2 className="text-xl font-bold uppercase tracking-wide">My Deployed App Workspaces</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {apps.slice(0, 4).map((app) => (
                  <div key={app.id} className="bg-bg-card border border-divider/50 rounded-lg p-6 space-y-4 hover:border-primary/30 transition-all">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs text-primary font-bold uppercase tracking-wide mb-1">{app.category?.name || "UNCATEGORIZED"}</div>
                        <h3 className="text-lg font-bold text-primary-text">{app.name}</h3>
                        <p className="text-xs text-secondary-text mt-1">{app.description}</p>
                      </div>
                      <button className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-red-500">
                        <FaTrash size={14} />
                      </button>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-divider/30">
                      <button className="flex-1 py-2 bg-bg-page hover:bg-bg-page/80 text-primary-text font-semibold rounded-lg transition-colors text-sm">
                        Workspace
                      </button>
                      <button className="flex-1 py-2 bg-primary hover:bg-primary-hover text-white font-semibold rounded-lg transition-colors text-sm">
                        Gallery
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Available Templates Section */}
        <div className="px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-2 mb-8">
              <FaFire className="text-primary text-lg" />
              <h2 className="text-xl font-bold uppercase tracking-wide">Available Base Templates</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {templates.map((template) => {
                const Icon = template.icon;
                return (
                  <div key={template.id} className="bg-bg-card border border-divider/50 rounded-lg overflow-hidden hover:border-primary/30 transition-all group">
                    <div className={`h-24 bg-gradient-to-br ${template.color} opacity-20 flex items-center justify-center`}>
                      <Icon size={40} className="text-primary/50" />
                    </div>

                    <div className="p-6 space-y-4">
                      <div>
                        <h3 className="font-bold text-primary-text mb-2">{template.name}</h3>
                        <p className="text-xs text-secondary-text leading-relaxed">{template.description}</p>
                      </div>

                      <button className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-primary-hover transition-colors">
                        Launch with template
                        <FaExternalLinkAlt size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
