import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { trackAlphaEvent } from './analytics';

function client() {
  if (!supabase) throw new Error('Supabase is not configured for this build.');
  return supabase;
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await client().auth.getSession();
  if (error) throw error;

  if (data.session) {
    void trackAlphaEvent('SESSION_RESTORED');
  }

  return data.session;
}

export function onAuthStateChange(callback: (session: Session | null) => void) {
  const { data } = client().auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await client().auth.signInWithPassword({ email, password });
  if (error) throw error;

  void trackAlphaEvent('SIGN_IN_SUCCEEDED');
}

export async function signUp(email: string, password: string): Promise<string> {
  const { data, error } = await client().auth.signUp({ email, password });
  if (error) throw error;

  // The telemetry endpoint is authenticated by design. When Supabase requires
  // email confirmation there is intentionally no anonymous signup telemetry.
  if (data.session) {
    void trackAlphaEvent('SIGN_UP_REQUESTED');
  }

  return data.session
    ? 'Account created and signed in.'
    : 'Account created. Confirm the email before signing in.';
}

export async function signOut(): Promise<void> {
  const { error } = await client().auth.signOut();
  if (error) throw error;
}
