import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const hostedAlphaUrl = 'https://tfshblqsrczoekfsexrf.supabase.co';
const hostedAlphaPublishableKey = 'sb_publishable_dTP4W0G3LHUhIN88wOk2PQ_w_GBXku3';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? hostedAlphaUrl;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? hostedAlphaPublishableKey;

export const hasSupabaseConfig = Boolean(url && anonKey);

export const supabase = hasSupabaseConfig
  ? createClient(url, anonKey, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;
