import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { trackAlphaEvent } from './analytics';
import { assertAlphaBackendCompatible } from './readiness';

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_CONFIRM_REDIRECT = 'thingsalpha://auth/confirmed';
const PASSWORD_RESET_REDIRECT = 'thingsalpha://auth/reset-password';

function client() {
  if (!supabase) throw new Error('Supabase is not configured for this build.');
  return supabase;
}

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) throw new Error('Enter a valid email address.');
  return normalized;
}

function assertStrongEnoughPassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`);
  }
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

export async function getCurrentAccount(): Promise<User> {
  const { data, error } = await client().auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error('No authenticated Things account is available.');
  return data.user;
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
  const { data, error } = await client().auth.signInWithPassword({ email: normalizeEmail(email), password });
  if (error) throw error;
  if (!data.session) throw new Error('Supabase did not return an authenticated session.');
  await requireCompatibleSession(data.session);
  void trackAlphaEvent('SIGN_IN_SUCCEEDED');
}

export async function signUp(email: string, password: string): Promise<string> {
  const normalizedEmail = normalizeEmail(email);
  assertStrongEnoughPassword(password);
  const { data, error } = await client().auth.signUp({
    email: normalizedEmail,
    password,
    options: { emailRedirectTo: EMAIL_CONFIRM_REDIRECT },
  });
  if (error) throw error;
  if (data.session) {
    await requireCompatibleSession(data.session);
    void trackAlphaEvent('SIGN_UP_REQUESTED');
  }
  return data.session
    ? 'Account created and signed in.'
    : 'Account created. Check your email to confirm it before signing in.';
}

export async function resendSignupConfirmation(email: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  const { error } = await client().auth.resend({
    type: 'signup',
    email: normalizedEmail,
    options: { emailRedirectTo: EMAIL_CONFIRM_REDIRECT },
  });
  if (error) throw error;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await client().auth.resetPasswordForEmail(normalizeEmail(email), {
    redirectTo: PASSWORD_RESET_REDIRECT,
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
  if (!url.startsWith(PASSWORD_RESET_REDIRECT)) {
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
  assertStrongEnoughPassword(password);
  const { error } = await client().auth.updateUser({ password });
  if (error) throw error;
  const { error: signOutError } = await client().auth.signOut();
  if (signOutError) throw signOutError;
}

export async function updateAccountPassword(password: string): Promise<void> {
  assertStrongEnoughPassword(password);
  await getCurrentAccount();
  const { error } = await client().auth.updateUser({ password });
  if (error) throw error;
}

export async function requestAccountEmailChange(email: string): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  await getCurrentAccount();
  const { error } = await client().auth.updateUser({ email: normalizedEmail }, {
    emailRedirectTo: EMAIL_CONFIRM_REDIRECT,
  });
  if (error) throw error;
}

export async function reauthenticateWithPassword(password: string): Promise<void> {
  const user = await getCurrentAccount();
  if (!user.email) throw new Error('This account does not have an email login.');
  const { data, error } = await client().auth.signInWithPassword({ email: user.email, password });
  if (error) throw error;
  if (!data.session || data.user.id !== user.id) {
    await client().auth.signOut();
    throw new Error('Could not verify the current account.');
  }
}

export async function signOut(): Promise<void> {
  const { error } = await client().auth.signOut();
  if (error) throw error;
}
