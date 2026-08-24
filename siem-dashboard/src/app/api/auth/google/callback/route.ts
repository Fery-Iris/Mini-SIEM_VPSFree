import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  scope: string;
}

interface GoogleUserInfo {
  sub: string;         // Google unique user ID
  email: string;
  email_verified: boolean;
  name: string;
  given_name: string;
  family_name?: string;
  picture?: string;
}

export async function GET(req: Request) {
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const jwtSecret = process.env.JWT_SECRET || "xr-security-change-me-in-production";

  // ── Error helper redirect ──────────────────────────────────────────────────
  const errorRedirect = (msg: string) =>
    NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(msg)}`);

  if (!clientId || !clientSecret) {
    return errorRedirect("Google OAuth not configured on server.");
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");

  // User cancelled the consent screen
  if (errorParam) {
    return NextResponse.redirect(`${baseUrl}/login`);
  }

  if (!code) {
    return errorRedirect("Missing authorization code from Google.");
  }

  try {
    // ── 1. Exchange code for tokens ──────────────────────────────────────────
    const redirectUri = `${baseUrl}/api/auth/google/callback`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("Google token exchange failed:", err);
      return errorRedirect("Failed to exchange Google authorization code.");
    }

    const tokens: GoogleTokenResponse = await tokenRes.json();

    // ── 2. Fetch user info from Google ───────────────────────────────────────
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoRes.ok) {
      return errorRedirect("Failed to fetch user info from Google.");
    }

    const googleUser: GoogleUserInfo = await userInfoRes.json();

    if (!googleUser.email_verified) {
      return errorRedirect("Google account email is not verified.");
    }

    // ── 3. Find or create user in DB ─────────────────────────────────────────
    let adminId: number;
    let adminEmail: string;
    let adminOrgId: number | null;
    let adminOrgName: string;

    const existingAdmin = await prisma.admin.findFirst({
      where: {
        OR: [
          { googleId: googleUser.sub },
          { email: googleUser.email },
        ],
      },
      include: { organization: true },
    });

    if (!existingAdmin) {
      // New user — create org + admin automatically
      const orgName = googleUser.name
        ? `${googleUser.name}'s Organization`
        : "My Organization";

      const result = await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name: orgName },
        });
        const newAdmin = await tx.admin.create({
          data: {
            email: googleUser.email,
            password: null,           // No password for Google OAuth users
            googleId: googleUser.sub,
            organizationId: org.id,
            isVerified: true,          // Google already verified the email
          },
        });
        return { org, admin: newAdmin };
      });

      adminId = result.admin.id;
      adminEmail = result.admin.email;
      adminOrgId = result.org.id;
      adminOrgName = result.org.name;
    } else {
      // Existing user — link Google account if not linked yet
      if (!existingAdmin.googleId) {
        await prisma.admin.update({
          where: { id: existingAdmin.id },
          data: { googleId: googleUser.sub, isVerified: true },
        });
      }

      adminId = existingAdmin.id;
      adminEmail = existingAdmin.email;
      adminOrgId = existingAdmin.organizationId;
      adminOrgName = existingAdmin.organization?.name ?? "";
    }

    // ── 4. Issue JWT (same format as email/password login) ───────────────────
    const token = jwt.sign({ adminId }, jwtSecret, { expiresIn: "24h" });

    // ── 5. Redirect to dashboard with token ──────────────────────────────────
    // The client-side GoogleAuthHandler picks up these params and stores in localStorage.
    const dashboardUrl = new URL(`${baseUrl}/dashboard`);
    dashboardUrl.searchParams.set("token", token);
    dashboardUrl.searchParams.set("adminId", String(adminId));
    dashboardUrl.searchParams.set("email", adminEmail);
    dashboardUrl.searchParams.set("orgId", String(adminOrgId ?? 0));
    dashboardUrl.searchParams.set("orgName", adminOrgName);

    return NextResponse.redirect(dashboardUrl.toString());
  } catch (error) {
    console.error("Google OAuth callback error:", error);
    return errorRedirect("An unexpected error occurred during Google sign-in.");
  }
}
