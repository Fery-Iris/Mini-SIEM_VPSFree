'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * GoogleAuthHandler
 *
 * After Google OAuth callback, the server sets a short-lived cookie "__mg_oauth"
 * containing { token, adminId, email, orgId, orgName } and redirects to /dashboard
 * with a CLEAN URL (no query params — avoids token leakage via browser history & logs).
 *
 * This component reads that one-time cookie, moves the data to localStorage
 * (matching the same keys used by email/password login), then immediately
 * deletes the cookie so it cannot be reused.
 */
export function GoogleAuthHandler() {
  const router = useRouter();

  useEffect(() => {
    const cookieName = '__mg_oauth';

    // Read all cookies and find __mg_oauth
    const cookie = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${cookieName}=`));

    if (!cookie) return; // Not a Google OAuth redirect — nothing to do

    try {
      const raw = cookie.split('=').slice(1).join('='); // handle '=' inside JSON
      const payload = JSON.parse(decodeURIComponent(raw)) as {
        token: string;
        adminId: number;
        email: string;
        orgId: number;
        orgName: string;
      };

      // Store to localStorage — same keys as email/password login
      localStorage.setItem('token', payload.token);
      localStorage.setItem('adminId', String(payload.adminId));
      localStorage.setItem('userEmail', payload.email);
      localStorage.setItem('orgId', String(payload.orgId));
      localStorage.setItem('orgName', payload.orgName);

      // Delete the cookie immediately (set maxAge=0)
      document.cookie = `${cookieName}=; Max-Age=0; path=/`;

      // Force a clean re-render so AuthGuard sees the token
      router.replace('/dashboard');
    } catch (err) {
      console.error('Failed to parse Google OAuth cookie:', err);
      // If anything goes wrong, clear the bad cookie and send to login
      document.cookie = `${cookieName}=; Max-Age=0; path=/`;
    }
  }, [router]);

  return null;
}
