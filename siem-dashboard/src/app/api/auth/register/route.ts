import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Resend } from "resend";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { organizationName, email, password } = body;

    const trimmedOrg = (organizationName || "").trim();
    const trimmedEmail = (email || "").trim();

    if (!trimmedOrg) {
      return NextResponse.json({ error: "organizationName is required" }, { status: 400 });
    }
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      return NextResponse.json({ error: "valid email is required" }, { status: 400 });
    }
    if (!password || password.length < 8) {
      return NextResponse.json({ error: "password must be at least 8 characters" }, { status: 400 });
    }

    const exists = await prisma.admin.findUnique({
      where: { email: trimmedEmail },
    });

    if (exists) {
      return NextResponse.json({ error: "email already registered" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(16).toString("hex");

    const result = await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: trimmedOrg },
      });
      const admin = await tx.admin.create({
        data: {
          email: trimmedEmail,
          password: hashedPassword,
          organizationId: org.id,
          verificationToken,
          isVerified: false,
        },
      });
      return { org, admin };
    });

    if (trimmedEmail !== "admin@xrsecurity.com") {
      const baseUrl = process.env.BASE_URL || "http://localhost:3000";
      const verificationLink = `${baseUrl}/api/auth/verify?token=${verificationToken}`;
      
      try {
        const resend = new Resend(process.env.RESEND_API_KEY || "re_placeholder");
        await resend.emails.send({
          from: "Mini-SIEM <onboarding@resend.dev>",
          to: trimmedEmail,
          subject: "Welcome to Mini-SIEM! Verify your email",
          html: `<p>Please verify your email by clicking <a href="${verificationLink}">here</a>.</p>`,
        });
      } catch (err) {
        console.error("Failed to send welcome email:", err);
      }
    }

    return NextResponse.json({
      success: true,
      adminId: result.admin.id,
      email: result.admin.email,
      organizationId: result.org.id,
      organizationName: result.org.name,
      message: "Please check your email to verify your account.",
    }, { status: 201 });
  } catch (error) {
    console.error("Register error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
