"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dashboard } from "@/components/Dashboard";
import { GetApiKey } from "@/components/GetApiKey";
import { DetectionPanel } from "@/components/DetectionPanel";
import { BlockedPanel } from "@/components/BlockedPanel";

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [currentPage, setCurrentPage] = useState("dashboard");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
    } else {
      setEmail(localStorage.getItem("email") || "Admin");
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("email");
    router.push("/login");
  };

  // Dynamically render the active page
  let content;
  switch (currentPage) {
    case "apikey":
      content = <GetApiKey onNavigate={setCurrentPage} onLogout={handleLogout} userEmail={email} />;
      break;
    case "detection":
      content = <DetectionPanel onNavigate={setCurrentPage} onLogout={handleLogout} />;
      break;
    case "blocked":
      content = <BlockedPanel onNavigate={setCurrentPage} onLogout={handleLogout} />;
      break;
    case "dashboard":
    default:
      content = <Dashboard userEmail={email} onLogout={handleLogout} onNavigate={setCurrentPage} />;
      break;
  }

  return <>{content}</>;
}
