import { createClient } from "@supabase/supabase-js";

// This app has NO login (per product decision) — the anon/publishable key
// below is meant to be public and embedded in the deployed site's JS bundle.
// Row Level Security on every table grants the anon role full read/write
// access. Access control relies entirely on:
//   1. this GitHub Pages URL not being shared/indexed publicly, and
//   2. the in-app PIN gate (client-side only, not enforced by the database).
// Anyone who has both this URL and knows how to read the JS bundle could
// call the Supabase REST API directly and bypass the PIN. If that risk ever
// becomes unacceptable, add real Supabase Auth + per-row auth checks later.
const SUPABASE_URL = "https://qxzhdquoxbhtpsmdohex.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_A2u5RUE_bjjQFxkWNjPoLw_pa-VYt_o";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
