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
      // Ensure the demo admin exists in DB with a real integer ID
      let demoAdmin = await prisma.admin.findUnique({ where: { email } });
      if (!demoAdmin) {
        const bcrypt = (await import("bcryptjs")).default;
        const hashedPassword = await bcrypt.hash("admin123", 10);
        demoAdmin = await prisma.admin.create({
          data: {
            email,
            password: hashedPassword,
            isVerified: true,
          },
        });
      }

      const secret = process.env.JWT_SECRET || "xr-security-change-me-in-production";
      const token = jwt.sign({ adminId: demoAdmin.id }, secret, { expiresIn: "24h" });
      return NextResponse.json({
        success: true,
        token,
        email: demoAdmin.email,
        adminId: demoAdmin.id,
        organizationId: demoAdmin.organizationId || 1,
        organizationName: "MicroGaze Demo",
      });
    }

    const admin = await prisma.admin.findUnique({
      where: { email },
      include: { organization: true },
    });

    if (!admin) {
      return NextResponse.json({ success: false, message: "Invalid credentials" }, { status: 401 });
    }

    // Google OAuth users have no password — redirect them to Google Sign-In
    if (!admin.password) {
      return NextResponse.json({
        success: false,
        message: "This account uses Google Sign-In. Please click 'Continue with Google' to log in.",
      }, { status: 401 });
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


