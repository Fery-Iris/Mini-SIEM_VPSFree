"use client";
import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { FeatureSection } from "@/components/FeatureSection";
import { Footer } from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 font-sans selection:bg-blue-500/30">
      <Navbar />
      <Hero />
      <FeatureSection />
      <Footer />
    </div>
  );
}
