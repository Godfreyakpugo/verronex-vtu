import { useState } from "react";
import { Package, Smartphone, Wifi, CreditCard } from "lucide-react";
import GlassCard from "../../../components/ui/GlassCard";
import DataPlanManagement from "./DataPlanManagement";
import AirtimeManagement from "./AirtimeManagement";
// We will import this later when we build it!
// import DataCardManagement from "./DataCardManagement";

export default function ProductsDashboard() {
  const [activeTab, setActiveTab] = useState("data");

  return (
    <div className="space-y-6">
      {/* Hero Header */}
      <div className="p-7 rounded-3xl bg-linear-to-br from-indigo-900 via-purple-800 to-fuchsia-700 shadow-xl shadow-purple-900/20 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-fuchsia-500 rounded-full mix-blend-screen filter blur-[80px] opacity-60 pointer-events-none" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 backdrop-blur flex items-center justify-center">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-xs text-purple-200 uppercase tracking-widest font-semibold">
              Admin Console
            </p>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Products & Pricing
            </h1>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <GlassCard className="p-2 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab("data")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition ${
            activeTab === "data"
              ? "bg-fuchsia-100 text-fuchsia-700"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          }`}
        >
          <Wifi className="w-4 h-4" /> Data Plans
        </button>

        <button
          onClick={() => setActiveTab("airtime")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition ${
            activeTab === "airtime"
              ? "bg-fuchsia-100 text-fuchsia-700"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          }`}
        >
          <Smartphone className="w-4 h-4" /> Airtime
        </button>

        <button
          onClick={() => setActiveTab("datacards")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition ${
            activeTab === "datacards"
              ? "bg-fuchsia-100 text-fuchsia-700"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
          }`}
        >
          <CreditCard className="w-4 h-4" /> Data Cards
        </button>
      </GlassCard>

      {/* Render Active Component */}
      <div className="animate-in fade-in duration-300">
        {activeTab === "data" && <DataPlanManagement />}

        {/* Placeholders for unbuilt components */}
        {activeTab === "airtime" && <AirtimeManagement />}

        {activeTab === "datacards" && (
          <GlassCard className="p-16 flex flex-col items-center justify-center text-slate-400">
            <CreditCard className="w-12 h-12 mb-4 text-slate-300" />
            <h2 className="text-xl font-bold text-slate-700 mb-2">
              Data Card Management
            </h2>
            <p>This module will be built next.</p>
          </GlassCard>
        )}
      </div>
    </div>
  );
}
