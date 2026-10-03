export function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL ausente");
  return url;
}

export function getSupabaseAnonKey() {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY ausente");
  return key;
}

export function getEncryptionSecret() {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) throw new Error("ENCRYPTION_SECRET ausente");
  return secret;
}
