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

export async function signOut(): Promise<void> {
  const { error } = await client().auth.signOut();
  if (error) throw error;
}
