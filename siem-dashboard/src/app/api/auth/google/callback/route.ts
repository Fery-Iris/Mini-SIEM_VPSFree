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
      const err = await tokenRes.text();
      console.error("Google token exchange failed:", err);
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
    if (!userInfoRes.ok) {
      return errorRedirect("Failed to fetch user info from Google.");
    }
    googleUser = await userInfoRes.json();
  } catch (err) {
    console.error("Userinfo fetch error:", err);
    return errorRedirect("Failed to fetch profile from Google.");
  }

  if (!googleUser.email_verified) {
    return errorRedirect("Google account email is not verified.");
  }

  // ── 3. Find or create user in DB ─────────────────────────────────────────
  // Strategy: try googleId first (if column exists), then fall back to email.
  // This makes the handler work even if the DB migration hasn't run yet.
  let adminId: number;
  let adminEmail: string;
  let adminOrgId: number | null;
  let adminOrgName: string;

  try {
    // Try to find by googleId first, fallback to email
    let existingAdmin = null;

    try {
      existingAdmin = await prisma.admin.findFirst({
        where: { googleId: googleUser.sub },
        include: { organization: true },
      });
    } catch {
      // googleId column might not exist yet — ignore and fall through to email lookup
      console.warn("googleId column not found, falling back to email lookup");
    }

    // If not found by googleId, look up by email
    if (!existingAdmin) {
      existingAdmin = await prisma.admin.findUnique({
        where: { email: googleUser.email },
        include: { organization: true },
      });
    }

    if (!existingAdmin) {
      // ── New user: create org + admin ──────────────────────────────────────
      const orgName = googleUser.name
        ? `${googleUser.name}'s Organization`
        : "My Organization";

      const result = await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name: orgName },
        });

        // Build admin data — try to include googleId, but don't fail if column missing
        const adminData: {
          email: string;
          password: null;
          organizationId: number;
          isVerified: boolean;
          googleId?: string;
        } = {
          email: googleUser.email,
          password: null,
          organizationId: org.id,
          isVerified: true,
        };

        try {
          adminData.googleId = googleUser.sub;
        } catch {
          // ignore if field not supported yet
        }

        const newAdmin = await tx.admin.create({ data: adminData });
        return { org, admin: newAdmin };
      });

      adminId = result.admin.id;
      adminEmail = result.admin.email;
      adminOrgId = result.org.id;
      adminOrgName = result.org.name;
    } else {
      // ── Existing user: link Google account if not linked ──────────────────
      if (!existingAdmin.googleId) {
        try {
          await prisma.admin.update({
            where: { id: existingAdmin.id },
            data: { googleId: googleUser.sub, isVerified: true },
          });
        } catch {
          // Column might not exist yet — just proceed with login
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

  // ── 5. Redirect to dashboard ──────────────────────────────────────────────
  // GoogleAuthHandler (client component) picks up these params and stores in localStorage.
  const dashboardUrl = new URL(`${baseUrl}/dashboard`);
  dashboardUrl.searchParams.set("token", token);
  dashboardUrl.searchParams.set("adminId", String(adminId));
  dashboardUrl.searchParams.set("email", adminEmail);
  dashboardUrl.searchParams.set("orgId", String(adminOrgId ?? 0));
  dashboardUrl.searchParams.set("orgName", adminOrgName);

  return NextResponse.redirect(dashboardUrl.toString());
}
