import { createClient } from "@supabase/supabase-js";

// The anon/publishable key below is meant to be public and embedded in the
// deployed site's JS bundle — this is normal for Supabase. Access to actual
// data is enforced server-side: Row Level Security on every table only
// grants the `authenticated` role read/write access (see src/Auth.jsx),
// so a signed-out visitor's requests are rejected by the database itself,
// not just hidden by the UI. The in-app PIN is a separate, lighter lock
// on the Pengaturan menu for family members who are already signed in.
const SUPABASE_URL = "https://qxzhdquoxbhtpsmdohex.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_A2u5RUE_bjjQFxkWNjPoLw_pa-VYt_o";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
