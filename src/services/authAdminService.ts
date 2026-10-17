import { supabaseAdmin } from '../lib/supabaseAdmin';

export const ADMIN_ACCOUNTS = [
  { email: 'admin@velmora.com', id: '7cf4a354-45e2-4803-800d-e2d60c79030a' },
  { email: 'admin@velmora1.com', id: '3ce27ff3-b4a3-4e8b-85e6-319971de27b7' },
  { email: 'admin@velmora2.com', id: 'db294bd6-dd47-463e-aa87-c0db8e048e8f' },
  { email: 'admin@velmora3.com', id: 'a7d2ee55-e7ad-405b-acb3-f9693183d308' },
] as const;

/**
 * Server-side administrative password reset.
 * Updates the user's password using the service-role client.
 * Does not expose passwords or secrets in logs.
 */
export async function updateTargetUserPassword(userId: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: !!data?.user };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown administrative error';
    return { success: false, error: message };
  }
}

/**
 * Revokes all active refresh tokens and sessions for a user globally across all devices.
 * Uses the Supabase Auth administrative session-revocation flow:
 * 1. Generates a secure single-use magiclink verification token.
 * 2. Acquires a temporary session JWT.
 * 3. Calls Supabase global logout with scope 'global'.
 */
export async function revokeUserSessionsGlobally(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email: email.trim().toLowerCase(),
    });

    if (linkErr || !linkData?.properties?.hashed_token) {
      return { success: false, error: linkErr?.message || 'Failed to generate revocation token' };
    }

    const supabaseUrl = (supabaseAdmin as any).supabaseUrl || 'https://utusdosvijjuxtowzhta.supabase.co';
    const anonKey = (supabaseAdmin as any).supabaseKey || '';

    // Verify token to acquire session
    const verifyRes = await fetch(`${supabaseUrl}/auth/v1/verify`, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'magiclink',
        token_hash: linkData.properties.hashed_token,
      }),
    });

    if (!verifyRes.ok) {
      return { success: false, error: `Verification failed with HTTP ${verifyRes.status}` };
    }

    const sessionData = await verifyRes.json();
    if (!sessionData?.access_token) {
      return { success: false, error: 'No access token returned for revocation' };
    }

    // Call global logout to terminate all sessions across all devices
    const logoutRes = await fetch(`${supabaseUrl}/auth/v1/logout?scope=global`, {
      method: 'POST',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${sessionData.access_token}`,
      },
    });

    return { success: logoutRes.status === 204 || logoutRes.ok };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to revoke sessions globally';
    return { success: false, error: message };
  }
}

/**
 * Revokes all sessions across all registered administrative accounts.
 */
export async function revokeAllAdminSessionsGlobally(): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};
  for (const acc of ADMIN_ACCOUNTS) {
    const res = await revokeUserSessionsGlobally(acc.email);
    results[acc.email] = res.success;
  }
  return results;
}
