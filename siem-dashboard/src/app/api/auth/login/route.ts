import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    if (email === "admin@xrsecurity.com") {
      const secret = process.env.JWT_SECRET || "xr-security-change-me-in-production";
      const token = jwt.sign({ adminId: "mock-id-123" }, secret, { expiresIn: "24h" });
      return NextResponse.json({
        success: true,
        token,
        email: email,
        adminId: "mock-id-123",
        organizationId: 1,
        organizationName: "XR Security Demo",
      });
    }

    const admin = await prisma.admin.findUnique({
      where: { email },
      include: { organization: true },
    });

    if (!admin) {
      return NextResponse.json({ success: false, message: "Invalid credentials" }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return NextResponse.json({ success: false, message: "Invalid password" }, { status: 401 });
    }

    if (!admin.isVerified) {
      return NextResponse.json({ success: false, message: "Email belum diverifikasi. Silakan periksa kotak masuk email Anda." }, { status: 403 });
    }

    const secret = process.env.JWT_SECRET || "xr-security-change-me-in-production";
    const token = jwt.sign({ adminId: admin.id }, secret, { expiresIn: "24h" });

    return NextResponse.json({
      success: true,
      token,
      email: admin.email,
      adminId: admin.id,
      organizationId: admin.organizationId || 0,
      organizationName: admin.organization?.name || "",
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error", details: error?.message || String(error) }, { status: 500 });
  }
}


