import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    "Supabase is niet geconfigureerd. Vul VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY in via een .env.local bestand (zie .env.example)."
  );
}

// Dummy fallback values so createClient doesn't throw before env vars are set;
// isSupabaseConfigured gates the rest of the app so this never does real requests.
export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key"
);
