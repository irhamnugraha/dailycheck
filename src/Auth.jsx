import React, { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import App from "./App.jsx";

const INK = "#1B2559";
const GOLD = "#FFC93C";
const DANGER = "#E8484F";

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}

function LoadingScreen() {
  return (
    <div
      className="flex items-center justify-center"
      style={{ width: "100vw", height: "100vh", background: "#FFF4D6" }}
    >
      <p style={{ fontFamily: "'Baloo 2', sans-serif", color: INK }} className="font-bold text-sm">
        Memuat…
      </p>
    </div>
  );
}

function LoginScreen() {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function handleEmailAuth(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    if (!email.trim() || password.length < 6) {
      setError("Isi email dan password (minimal 6 karakter).");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        setInfo("Akun dibuat. Cek email kamu untuk konfirmasi, lalu masuk.");
      }
    } catch (err) {
      setError(err.message || "Terjadi kesalahan.");
    }
    setLoading(false);
  }

  async function handleGoogle() {
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) setError(error.message);
  }

  return (
    <div
      className="app-font flex items-center justify-center px-6"
      style={{ width: "100vw", height: "100vh", background: "#FFF4D6" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .app-font * { font-family: 'Plus Jakarta Sans', sans-serif; }
      `}</style>

      <div className="w-full" style={{ maxWidth: 360 }}>
        <div className="text-center mb-6">
          <span style={{ fontSize: 40 }}>🧸</span>
          <h1 style={{ fontFamily: "'Baloo 2', sans-serif", color: INK }} className="text-xl font-extrabold mt-2">
            Checklist Rutinitas Keluarga
          </h1>
          <p style={{ color: "#8A8360" }} className="text-xs mt-1">Masuk untuk mengakses data keluarga kamu.</p>
        </div>

        <div className="rounded-3xl p-5" style={{ background: "#FFFDF7", border: "2px solid #EFE6CE" }}>
          <div className="flex rounded-full p-1 mb-4" style={{ background: "#F1ECDB" }}>
            <button
              onClick={() => { setMode("signin"); setError(""); setInfo(""); }}
              className="flex-1 py-1.5 rounded-full text-xs font-bold"
              style={mode === "signin" ? { background: INK, color: "#fff" } : { color: "#8A8360" }}
            >
              Masuk
            </button>
            <button
              onClick={() => { setMode("signup"); setError(""); setInfo(""); }}
              className="flex-1 py-1.5 rounded-full text-xs font-bold"
              style={mode === "signup" ? { background: INK, color: "#fff" } : { color: "#8A8360" }}
            >
              Daftar
            </button>
          </div>

          <form onSubmit={handleEmailAuth} className="flex flex-col gap-2.5">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "#F1ECDB", color: INK }}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "#F1ECDB", color: INK }}
            />

            {error && <p style={{ color: DANGER }} className="text-xs font-semibold">{error}</p>}
            {info && <p style={{ color: "#3A8F4A" }} className="text-xs font-semibold">{info}</p>}

            <button
              type="submit"
              disabled={loading}
              style={{ background: GOLD, color: INK }}
              className="w-full rounded-xl py-2.5 text-sm font-extrabold mt-1"
            >
              {loading ? "Memproses…" : mode === "signin" ? "Masuk" : "Buat Akun"}
            </button>
          </form>

          <div className="flex items-center gap-2 my-4">
            <div className="flex-1 h-px" style={{ background: "#EFE6CE" }} />
            <span style={{ color: "#8A8360" }} className="text-[10px] font-semibold">ATAU</span>
            <div className="flex-1 h-px" style={{ background: "#EFE6CE" }} />
          </div>

          <button
            onClick={handleGoogle}
            className="w-full rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-2"
            style={{ background: "#fff", color: INK, border: "1px solid #E3D9B4" }}
          >
            <GoogleIcon />
            Lanjutkan dengan Google
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AuthGate() {
  const [session, setSession] = useState(undefined); // undefined = checking, null = signed out

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <LoadingScreen />;
  if (!session) return <LoginScreen />;
  return <App session={session} />;
}
