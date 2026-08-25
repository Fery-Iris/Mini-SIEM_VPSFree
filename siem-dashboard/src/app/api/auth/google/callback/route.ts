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
  sub: string;
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

  const errorRedirect = (msg: string) =>
    NextResponse.redirect(`${baseUrl}/login?error=${encodeURIComponent(msg)}`);

  if (!clientId || !clientSecret) {
    return errorRedirect("Google OAuth not configured on server.");
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");

  if (errorParam) return NextResponse.redirect(`${baseUrl}/login`);
  if (!code) return errorRedirect("Missing authorization code from Google.");

  // ── 1. Exchange code for tokens ──────────────────────────────────────────
  let tokens: GoogleTokenResponse;
  try {
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
      console.error("Google token exchange failed:", await tokenRes.text());
      return errorRedirect("Failed to exchange Google authorization code.");
    }
    tokens = await tokenRes.json();
  } catch (err) {
    console.error("Token exchange error:", err);
    return errorRedirect("Failed to connect to Google.");
  }

  // ── 2. Fetch user info from Google ───────────────────────────────────────
  let googleUser: GoogleUserInfo;
  try {
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!userInfoRes.ok) return errorRedirect("Failed to fetch user info from Google.");
    googleUser = await userInfoRes.json();
  } catch (err) {
    console.error("Userinfo fetch error:", err);
    return errorRedirect("Failed to fetch profile from Google.");
  }

  if (!googleUser.email_verified) {
    return errorRedirect("Google account email is not verified.");
  }

  // ── 3. Find or create user in DB ─────────────────────────────────────────
  let adminId: number;
  let adminEmail: string;
  let adminOrgId: number | null;
  let adminOrgName: string;

  try {
    let existingAdmin: any = null;

    // Try googleId lookup first (gracefully skip if column doesn't exist yet)
    try {
      existingAdmin = await (prisma.admin as any).findFirst({
        where: { googleId: googleUser.sub },
        include: { organization: true },
      });
    } catch {
      console.warn("googleId column not found, falling back to email lookup");
    }

    // Fallback: find by email
    if (!existingAdmin) {
      existingAdmin = await prisma.admin.findUnique({
        where: { email: googleUser.email },
        include: { organization: true },
      });
    }

    if (!existingAdmin) {
      // New user — create org + admin
      const orgName = googleUser.name
        ? `${googleUser.name}'s Organization`
        : "My Organization";

      const result = await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({ data: { name: orgName } });
        const adminData: any = {
          email: googleUser.email,
          password: "",
          organizationId: org.id,
          isVerified: true,
          googleId: googleUser.sub,
        };
        const newAdmin = await (tx.admin as any).create({ data: adminData });
        return { org, admin: newAdmin };
      });

      adminId = result.admin.id;
      adminEmail = result.admin.email;
      adminOrgId = result.org.id;
      adminOrgName = result.org.name;
    } else {
      // Existing user — link Google account if not linked
      if (!existingAdmin.googleId) {
        try {
          await (prisma.admin as any).update({
            where: { id: existingAdmin.id },
            data: { googleId: googleUser.sub, isVerified: true },
          });
        } catch {
          console.warn("Could not update googleId — column may not exist yet");
        }
      }
      adminId = existingAdmin.id;
      adminEmail = existingAdmin.email;
      adminOrgId = existingAdmin.organizationId;
      adminOrgName = existingAdmin.organization?.name ?? "";
    }
  } catch (err) {
    console.error("Database error during Google OAuth:", err);
    return errorRedirect("Database error during sign-in. Please try again.");
  }

  // ── 4. Issue JWT ──────────────────────────────────────────────────────────
  const token = jwt.sign({ adminId }, jwtSecret, { expiresIn: "24h" });

  // ── 5. Set a short-lived cookie and redirect to /dashboard (clean URL) ────
  //
  // SECURITY: Token is NOT passed via URL query params (avoids browser history,
  // server logs, and Referrer header leakage). Instead we use a server-set cookie
  // that the client reads once and moves to localStorage, then the cookie is deleted.
  //
  const authPayload = JSON.stringify({
    token,
    adminId,
    email: adminEmail,
    orgId: adminOrgId ?? 0,
    orgName: adminOrgName,
  });

  const isProduction = baseUrl.startsWith("https");

  const response = NextResponse.redirect(`${baseUrl}/dashboard`);
  response.cookies.set("__mg_oauth", authPayload, {
    httpOnly: false,    // Must be false so client JS can read it
    secure: isProduction,
    sameSite: "lax",
    maxAge: 60,         // 60 seconds — one-time use, very short-lived
    path: "/",
  });

  return response;
}
