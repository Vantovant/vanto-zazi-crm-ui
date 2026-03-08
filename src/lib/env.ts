const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "";

export const env = {
  supabaseUrl,
  supabaseKey,
  hasBackend: Boolean(supabaseUrl && supabaseKey),
};

export function getEnvReport() {
  return {
    hasBackend: env.hasBackend,
    urlPresent: Boolean(supabaseUrl),
    keyPresent: Boolean(supabaseKey),
    hostname: window.location.hostname,
    buildTime: new Date().toISOString(),
  };
}
