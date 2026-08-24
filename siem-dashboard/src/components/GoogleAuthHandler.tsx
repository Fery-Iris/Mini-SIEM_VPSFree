'use client';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * GoogleAuthHandler
 *
 * After Google OAuth callback, the server redirects to /dashboard?token=...&adminId=...&email=...
 * This client component picks up those query params, stores them in localStorage
 * (matching the same keys used by email/password login), then cleans the URL.
 */
export function GoogleAuthHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) return;

    // Store exactly the same keys as the email/password login flow
    localStorage.setItem('token', token);

    const adminId = searchParams.get('adminId');
    const email = searchParams.get('email');
    const orgId = searchParams.get('orgId');
    const orgName = searchParams.get('orgName');

    if (adminId) localStorage.setItem('adminId', adminId);
    if (email) localStorage.setItem('userEmail', email);
    if (orgId) localStorage.setItem('orgId', orgId);
    if (orgName) localStorage.setItem('orgName', orgName);

    // Remove query params from the URL (clean it up)
    router.replace('/dashboard');
  }, [searchParams, router]);

  return null;
}
