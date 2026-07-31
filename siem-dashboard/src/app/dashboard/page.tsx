"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dashboard } from "@/components/Dashboard";
import { GetApiKey } from "@/components/GetApiKey";

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

  if (currentPage === "apikeys") {
    return <GetApiKey onNavigate={setCurrentPage} onLogout={handleLogout} userEmail={email} />;
  }

  return (
    <Dashboard 
      userEmail={email} 
      onLogout={handleLogout} 
      onNavigate={setCurrentPage}
    />
  );
}
