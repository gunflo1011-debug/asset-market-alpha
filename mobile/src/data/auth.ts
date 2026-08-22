import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { trackAlphaEvent } from './analytics';
import { assertAlphaBackendCompatible } from './readiness';

function client() {
  if (!supabase) throw new Error('Supabase is not configured for this build.');
  return supabase;
}

async function requireCompatibleSession(session: Session): Promise<Session> {
  try {
    await assertAlphaBackendCompatible();
    return session;
  } catch (error) {
    await client().auth.signOut();
    throw error;
  }
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await client().auth.getSession();
  if (error) throw error;
  if (!data.session) return null;
  const session = await requireCompatibleSession(data.session);
  void trackAlphaEvent('SESSION_RESTORED');
  return session;
}

export function onAuthStateChange(callback: (session: Session | null) => void) {
  const { data } = client().auth.onAuthStateChange((_event, session) => {
    if (!session) {
      callback(null);
      return;
    }
    void requireCompatibleSession(session)
      .then((compatibleSession) => callback(compatibleSession))
      .catch(() => callback(null));
  });
  return () => data.subscription.unsubscribe();
}

export async function signIn(email: string, password: string): Promise<void> {
  const { data, error } = await client().auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data.session) throw new Error('Supabase did not return an authenticated session.');
  await requireCompatibleSession(data.session);
  void trackAlphaEvent('SIGN_IN_SUCCEEDED');
}

export async function signUp(email: string, password: string): Promise<string> {
  const { data, error } = await client().auth.signUp({ email, password });
  if (error) throw error;
  if (data.session) {
    await requireCompatibleSession(data.session);
    void trackAlphaEvent('SIGN_UP_REQUESTED');
  }
  return data.session
    ? 'Account created and signed in.'
    : 'Account created. Confirm the email before signing in.';
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await client().auth.resetPasswordForEmail(email, {
    redirectTo: 'thingsalpha://auth/reset-password',
  });
  if (error) throw error;
}

function recoveryParam(url: string, key: string): string | null {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const raw = hashIndex >= 0 ? url.slice(hashIndex + 1) : queryIndex >= 0 ? url.slice(queryIndex + 1) : '';
  for (const part of raw.split('&')) {
    const [encodedKey, ...valueParts] = part.split('=');
    if (decodeURIComponent(encodedKey ?? '') !== key) continue;
    return decodeURIComponent(valueParts.join('=') || '');
  }
  return null;
}

export async function beginPasswordRecoveryFromUrl(url: string): Promise<void> {
  if (!url.startsWith('thingsalpha://auth/reset-password')) {
    throw new Error('This password reset link is not valid for Things.');
  }

  const errorDescription = recoveryParam(url, 'error_description');
  if (errorDescription) throw new Error(errorDescription.replace(/\+/g, ' '));

  const accessToken = recoveryParam(url, 'access_token');
  const refreshToken = recoveryParam(url, 'refresh_token');
  const type = recoveryParam(url, 'type');
  if (type && type !== 'recovery') throw new Error('This link is not a password recovery link.');
  if (!accessToken || !refreshToken) throw new Error('This password reset link is incomplete or expired.');

  const { data, error } = await client().auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw error;
  if (!data.session) throw new Error('Could not start a secure password recovery session.');
  await requireCompatibleSession(data.session);
}

export async function updateRecoveredPassword(password: string): Promise<void> {
  if (password.length < 8) throw new Error('Use at least 8 characters for your new password.');
  const { error } = await client().auth.updateUser({ password });
  if (error) throw error;
  void trackAlphaEvent('PASSWORD_RECOVERY_SUCCEEDED');
  const { error: signOutError } = await client().auth.signOut();
  if (signOutError) throw signOutError;
}

export async function signOut(): Promise<void> {
  const { error } = await client().auth.signOut();
  if (error) throw error;
}
