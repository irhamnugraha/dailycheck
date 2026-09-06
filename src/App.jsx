import React, { useState, useEffect } from "react";
import {
  Home, CalendarDays, Settings as SettingsIcon, Plus, X, Check, Star,
  Lock, ChevronLeft, ChevronRight, Award, Trash2, Pencil,
  ArrowLeft, Users, Bell, GripVertical, ChevronUp, ChevronDown
} from "lucide-react";
import { loadFromSupabase, saveToSupabase } from "./dataStore";
import { supabase } from "./supabaseClient";

/* ---------- theme ---------- */
const INK = "#1B2559";
const PAPER = "#FFF4D6";
const GOLD = "#FFC93C";
const DANGER = "#E8484F";

/* ---------- prayer times (Kemenag params: Fajr 20°, Isha 18°, ihtiyat +2min) ---------- */
function fixAngle(a) { a = a % 360; return a < 0 ? a + 360 : a; }
function fixHour(h) { h = h % 24; return h < 0 ? h + 24 : h; }
const dsin = (d) => Math.sin((d * Math.PI) / 180);
const dcos = (d) => Math.cos((d * Math.PI) / 180);
const dtan = (d) => Math.tan((d * Math.PI) / 180);
const darcsin = (x) => (Math.asin(x) * 180) / Math.PI;
const darccos = (x) => (Math.acos(x) * 180) / Math.PI;
const darctan2 = (y, x) => (Math.atan2(y, x) * 180) / Math.PI;
const darccot = (x) => (Math.atan2(1, x) * 180) / Math.PI;
function julianDate(year, month, day) {
  if (month <= 2) { year -= 1; month += 12; }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}
function sunPosition(jd) {
  const D = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * D);
  const q = fixAngle(280.459 + 0.98564736 * D);
  const L = fixAngle(q + 1.915 * dsin(g) + 0.02 * dsin(2 * g));
  const e = 23.439 - 0.00000036 * D;
  let RA = darctan2(dcos(e) * dsin(L), dcos(L)) / 15;
  RA = fixHour(RA);
  const eqt = q / 15 - RA;
  const decl = darcsin(dsin(e) * dsin(L));
  return { decl, eqt };
}
function computeSunTime(angle, lat, decl, noon, ccw, ihtiyatMin) {
  const num = -dsin(angle) - dsin(decl) * dsin(lat);
  const den = dcos(decl) * dcos(lat);
  let val = num / den;
  val = Math.max(-1, Math.min(1, val));
  const t = darccos(val) / 15;
  const time = noon + (ccw ? -t : t);
  return time + (ihtiyatMin || 0) / 60;
}
function calcPrayerTimes(year, month, day, lat, lon, tz) {
  const jd0 = julianDate(year, month, day) - lon / (15 * 24);
  let { eqt } = sunPosition(jd0 + 0.5);
  let noon = fixHour(12 - lon / 15 + tz - eqt);
  let decl;
  ({ decl, eqt } = sunPosition(jd0 + noon / 24));
  noon = fixHour(12 - lon / 15 + tz - eqt);

  const ihtiyat = 2;
  const fajr = computeSunTime(20, lat, decl, noon, true, ihtiyat);
  const sunrise = computeSunTime(0.833, lat, decl, noon, true, ihtiyat);
  const dzuhur = noon + ihtiyat / 60;
  const asr = computeSunTime(-darccot(1 + dtan(Math.abs(lat - decl))), lat, decl, noon, false, ihtiyat);
  const maghrib = computeSunTime(0.833, lat, decl, noon, false, ihtiyat);
  const isya = computeSunTime(18, lat, decl, noon, false, ihtiyat);
  const imsak = fajr - 10 / 60;

  const fmt = (t) => {
    if (t == null || isNaN(t)) return null;
    let h = Math.floor(t), m = Math.round((t - h) * 60);
    if (m === 60) { h += 1; m = 0; }
    h = ((h % 24) + 24) % 24;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };
  return {
    imsak: fmt(imsak), subuh: fmt(fajr), terbit: fmt(sunrise),
    dzuhur: fmt(dzuhur), ashar: fmt(asr), maghrib: fmt(maghrib), isya: fmt(isya),
  };
}

const DEFAULT_PERIODS = [
  { key: "subuh", label: "Subuh", emoji: "🌅", color: "#5B6EE1", start: "04:00", end: "06:00" },
  { key: "siang", label: "Siang & Sore", emoji: "🌤️", color: "#00B8A9", start: "06:00", end: "17:00" },
  { key: "malam", label: "Malam", emoji: "🌙", color: "#7B5EA7", start: "17:00", end: "21:00" },
];
const NEW_PERIOD_COLORS = ["#FF6B4A", "#00B8A9", "#7B5EA7", "#4A90E2", "#FF6FA5", "#3DDC97", "#FF9F45", "#5B6EE1"];

const AVATAR_COLORS = ["#FF6B4A", "#00B8A9", "#7B5EA7", "#4A90E2", "#FF6FA5", "#3DDC97", "#FF9F45", "#5B6EE1"];
const AVATAR_EMOJIS = [
  "🦁", "🐯", "🐨", "🐰", "🦊", "🐼", "🐸", "🦄", "🐬", "🐢", "🐱", "🐶", "🐹", "🦋",
  "🤖", "🚗", "🚕", "🚓", "🚒", "🚑", "🚜", "🏎️", "🚀", "✈️", "🚁", "🚂", "🚲", "🛵",
];

// Soft, clean theme that rotates by day of week (0=Minggu ... 6=Sabtu)
const DAILY_THEMES = [
  { name: "Peach", bg: "#FFF6F1", accent: "#E8916A" },
  { name: "Sky", bg: "#F1F6FC", accent: "#6B9FD1" },
  { name: "Mint", bg: "#F0FAF5", accent: "#5CAD87" },
  { name: "Lavender", bg: "#F6F2FB", accent: "#9C84CC" },
  { name: "Amber", bg: "#FFF8EC", accent: "#D9A24E" },
  { name: "Rose", bg: "#FDF1F4", accent: "#DB7C93" },
  { name: "Teal", bg: "#EFF8F6", accent: "#4FA69B" },
];

const DEFAULT_TEMPLATE = [
  { id: "t1", time: "subuh", label: "Bangun sebelum adzan subuh", emoji: "⏰", why: "Bangun lebih awal bikin badan segar dan hati tenang menyambut hari." },
  { id: "t2", time: "subuh", label: "Merapikan tempat tidur", emoji: "🛏️", why: "Kamar rapi bikin pikiran lebih tenang dan nyaman dipakai istirahat lagi nanti." },
  { id: "t3", time: "subuh", label: "Membuka gorden dan jendela", emoji: "🌅", why: "Udara segar dan cahaya pagi bikin rumah lebih sehat." },
  { id: "t4", time: "subuh", label: "Mandi sebelum shalat subuh", emoji: "🚿", why: "Badan bersih bikin shalat lebih nyaman dan khusyuk." },
  { id: "t5", time: "subuh", label: "Shalat sunnah fajar di rumah", emoji: "🕌", why: "Shalat sunnah fajar keutamaannya besar, disebut lebih baik dari dunia seisinya." },
  { id: "t6", time: "subuh", label: "Ke masjid sebelum iqomah", emoji: "🚶", why: "Datang lebih awal ke masjid melatih disiplin dan menambah pahala menunggu shalat." },
  { id: "t7", time: "subuh", label: "Shalat sunah tahiyatul masjid", emoji: "🕌", why: "Sebagai penghormatan begitu masuk masjid, sebelum duduk." },
  { id: "t8", time: "subuh", label: "Shalat subuh di masjid", emoji: "🕌", why: "Shalat berjamaah di masjid pahalanya jauh lebih besar." },
  { id: "t9", time: "subuh", label: "Tilawah subuh", emoji: "📖", why: "Membaca Al-Qur'an di pagi hari bikin hati lebih tenang sepanjang hari." },
  { id: "t10", time: "subuh", label: "Sarapan", emoji: "🍳", why: "Energi dari sarapan bikin badan kuat untuk belajar dan beraktivitas." },
  { id: "t11", time: "subuh", label: "Meletakan semua alat makan di bak cuci", emoji: "🍽️", why: "Melatih tanggung jawab atas barang yang dipakai sendiri." },
  { id: "t12", time: "subuh", label: "Mencuci peralatan makan", emoji: "🧼", why: "Melatih kemandirian dan menjaga kebersihan rumah." },
  { id: "t13", time: "siang", label: "Qobliyah dzuhur", emoji: "🕌", why: "Shalat sunnah sebelum dzuhur jadi pelengkap ibadah wajib." },
  { id: "t14", time: "siang", label: "Shalat dzuhur", emoji: "🕌", why: "Shalat dzuhur adalah salah satu tiang agama yang wajib dijaga." },
  { id: "t15", time: "siang", label: "Dzuhur tepat waktu", emoji: "⏱️", why: "Shalat di awal waktu adalah amalan yang paling dicintai Allah." },
  { id: "t16", time: "siang", label: "Badiya dzuhur", emoji: "🕌", why: "Shalat sunnah setelah dzuhur menyempurnakan ibadah wajib." },
  { id: "t17", time: "siang", label: "Qobliyah ashar", emoji: "🕌", why: "Mengisi waktu sebelum ashar dengan ibadah tambahan." },
  { id: "t18", time: "siang", label: "Shalat Ashar", emoji: "🕌", why: "Ashar adalah shalat pertengahan yang sangat dijaga keutamaannya." },
  { id: "t19", time: "malam", label: "Mandi sore", emoji: "🚿", why: "Badan bersih dan segar sebelum beraktivitas malam." },
  { id: "t20", time: "malam", label: "Solat Maghrib", emoji: "🕌", why: "Waktu maghrib singkat, jadi penting shalat begitu masuk waktunya." },
  { id: "t21", time: "malam", label: "Makan malam", emoji: "🍚", why: "Makan malam menjaga energi tubuh untuk istirahat yang baik." },
  { id: "t22", time: "malam", label: "Solat Isya", emoji: "🕌", why: "Menutup ibadah shalat wajib di hari itu." },
  { id: "t23", time: "malam", label: "Sikat gigi malam", emoji: "🪥", why: "Gigi bersih sebelum tidur mencegah gigi berlubang." },
  { id: "t24", time: "malam", label: "Siap-siap tidur", emoji: "😴", why: "Tidur cukup bikin badan siap bangun subuh dengan segar." },
];

const TASK_POINTS = 10;
const BADGE_THRESHOLDS = [
  { days: 3, emoji: "🔥", label: "3 Hari Beruntun" },
  { days: 7, emoji: "🌟", label: "Seminggu Penuh" },
  { days: 14, emoji: "💎", label: "2 Minggu Konsisten" },
  { days: 30, emoji: "🏆", label: "Sebulan Juara" },
  { days: 60, emoji: "👑", label: "2 Bulan Legendaris" },
];
const MASCOT_STAGES = [
  { min: 0, emoji: "🥚", name: "Telur Misterius" },
  { min: 150, emoji: "🐣", name: "Anak Ayam" },
  { min: 400, emoji: "🐥", name: "Ayam Muda" },
  { min: 800, emoji: "🐓", name: "Ayam Jagoan" },
  { min: 1500, emoji: "🦅", name: "Elang Perkasa" },
  { min: 3000, emoji: "🐉", name: "Naga Legenda" },
];
const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const DAY_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTH_NAMES = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

/* ---------- helpers ---------- */
function localDateStr(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function mondayStr(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return localDateStr(date);
}
function formatDateID(d) {
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}
function genId() {
  return crypto.randomUUID();
}
function isNextDay(prevStr, todayStr) {
  if (!prevStr) return false;
  const prev = new Date(prevStr + "T00:00:00");
  const today = new Date(todayStr + "T00:00:00");
  return Math.round((today - prev) / 86400000) === 1;
}
function getDayCompletion(child, dateStr, todayStr) {
  if (dateStr === todayStr) {
    const total = child.tasks.filter((t) => t.active !== false).length;
    const done = child.tasks.filter((t) => t.active !== false && t.done).length;
    return total > 0 ? done / total : null;
  }
  const h = child.history && child.history[dateStr];
  if (!h || !h.total) return null;
  return h.done / h.total;
}
function getMascotProgress(totalPoints) {
  const total = totalPoints || 0;
  let idx = 0;
  for (let i = 0; i < MASCOT_STAGES.length; i++) if (total >= MASCOT_STAGES[i].min) idx = i;
  const stage = MASCOT_STAGES[idx];
  const next = MASCOT_STAGES[idx + 1] || null;
  const pct = next ? ((total - stage.min) / (next.min - stage.min)) * 100 : 100;
  return { stage, next, pct, total };
}
const DRAG_ROW_HEIGHT = 40;
function reorderWithinGroup(tasks, time, fromId, toIndexInGroup) {
  const groupTasks = tasks.filter((t) => t.time === time);
  const fromIndex = groupTasks.findIndex((t) => t.id === fromId);
  if (fromIndex === -1 || toIndexInGroup === fromIndex) return tasks;
  const reordered = [...groupTasks];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(Math.max(0, Math.min(reordered.length, toIndexInGroup)), 0, moved);
  let pointer = 0;
  return tasks.map((t) => (t.time === time ? reordered[pointer++] : t));
}
function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
    o.frequency.setValueAtTime(880, ctx.currentTime + 0.3);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.65);
  } catch (e) {}
}
function cloneTemplate() {
  return DEFAULT_TEMPLATE.map((t) => ({ ...t, id: genId(), active: true, done: false, doneAt: null, earnedPoints: 0, custom: false, needsPhoto: false, photo: null }));
}
function pickBonusTask(tasks) {
  const eligible = tasks.filter((t) => t.active !== false);
  if (eligible.length === 0) return null;
  return eligible[Math.floor(Math.random() * eligible.length)].id;
}
function pruneHistory(history, keepDays = 120) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - keepDays);
  const cutoffStr = localDateStr(cutoff);
  const pruned = {};
  Object.keys(history).forEach((k) => {
    if (k >= cutoffStr) pruned[k] = history[k];
  });
  return pruned;
}
function compressImage(file, maxDim = 360, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round(height * (maxDim / width));
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round(width * (maxDim / height));
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function initialData() {
  return {
    children: [],
    events: [],
    pin: "1234",
    lastActiveDate: localDateStr(),
    weekStart: mondayStr(),
    periods: DEFAULT_PERIODS.map((p) => ({ ...p })),
    settings: { leaderboardEnabled: true },
    location: null,
  };
}
function rollover(d) {
  const today = localDateStr();
  const thisMonday = mondayStr();
  let changed = false;
  let children = d.children;
  if (d.lastActiveDate !== today) {
    const gapIsOne = isNextDay(d.lastActiveDate, today);
    children = children.map((c) => {
      const total = c.tasks.filter((t) => t.active !== false).length;
      const done = c.tasks.filter((t) => t.active !== false && t.done).length;
      const wasComplete = total > 0 && done === total;
      let streak = c.streak || 0;
      streak = wasComplete ? (gapIsOne ? streak + 1 : 1) : 0;
      const bestStreak = Math.max(c.bestStreak || 0, streak);
      const history = pruneHistory({ ...(c.history || {}), [d.lastActiveDate]: { total, done } });
      const resetTasks = c.tasks.map((t) => ({ ...t, done: false, doneAt: null, earnedPoints: 0, photo: null }));
      return {
        ...c,
        points: 0,
        streak,
        bestStreak,
        history,
        bonusTaskId: pickBonusTask(resetTasks),
        tasks: resetTasks,
      };
    });
    changed = true;
  }
  if (d.weekStart !== thisMonday) {
    children = children.map((c) => ({ ...c, weeklyPoints: 0, rewardClaimed: false }));
    changed = true;
  }
  if (!changed) return d;
  return { ...d, children, lastActiveDate: today, weekStart: thisMonday };
}

/* ---------- small UI pieces ---------- */
function Avatar({ emoji, color, size = 56 }) {
  return (
    <div
      style={{ width: size, height: size, background: color, fontSize: size * 0.5 }}
      className="rounded-full flex items-center justify-center shrink-0 shadow-sm"
    >
      {emoji}
    </div>
  );
}

function ProgressBar({ pct, color, track = "#EFEAD8", height = 10 }) {
  return (
    <div style={{ background: track, height, borderRadius: 999 }} className="w-full overflow-hidden">
      <div
        style={{ width: `${Math.min(100, pct)}%`, background: color, height: "100%", transition: "width 0.4s ease" }}
        className="rounded-full"
      />
    </div>
  );
}

function Sheet({ title, onClose, children }) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <div onClick={onClose} className="absolute inset-0" style={{ background: "rgba(27,37,89,0.45)" }} />
      <div
        className="relative rounded-t-3xl flex flex-col"
        style={{ background: "#FFFDF7", maxHeight: "86%", boxShadow: "0 -8px 24px rgba(0,0,0,0.2)" }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b" style={{ borderColor: "#EFE6CE" }}>
          <h2 style={{ fontFamily: "'Baloo 2', sans-serif", color: INK }} className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} style={{ background: "#F1ECDB" }} className="p-2 rounded-full">
            <X size={18} color={INK} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function PinPad({ pin, onSuccess, onCancel }) {
  const [val, setVal] = useState("");
  const [err, setErr] = useState(false);
  const press = (n) => {
    if (val.length >= 4) return;
    const nv = val + n;
    setVal(nv);
    setErr(false);
    if (nv.length === 4) {
      if (nv === pin) setTimeout(onSuccess, 150);
      else {
        setErr(true);
        setTimeout(() => setVal(""), 400);
      }
    }
  };
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center px-8" style={{ background: "rgba(27,37,89,0.92)" }}>
      <Lock size={30} color={GOLD} />
      <p className="text-white mt-3 mb-1 font-semibold" style={{ fontFamily: "'Baloo 2', sans-serif" }}>Masukkan PIN Orang Tua</p>
      {err && <p style={{ color: "#FF8080" }} className="text-xs mb-2">PIN salah, coba lagi</p>}
      <div className="flex gap-3 my-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-full" style={{ width: 16, height: 16, background: val.length > i ? GOLD : "rgba(255,255,255,0.25)" }} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3 w-full max-w-[240px]">
        {[1,2,3,4,5,6,7,8,9].map((n) => (
          <button key={n} onClick={() => press(String(n))} className="rounded-2xl py-3 text-lg font-bold text-white" style={{ background: "rgba(255,255,255,0.12)" }}>{n}</button>
        ))}
        <button onClick={onCancel} className="rounded-2xl py-3 text-sm font-semibold text-white" style={{ background: "rgba(255,255,255,0.08)" }}>Batal</button>
        <button onClick={() => press("0")} className="rounded-2xl py-3 text-lg font-bold text-white" style={{ background: "rgba(255,255,255,0.12)" }}>0</button>
        <button onClick={() => setVal(val.slice(0, -1))} className="rounded-2xl py-3 text-sm font-semibold text-white" style={{ background: "rgba(255,255,255,0.08)" }}>⌫</button>
      </div>
    </div>
  );
}

function PhotoCaptureSheet({ label, emoji, onConfirm, onCancel }) {
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const inputRef = React.useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await compressImage(file);
      setPhoto(dataUrl);
    } catch (err) {
      // ignore - user can retry or skip
    }
    setBusy(false);
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center px-6" style={{ background: "rgba(27,37,89,0.85)" }}>
      <div className="rounded-3xl p-5 w-full pop-in flex flex-col items-center" style={{ background: "#FFFDF7", maxWidth: 300 }}>
        <div className="flex items-center gap-2 mb-3">
          <span style={{ fontSize: 20 }}>{emoji || "📌"}</span>
          <p style={{ fontFamily: "'Baloo 2', sans-serif", color: INK }} className="font-bold text-sm">{label}</p>
        </div>
        <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: "none" }} />
        {photo ? (
          <img src={photo} alt="Bukti tugas" className="rounded-2xl mb-3" style={{ width: "100%", maxHeight: 180, objectFit: "cover" }} />
        ) : (
          <button
            onClick={() => inputRef.current && inputRef.current.click()}
            disabled={busy}
            className="w-full rounded-2xl py-6 mb-3 flex flex-col items-center justify-center gap-1"
            style={{ background: "#F1ECDB", border: "2px dashed #C9BE93" }}
          >
            <span style={{ fontSize: 26 }}>📷</span>
            <span style={{ color: "#8A8360" }} className="text-xs font-semibold">{busy ? "Memproses…" : "Ambil Foto Bukti"}</span>
          </button>
        )}
        <div className="flex flex-col gap-2 w-full">
          {photo ? (
            <>
              <button onClick={() => onConfirm(photo)} className="rounded-xl py-2.5 text-sm font-bold text-white" style={{ background: "#00B8A9" }}>
                Selesai
              </button>
              <button onClick={() => setPhoto(null)} className="rounded-xl py-2 text-xs font-semibold" style={{ color: "#8A8360" }}>
                Foto Ulang
              </button>
            </>
          ) : (
            <button onClick={() => onConfirm(null)} className="rounded-xl py-2 text-xs font-semibold" style={{ color: "#8A8360" }}>
              Selesai tanpa foto
            </button>
          )}
          <button onClick={onCancel} className="rounded-xl py-2 text-xs font-semibold" style={{ color: DANGER }}>
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- main app ---------- */
export default function FamilyRoutineApp({ session }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [storageNotice, setStorageNotice] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [view, setView] = useState("dashboard");
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [now, setNow] = useState(new Date());
  const [pinAction, setPinAction] = useState(null);
  const [editChild, setEditChild] = useState(null);
  const [showChildSheet, setShowChildSheet] = useState(false);
  const [confirmDeleteChild, setConfirmDeleteChild] = useState(null);
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(localDateStr());
  const [showEventSheet, setShowEventSheet] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", who: "all", time: "", reminderMinutes: 60 });
  const [editingEventId, setEditingEventId] = useState(null);
  const [newTaskDraft, setNewTaskDraft] = useState({ label: "", time: "subuh" });
  const [newPin, setNewPin] = useState({ a: "", b: "" });
  const [pinSaved, setPinSaved] = useState(false);
  const [notifQueue, setNotifQueue] = useState([]);
  const [activeNotification, setActiveNotification] = useState(null);
  const [photoCapture, setPhotoCapture] = useState(null);
  const [showViolationSheet, setShowViolationSheet] = useState(false);
  const [newViolation, setNewViolation] = useState({ childId: null, note: "", points: 10 });
  const [locationStatus, setLocationStatus] = useState("idle"); // idle | locating | error

  const dayTotal = (c) => c.tasks.filter((t) => t.active !== false).length;
  const dayDone = (c) => c.tasks.filter((t) => t.active !== false && t.done).length;

  const saveTimer = React.useRef(null);
  const skipNextSave = React.useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const loaded = await loadFromSupabase();
        skipNextSave.current = true;
        setData(rollover(loaded));
      } catch (e) {
        console.error("Failed to load from Supabase:", e);
        setLoadError(true);
      }
      setLoading(false);
    })();
    const iv = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (loading || !data) return;
    if (skipNextSave.current) {
      // Data just came straight from Supabase (initial load, or a rollover
      // right after it) — no need to immediately write it back.
      skipNextSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveToSupabase(data)
        .then(() => setStorageNotice(false))
        .catch((e) => {
          console.error("Failed to save to Supabase:", e);
          setStorageNotice(true);
        });
    }, 800);
    return () => clearTimeout(saveTimer.current);
  }, [data, loading]);

  useEffect(() => {
    if (!data) return;
    let toMarkNotified = [];
    let toShow = [];
    data.events.forEach((e) => {
      if (!e.time || !e.reminderMinutes || e.reminderMinutes <= 0 || e.notified) return;
      const eventDT = new Date(`${e.date}T${e.time}:00`);
      if (isNaN(eventDT.getTime())) return;
      const reminderDT = new Date(eventDT.getTime() - e.reminderMinutes * 60000);
      if (now >= eventDT) {
        toMarkNotified.push(e.id);
      } else if (now >= reminderDT) {
        toMarkNotified.push(e.id);
        toShow.push(e);
      }
    });
    if (toMarkNotified.length > 0) {
      setData((prev) => ({
        ...prev,
        events: prev.events.map((e) => (toMarkNotified.includes(e.id) ? { ...e, notified: true } : e)),
      }));
    }
    if (toShow.length > 0) setNotifQueue((q) => [...q, ...toShow]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, data && data.events]);

  useEffect(() => {
    if (!activeNotification && notifQueue.length > 0) {
      const [next, ...rest] = notifQueue;
      setActiveNotification(next);
      setNotifQueue(rest);
      playChime();
      const t = setTimeout(() => setActiveNotification(null), 15000);
      return () => clearTimeout(t);
    }
  }, [notifQueue, activeNotification]);

  if (loadError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-center px-8" style={{ background: PAPER, minHeight: 500 }}>
        <span style={{ fontSize: 36 }}>⚠️</span>
        <p style={{ color: INK, fontFamily: "'Baloo 2', sans-serif" }} className="font-bold mt-2">Gagal memuat data</p>
        <p style={{ color: "#8A8360" }} className="text-sm mt-1 mb-4">Periksa koneksi internet, lalu coba lagi.</p>
        <button
          onClick={() => { setLoadError(false); setLoading(true); window.location.reload(); }}
          className="px-5 py-2.5 rounded-full text-white font-bold text-sm"
          style={{ background: "#FF6B4A" }}
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: PAPER, minHeight: 500 }}>
        <p style={{ color: INK, fontFamily: "'Baloo 2', sans-serif" }} className="font-bold">Memuat papan tugas…</p>
      </div>
    );
  }

  const requirePin = (cb) => setPinAction(() => cb);

  const selectedChild = data.children.find((c) => c.id === selectedChildId) || null;
  const theme = DAILY_THEMES[now.getDay()];

  function toggleTask(childId, taskId, photo) {
    setData((prev) => ({
      ...prev,
      children: prev.children.map((c) => {
        if (c.id !== childId) return c;
        let deltaPoints = 0;
        const tasks = c.tasks.map((t) => {
          if (t.id !== taskId) return t;
          if (t.done) {
            deltaPoints = -(t.earnedPoints || 0);
            return { ...t, done: false, doneAt: null, earnedPoints: 0, photo: null };
          }
          const nowD = new Date();
          const hhmm = `${String(nowD.getHours()).padStart(2, "0")}:${String(nowD.getMinutes()).padStart(2, "0")}`;
          let pts = TASK_POINTS;
          if (c.bonusTaskId && c.bonusTaskId === t.id) pts = pts * 2;
          deltaPoints = pts;
          return { ...t, done: true, doneAt: hhmm, earnedPoints: pts, photo: photo || null };
        });
        return {
          ...c,
          tasks,
          points: Math.max(0, c.points + deltaPoints),
          weeklyPoints: Math.max(0, c.weeklyPoints + deltaPoints),
          totalPoints: Math.max(0, (c.totalPoints || 0) + deltaPoints),
        };
      }),
    }));
  }

  function handleTaskTap(childId, taskId) {
    const child = data.children.find((c) => c.id === childId);
    const task = child && child.tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.done) {
      toggleTask(childId, taskId);
      return;
    }
    if (task.needsPhoto) {
      setPhotoCapture({ childId, taskId, label: task.label, emoji: task.emoji });
      return;
    }
    toggleTask(childId, taskId);
  }

  function saveChild(form) {
    setData((prev) => {
      const exists = prev.children.some((c) => c.id === form.id);
      if (exists) {
        return { ...prev, children: prev.children.map((c) => (c.id === form.id ? { ...c, ...form } : c)) };
      }
      return { ...prev, children: [...prev.children, form] };
    });
  }

  function deleteChild(id) {
    setData((prev) => ({ ...prev, children: prev.children.filter((c) => c.id !== id) }));
    if (selectedChildId === id) setSelectedChildId(null);
  }

  function applyTasksToAll(sourceId) {
    setData((prev) => {
      const source = prev.children.find((c) => c.id === sourceId);
      if (!source) return prev;
      return {
        ...prev,
        children: prev.children.map((c) =>
          c.id === sourceId ? c : { ...c, tasks: source.tasks.map((t) => ({ ...t, done: false, doneAt: null, earnedPoints: 0, photo: null })) }
        ),
      };
    });
  }

  function addEvent(ev) {
    setData((prev) => ({ ...prev, events: [...prev.events, { ...ev, id: genId(), notified: false }] }));
  }
  function updateEvent(id, patch) {
    setData((prev) => ({ ...prev, events: prev.events.map((e) => (e.id === id ? { ...e, ...patch, notified: false } : e)) }));
  }
  function deleteEvent(id) {
    setData((prev) => ({ ...prev, events: prev.events.filter((e) => e.id !== id) }));
  }
  function changePin(p) {
    setData((prev) => ({ ...prev, pin: p }));
  }
  function updatePeriod(key, patch) {
    setData((prev) => ({ ...prev, periods: prev.periods.map((p) => (p.key === key ? { ...p, ...patch } : p)) }));
  }
  function addPeriod() {
    setData((prev) => ({
      ...prev,
      periods: [...prev.periods, { key: genId(), label: "Kategori Baru", emoji: "⭐", color: "#FF9F45", start: "06:00", end: "08:00" }],
    }));
  }
  function deletePeriod(key) {
    setData((prev) => {
      if (prev.periods.length <= 1) return prev;
      const remaining = prev.periods.filter((p) => p.key !== key);
      const fallbackKey = remaining[0].key;
      return {
        ...prev,
        periods: remaining,
        children: prev.children.map((c) => ({
          ...c,
          tasks: c.tasks.map((t) => (t.time === key ? { ...t, time: fallbackKey } : t)),
        })),
      };
    });
  }
  function movePeriod(key, direction) {
    setData((prev) => {
      const idx = prev.periods.findIndex((p) => p.key === key);
      const swapWith = idx + direction;
      if (idx === -1 || swapWith < 0 || swapWith >= prev.periods.length) return prev;
      const periods = [...prev.periods];
      [periods[idx], periods[swapWith]] = [periods[swapWith], periods[idx]];
      return { ...prev, periods };
    });
  }
  function toggleLeaderboard() {
    setData((prev) => ({ ...prev, settings: { ...prev.settings, leaderboardEnabled: !prev.settings.leaderboardEnabled } }));
  }
  function updateFamilyName(name) {
    setData((prev) => ({ ...prev, settings: { ...prev.settings, familyName: name } }));
  }
  function detectLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("error");
      return;
    }
    setLocationStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setData((prev) => ({ ...prev, location: { lat: pos.coords.latitude, lon: pos.coords.longitude } }));
        setLocationStatus("idle");
      },
      () => setLocationStatus("error"),
      { timeout: 10000 }
    );
  }
  function setManualLocation(lat, lon) {
    setData((prev) => ({ ...prev, location: { lat, lon } }));
  }
  function addViolation(childId, note, points) {
    setData((prev) => ({
      ...prev,
      children: prev.children.map((c) => {
        if (c.id !== childId) return c;
        const violation = { id: genId(), note, points, date: localDateStr(), resolved: false, refund: 0 };
        return {
          ...c,
          points: Math.max(-200, c.points - points),
          weeklyPoints: Math.max(-200, c.weeklyPoints - points),
          violations: [violation, ...(c.violations || [])].slice(0, 50),
        };
      }),
    }));
  }
  function resolveViolation(childId, violationId) {
    setData((prev) => ({
      ...prev,
      children: prev.children.map((c) => {
        if (c.id !== childId) return c;
        let refundAmt = 0;
        const violations = (c.violations || []).map((v) => {
          if (v.id !== violationId || v.resolved) return v;
          refundAmt = Math.round(v.points / 2);
          return { ...v, resolved: true, refund: refundAmt };
        });
        return {
          ...c,
          points: c.points + refundAmt,
          weeklyPoints: c.weeklyPoints + refundAmt,
          violations,
        };
      }),
    }));
  }
  function claimReward(childId) {
    setData((prev) => ({
      ...prev,
      children: prev.children.map((c) => (c.id === childId ? { ...c, rewardClaimed: true } : c)),
    }));
  }

  return (
    <div
      className="app-font app-root relative overflow-hidden"
      style={{ width: "100vw", background: theme.bg, display: "flex", flexDirection: "column", transition: "background 0.6s ease" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        .app-font * { font-family: 'Plus Jakarta Sans', sans-serif; }
        .app-root { height: 100vh; }
        @supports (height: 100dvh) { .app-root { height: 100dvh; } }
        .check-circle { transition: transform 0.15s ease, background 0.15s ease; }
        .check-circle:active { transform: scale(0.88); }
        @keyframes pop { 0%{transform:scale(0.6);opacity:0;} 60%{transform:scale(1.08);opacity:1;} 100%{transform:scale(1);} }
        .pop-in { animation: pop 0.35s ease; }
        .app-scroll::-webkit-scrollbar { width: 0px; }
      `}</style>

          {storageNotice && (
            <div className="mx-4 mb-1 rounded-xl px-3 py-2 flex items-center gap-2 shrink-0" style={{ background: "#FDECEA" }}>
              <span style={{ fontSize: 13 }}>⚠️</span>
              <p style={{ color: DANGER }} className="text-[10px] font-semibold flex-1">Gagal menyimpan data. Perubahan mungkin hilang saat halaman ditutup.</p>
              <button onClick={() => setStorageNotice(false)} className="shrink-0">
                <X size={12} color={DANGER} />
              </button>
            </div>
          )}

          {/* MAIN SCROLL AREA */}
          <div className="flex-1 overflow-y-auto app-scroll px-4 pb-3" style={{ minHeight: 0 }}>
            {selectedChild ? (
              <ChildDetail
                child={selectedChild}
                periods={data.periods}
                onBack={() => setSelectedChildId(null)}
                onToggle={(taskId) => handleTaskTap(selectedChild.id, taskId)}
                onClaimReward={(childId) => requirePin(() => claimReward(childId))}
              />
            ) : view === "dashboard" ? (
              <Dashboard
                data={data}
                now={now}
                dayTotal={dayTotal}
                dayDone={dayDone}
                onOpenChild={(id) => setSelectedChildId(id)}
                onAddChild={() => requirePin(() => { setEditChild(null); setShowChildSheet(true); })}
                onToggleTask={handleTaskTap}
                accent={theme.accent}
                bg={theme.bg}
              />
            ) : view === "calendar" ? (
              <CalendarView
                data={data}
                calMonth={calMonth}
                setCalMonth={setCalMonth}
                selectedDay={selectedDay}
                setSelectedDay={setSelectedDay}
                onAddEvent={() => requirePin(() => { setEditingEventId(null); setNewEvent({ title: "", who: "all", time: "", reminderMinutes: 60 }); setShowEventSheet(true); })}
                onEditEvent={(e) => requirePin(() => {
                  setEditingEventId(e.id);
                  setNewEvent({ title: e.title, who: e.who, time: e.time || "", reminderMinutes: e.reminderMinutes || 0 });
                  setShowEventSheet(true);
                })}
                onDeleteEvent={(id) => requirePin(() => deleteEvent(id))}
              />
            ) : (
              <SettingsView
                data={data}
                accent={theme.accent}
                userEmail={session.user.email}
                onLogout={() => supabase.auth.signOut()}
                onAddChild={() => { setEditChild(null); setShowChildSheet(true); }}
                onEditChild={(c) => { setEditChild(c); setShowChildSheet(true); }}
                onDeleteChild={(c) => setConfirmDeleteChild(c)}
                confirmDeleteChild={confirmDeleteChild}
                onConfirmDelete={() => { deleteChild(confirmDeleteChild.id); setConfirmDeleteChild(null); }}
                onCancelDelete={() => setConfirmDeleteChild(null)}
                newPin={newPin}
                setNewPin={setNewPin}
                pinSaved={pinSaved}
                periods={data.periods}
                onUpdatePeriod={updatePeriod}
                onAddPeriod={addPeriod}
                onDeletePeriod={deletePeriod}
                onMovePeriod={movePeriod}
                settings={data.settings}
                onToggleLeaderboard={toggleLeaderboard}
                onUpdateFamilyName={updateFamilyName}
                location={data.location}
                locationStatus={locationStatus}
                onDetectLocation={detectLocation}
                onSetManualLocation={setManualLocation}
                onOpenViolationSheet={() => { setNewViolation({ childId: data.children[0] ? data.children[0].id : null, note: "", points: 10 }); setShowViolationSheet(true); }}
                onResolveViolation={resolveViolation}
                onSavePin={() => {
                  if (newPin.a.length === 4 && newPin.a === newPin.b) {
                    changePin(newPin.a);
                    setNewPin({ a: "", b: "" });
                    setPinSaved(true);
                    setTimeout(() => setPinSaved(false), 1800);
                  }
                }}
              />
            )}
          </div>

          {/* bottom nav */}
          <div className="flex justify-around items-center px-2 py-3 shrink-0" style={{ background: "#FFFDF7", borderTop: "1px solid #EFE6CE" }}>
            <NavBtn active={view === "dashboard" && !selectedChild} icon={Home} label="Beranda" accent={theme.accent} onClick={() => { setSelectedChildId(null); setView("dashboard"); }} />
            <NavBtn active={view === "calendar" && !selectedChild} icon={CalendarDays} label="Kalender" accent={theme.accent} onClick={() => { setSelectedChildId(null); setView("calendar"); }} />
            <NavBtn
              active={view === "settings" && !selectedChild}
              icon={SettingsIcon}
              label="Pengaturan"
              accent={theme.accent}
              locked
              onClick={() => requirePin(() => { setSelectedChildId(null); setView("settings"); })}
            />
          </div>

          {/* overlays */}
          {photoCapture && (
            <PhotoCaptureSheet
              label={photoCapture.label}
              emoji={photoCapture.emoji}
              onConfirm={(photo) => { toggleTask(photoCapture.childId, photoCapture.taskId, photo); setPhotoCapture(null); }}
              onCancel={() => setPhotoCapture(null)}
            />
          )}
          {activeNotification && (
            <NotificationBanner
              event={activeNotification}
              data={data}
              onDismiss={() => setActiveNotification(null)}
            />
          )}
          {pinAction && (
            <PinPad
              pin={data.pin}
              onSuccess={() => { pinAction(); setPinAction(null); }}
              onCancel={() => setPinAction(null)}
            />
          )}

          {showChildSheet && (
            <ChildEditSheet
              initial={editChild}
              siblingCount={data.children.length}
              periods={data.periods}
              accent={theme.accent}
              onClose={() => setShowChildSheet(false)}
              onSave={(form) => { saveChild(form); setShowChildSheet(false); }}
              onApplyAll={(id) => applyTasksToAll(id)}
              newTaskDraft={newTaskDraft}
              setNewTaskDraft={setNewTaskDraft}
            />
          )}

          {showEventSheet && (
            <EventSheet
              day={selectedDay}
              children={data.children}
              value={newEvent}
              setValue={setNewEvent}
              isEditing={!!editingEventId}
              onClose={() => { setShowEventSheet(false); setEditingEventId(null); }}
              onSave={() => {
                if (!newEvent.title.trim()) return;
                if (editingEventId) {
                  updateEvent(editingEventId, { ...newEvent, date: selectedDay });
                } else {
                  addEvent({ ...newEvent, date: selectedDay });
                }
                setShowEventSheet(false);
                setEditingEventId(null);
              }}
            />
          )}

          {showViolationSheet && (
            <ViolationSheet
              children={data.children}
              value={newViolation}
              setValue={setNewViolation}
              onClose={() => setShowViolationSheet(false)}
              onSave={() => {
                if (!newViolation.childId || !newViolation.note.trim() || newViolation.points <= 0) return;
                addViolation(newViolation.childId, newViolation.note.trim(), newViolation.points);
                setShowViolationSheet(false);
                setNewViolation({ childId: null, note: "", points: 10 });
              }}
            />
          )}
    </div>
  );
}

/* ---------- Nav button ---------- */
function NavBtn({ active, icon: Icon, label, onClick, locked, accent }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 px-3 py-1">
      <div className="relative">
        <Icon size={20} color={active ? accent : INK} strokeWidth={active ? 2.6 : 2} />
        {locked && <Lock size={9} color={INK} style={{ position: "absolute", right: -6, bottom: -4 }} />}
      </div>
      <span style={{ color: active ? accent : INK, fontSize: 11 }} className="font-semibold">{label}</span>
    </button>
  );
}

/* ---------- Dashboard ---------- */
function TaskItem({ t, period, isBonus, whyOpen, onToggle, onOpenWhy, onViewPhoto }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: isBonus ? "#FFF6DA" : "#FFFDF7" }}>
      <div onClick={onToggle} className="flex items-center gap-1.5 px-2 py-1.5" style={{ cursor: "pointer" }}>
        <span style={{ fontSize: 15 }} className="shrink-0">{t.emoji || "📌"}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <p style={{ color: t.done ? "#B8AF8F" : INK, textDecoration: t.done ? "line-through" : "none" }} className="text-[11px] font-semibold leading-snug">{t.label}</p>
            {isBonus && <span style={{ fontSize: 9 }}>✨</span>}
            {t.needsPhoto && !t.done && <span style={{ fontSize: 9 }}>📷</span>}
          </div>
          {t.done && (
            <p style={{ color: "#B8AF8F" }} className="text-[9px] font-semibold mt-0.5">
              Selesai {t.doneAt}
            </p>
          )}
        </div>
        {t.photo && (
          <img
            src={t.photo}
            onClick={(e) => { e.stopPropagation(); onViewPhoto(t.photo); }}
            className="rounded-md shrink-0"
            style={{ width: 22, height: 22, objectFit: "cover" }}
            alt="Bukti"
          />
        )}
        {t.why && (
          <button onClick={(e) => { e.stopPropagation(); onOpenWhy(); }} className="rounded-full flex items-center justify-center shrink-0" style={{ width: 16, height: 16, background: "#EFEAD8", color: "#8A8360" }}>
            <span style={{ fontSize: 9 }}>ⓘ</span>
          </button>
        )}
        <div
          className={`check-circle rounded-full flex items-center justify-center shrink-0 ${t.done ? "pop-in" : ""}`}
          style={{ width: 26, height: 26, background: t.done ? period.color : "#EFEAD8", border: t.done ? "none" : "2px solid #DCD3AE" }}
        >
          {t.done && <Check size={14} color="#fff" strokeWidth={3} />}
        </div>
      </div>
      {whyOpen && (
        <div className="px-2 pb-1.5 -mt-0.5">
          <p style={{ color: "#8A8360", background: "#F1ECDB" }} className="text-[10px] rounded-lg px-2 py-1.5">{t.why}</p>
        </div>
      )}
    </div>
  );
}

function ChildHeaderCard({ child, onOpenDetail, dayTotal, dayDone }) {
  const total = dayTotal(child), done = dayDone(child);
  return (
    <div onClick={() => onOpenDetail(child.id)} className="rounded-2xl p-2.5 flex items-center gap-2" style={{ background: "#FFFDF7", cursor: "pointer" }}>
      <Avatar emoji={child.emoji} color={child.color} size={32} />
      <div className="flex-1 min-w-0">
        <p style={{ fontFamily: "'Baloo 2', sans-serif", color: INK }} className="font-bold text-xs truncate">{child.name}</p>
        <p style={{ color: "#8A8360" }} className="text-[10px]">{done}/{total} tugas</p>
      </div>
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <div className="flex items-center gap-0.5">
          <Star size={10} color={GOLD} fill={GOLD} />
          <span style={{ color: INK }} className="text-[10px] font-bold">{child.points}</span>
        </div>
        {child.streak > 0 && (
          <div className="flex items-center gap-0.5">
            <span style={{ fontSize: 9 }}>🔥</span>
            <span style={{ color: "#FF6B4A" }} className="text-[10px] font-bold">{child.streak}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ChildTaskBody({ child, periods, onToggleTask, whyOpen, setWhyOpen, setPhotoView }) {
  const bonusTask = child.tasks.find((t) => t.id === child.bonusTaskId && t.active !== false);
  return (
    <div className="flex flex-col gap-2">
      {bonusTask && !bonusTask.done && (
        <div className="rounded-xl px-2 py-1.5 flex items-center gap-1.5" style={{ background: GOLD }}>
          <span style={{ fontSize: 13 }}>🎲</span>
          <p style={{ color: INK }} className="text-[10px] font-bold truncate">2x: {bonusTask.label}</p>
        </div>
      )}

      {periods.map((period) => {
        const list = child.tasks.filter((t) => t.time === period.key && t.active !== false);
        if (list.length === 0) return null;
        return (
          <div key={period.key} className="rounded-2xl p-1.5" style={{ background: period.color + "1A" }}>
            <div className="flex items-center gap-1 mb-1 px-0.5">
              <span style={{ fontSize: 11 }}>{period.emoji}</span>
              <span style={{ color: period.color, fontFamily: "'Baloo 2', sans-serif" }} className="text-[10px] font-bold flex-1 truncate">{period.label}</span>
              <span style={{ color: period.color }} className="text-[9px] font-semibold shrink-0">{list.filter((t) => t.done).length}/{list.length}</span>
            </div>
            <div className="flex flex-col gap-1">
              {list.map((t) => (
                <TaskItem
                  key={t.id}
                  t={t}
                  period={period}
                  isBonus={child.bonusTaskId === t.id}
                  whyOpen={!!(whyOpen && whyOpen.childId === child.id && whyOpen.taskId === t.id)}
                  onToggle={() => onToggleTask(child.id, t.id)}
                  onOpenWhy={() => setWhyOpen(whyOpen && whyOpen.childId === child.id && whyOpen.taskId === t.id ? null : { childId: child.id, taskId: t.id })}
                  onViewPhoto={setPhotoView}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PrayerTimesCard({ now, location }) {
  if (!location) {
    return (
      <div className="rounded-2xl px-3 py-2.5 mb-3 flex items-center gap-2" style={{ background: "#FFFDF7", border: "2px dashed #E3D9B4" }}>
        <span style={{ fontSize: 16 }}>🕌</span>
        <p style={{ color: "#8A8360" }} className="text-[11px]">Aktifkan lokasi di Pengaturan untuk menampilkan jadwal shalat.</p>
      </div>
    );
  }
  const times = calcPrayerTimes(now.getFullYear(), now.getMonth() + 1, now.getDate(), location.lat, location.lon, -now.getTimezoneOffset() / 60);
  const order = [["Subuh", times.subuh], ["Dzuhur", times.dzuhur], ["Ashar", times.ashar], ["Maghrib", times.maghrib], ["Isya", times.isya]];
  const nowHM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const nextIdx = order.findIndex(([, t]) => t && nowHM < t);
  return (
    <div className="rounded-2xl p-2.5 mb-3" style={{ background: "#FFFDF7" }}>
      <div className="flex items-center gap-1 mb-1.5 px-0.5">
        <span style={{ fontSize: 13 }}>🕌</span>
        <span style={{ fontFamily: "'Baloo 2', sans-serif", color: INK }} className="text-xs font-bold">Jadwal Shalat Hari Ini</span>
        {times.imsak && <span style={{ color: "#8A8360" }} className="text-[10px] ml-auto">Imsak {times.imsak}</span>}
      </div>
      <div className="grid grid-cols-5 gap-1">
        {order.map(([label, t], idx) => (
          <div key={label} className="flex flex-col items-center rounded-xl py-1.5" style={{ background: idx === nextIdx ? INK : "#F1ECDB" }}>
            <span style={{ color: idx === nextIdx ? "#fff" : "#8A8360" }} className="text-[9px] font-semibold">{label}</span>
            <span style={{ color: idx === nextIdx ? "#fff" : INK }} className="text-[11px] font-bold">{t || "--:--"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Dashboard({ data, now, dayTotal, dayDone, onOpenChild, onAddChild, onToggleTask, accent, bg }) {
  const [whyOpen, setWhyOpen] = useState(null);
  const [photoView, setPhotoView] = useState(null);
  const upcoming = data.events
    .filter((e) => e.date >= localDateStr())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);

  return (
    <div className="relative">
      {/* FROZEN HEADER — stays pinned while only the task lists below scroll */}
      <div className="sticky top-0 z-20 pb-2" style={{ background: bg }}>
        <div className="pt-2 pb-3 text-center">
          {data.settings.familyName && (
            <p style={{ fontFamily: "'Baloo 2', sans-serif", color: "#8A8360" }} className="font-bold text-xs uppercase tracking-wide mb-1">{data.settings.familyName}</p>
          )}
          <p style={{ fontFamily: "'Baloo 2', sans-serif", color: INK, fontSize: 46, lineHeight: 1 }} className="font-extrabold tabular-nums">
            {String(now.getHours()).padStart(2, "0")}:{String(now.getMinutes()).padStart(2, "0")}
          </p>
          <p style={{ fontFamily: "'Baloo 2', sans-serif", color: INK, fontSize: 18 }} className="font-bold mt-1">{formatDateID(now)}</p>
        </div>

        {upcoming.length > 0 && (
          <div className="mb-4">
            <p style={{ fontFamily: "'Baloo 2', sans-serif", color: INK }} className="font-bold text-sm mb-2">Acara Mendatang</p>
            <div className="flex flex-col gap-2">
              {upcoming.map((e) => {
                const who = e.who === "all" ? null : data.children.find((c) => c.id === e.who);
                const dot = who ? who.color : INK;
                const d = new Date(e.date + "T00:00:00");
                return (
                  <div key={e.id} className="flex items-center gap-2 rounded-2xl px-3 py-2" style={{ background: "#FFFDF7" }}>
                    <div style={{ width: 8, height: 8, borderRadius: 999, background: dot }} />
                    <div className="flex-1">
                      <p style={{ color: INK }} className="text-xs font-bold">{e.title}</p>
                      <p style={{ color: "#8A8360" }} className="text-[10px]">{DAY_SHORT[d.getDay()]}, {d.getDate()} {MONTH_NAMES[d.getMonth()]}{e.time ? ` · ${e.time}` : ""} {who ? `· ${who.name}` : "· Semua Keluarga"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <PrayerTimesCard now={now} location={data.location} />

        {data.settings.leaderboardEnabled && data.children.length > 1 && (
          <div className="mb-3">
            <p style={{ fontFamily: "'Baloo 2', sans-serif", color: INK }} className="font-bold text-sm mb-2">Papan Peringkat Minggu Ini</p>
            <div className="flex flex-col gap-2">
              {[...data.children].sort((a, b) => b.weeklyPoints - a.weeklyPoints).map((c, idx) => (
                <div key={c.id} className="flex items-center gap-2 rounded-2xl px-3 py-2" style={{ background: "#FFFDF7" }}>
                  <span style={{ width: 20, textAlign: "center", fontSize: 14 }}>{["🥇", "🥈", "🥉"][idx] || idx + 1}</span>
                  <Avatar emoji={c.emoji} color={c.color} size={28} />
                  <span style={{ color: INK }} className="text-xs font-bold flex-1">{c.name}</span>
                  <span style={{ color: "#8A8360" }} className="text-xs font-semibold">{c.weeklyPoints} poin</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.children.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5">
            {data.children.map((c) => (
              <ChildHeaderCard key={c.id} child={c} onOpenDetail={onOpenChild} dayTotal={dayTotal} dayDone={dayDone} />
            ))}
          </div>
        )}
      </div>

      {/* SCROLLING BODY — only the task lists move */}
      {data.children.length === 0 ? (
        <div className="mt-2 flex flex-col items-center text-center px-4 py-10 rounded-3xl" style={{ background: "#FFFDF7", border: "2px dashed #E3D9B4" }}>
          <span style={{ fontSize: 40 }}>🧸</span>
          <p style={{ fontFamily: "'Baloo 2', sans-serif", color: INK }} className="font-bold mt-2">Papan tugas masih kosong</p>
          <p style={{ color: "#8A8360" }} className="text-sm mt-1 mb-4">Tambahkan anak pertama untuk mulai membuat checklist harian.</p>
          <button onClick={onAddChild} style={{ background: accent }} className="px-5 py-2.5 rounded-full text-white font-bold text-sm flex items-center gap-1">
            <Plus size={16} /> Tambah Anak
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 mt-2">
          {data.children.map((c) => (
            <ChildTaskBody
              key={c.id}
              child={c}
              periods={data.periods}
              onToggleTask={onToggleTask}
              whyOpen={whyOpen}
              setWhyOpen={setWhyOpen}
              setPhotoView={setPhotoView}
            />
          ))}
        </div>
      )}

      {photoView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(27,37,89,0.9)" }} onClick={() => setPhotoView(null)}>
          <img src={photoView} alt="Bukti tugas" className="rounded-2xl" style={{ maxWidth: "100%", maxHeight: "80%", objectFit: "contain" }} />
        </div>
      )}
    </div>
  );
}

/* ---------- Child Detail ---------- */
function ChildDetail({ child, periods, onBack, onToggle, onClaimReward }) {
  const total = child.tasks.filter((t) => t.active !== false).length;
  const done = child.tasks.filter((t) => t.active !== false && t.done).length;
  const weekPct = child.weeklyGoal ? (child.weeklyPoints / child.weeklyGoal) * 100 : 0;
  const achieved = child.weeklyGoal && child.weeklyPoints >= child.weeklyGoal;
  const mascot = getMascotProgress(child.totalPoints);
  const [whyOpenId, setWhyOpenId] = useState(null);
  const [photoView, setPhotoView] = useState(null);
  const [heatmapMonth, setHeatmapMonth] = useState(new Date());
  const bonusTask = child.tasks.find((t) => t.id === child.bonusTaskId && t.active !== false);

  const todayStr = localDateStr();
  const hmYear = heatmapMonth.getFullYear(), hmMonth = heatmapMonth.getMonth();
  const hmFirstDay = new Date(hmYear, hmMonth, 1);
  const hmOffset = (hmFirstDay.getDay() + 6) % 7;
  const hmDaysInMonth = new Date(hmYear, hmMonth + 1, 0).getDate();
  const hmCells = [];
  for (let i = 0; i < hmOffset; i++) hmCells.push(null);
  for (let d = 1; d <= hmDaysInMonth; d++) hmCells.push(d);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 pt-2 pb-3">
        <button onClick={onBack} style={{ background: "#FFFDF7" }} className="p-2 rounded-full">
          <ArrowLeft size={16} color={INK} />
        </button>
        <Avatar emoji={child.emoji} color={child.color} size={38} />
        <div className="flex-1">
          <p style={{ fontFamily: "'Baloo 2', sans-serif", color: INK }} className="font-bold leading-none">{child.name}</p>
          <p style={{ color: "#8A8360" }} className="text-[11px] mt-1">{done}/{total} tugas selesai</p>
        </div>
        {child.streak > 0 && (
          <div className="flex items-center gap-1 px-2 py-1.5 rounded-full" style={{ background: "#FFEDE6" }}>
            <span style={{ fontSize: 12 }}>🔥</span>
            <span style={{ color: "#FF6B4A" }} className="text-xs font-extrabold">{child.streak}</span>
          </div>
        )}
        <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full" style={{ background: GOLD + "33" }}>
          <Star size={12} color="#B8860B" fill="#B8860B" />
          <span style={{ color: "#7A5B00" }} className="text-xs font-extrabold">{child.points}</span>
        </div>
      </div>

      <div className="rounded-3xl p-4 mb-4 flex items-center gap-3" style={{ background: "#FFFDF7", border: "2px solid #EFE6CE" }}>
        <span style={{ fontSize: 38 }}>{mascot.stage.emoji}</span>
        <div className="flex-1 min-w-0">
          <p style={{ fontFamily: "'Baloo 2', sans-serif", color: INK }} className="font-bold text-sm">{mascot.stage.name}</p>
          {mascot.next ? (
            <>
              <ProgressBar pct={mascot.pct} color={child.color} height={8} />
              <p style={{ color: "#8A8360" }} className="text-[10px] mt-1">{mascot.next.min - mascot.total} poin lagi ke {mascot.next.name}</p>
            </>
          ) : (
            <p style={{ color: "#8A8360" }} className="text-[10px] mt-1">Level tertinggi tercapai! 🎉</p>
          )}
        </div>
      </div>

      {bonusTask && !bonusTask.done && (
        <div className="rounded-3xl p-3 mb-4 flex items-center gap-2" style={{ background: GOLD }}>
          <span style={{ fontSize: 22 }}>🎲</span>
          <div className="flex-1 min-w-0">
            <p style={{ color: INK, fontFamily: "'Baloo 2', sans-serif" }} className="font-bold text-xs">Misi Bonus Hari Ini · 2x Poin!</p>
            <p style={{ color: INK }} className="text-xs font-semibold truncate">{bonusTask.emoji} {bonusTask.label}</p>
          </div>
        </div>
      )}

      {periods.map((period) => {
        const list = child.tasks.filter((t) => t.time === period.key && t.active !== false);
        if (list.length === 0) return null;
        const sectionDone = list.filter((t) => t.done).length;
        return (
          <div key={period.key} className="mb-4 rounded-3xl p-3" style={{ background: period.color + "1A" }}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span style={{ fontSize: 15 }}>{period.emoji}</span>
              <span style={{ color: period.color, fontFamily: "'Baloo 2', sans-serif" }} className="font-bold text-sm">{period.label}</span>
              <span style={{ color: period.color }} className="text-[10px] font-semibold">{period.start}–{period.end}</span>
              <span style={{ color: period.color }} className="text-xs ml-auto font-semibold">{sectionDone}/{list.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {list.map((t) => {
                const isBonus = child.bonusTaskId === t.id;
                return (
                  <div key={t.id} className="rounded-2xl overflow-hidden" style={{ background: isBonus ? "#FFF6DA" : "#FFFDF7" }}>
                    <div onClick={() => onToggle(t.id)} className="flex items-center gap-3 px-3 py-2.5" style={{ cursor: "pointer" }}>
                      <span style={{ fontSize: 18 }}>{t.emoji || "📌"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p style={{ color: t.done ? "#B8AF8F" : INK, textDecoration: t.done ? "line-through" : "none" }} className="text-sm font-semibold truncate">{t.label}</p>
                          {isBonus && <span style={{ fontSize: 10 }}>✨</span>}
                          {t.needsPhoto && !t.done && <span style={{ fontSize: 10 }}>📷</span>}
                        </div>
                        {t.done && (
                          <p style={{ color: "#B8AF8F" }} className="text-[10px] font-semibold mt-0.5">
                            Selesai {t.doneAt}{isBonus ? " · 2x poin" : ""}
                          </p>
                        )}
                      </div>
                      {t.photo && (
                        <img
                          src={t.photo}
                          onClick={(e) => { e.stopPropagation(); setPhotoView(t.photo); }}
                          className="rounded-lg shrink-0"
                          style={{ width: 28, height: 28, objectFit: "cover" }}
                          alt="Bukti"
                        />
                      )}
                      {t.why && (
                        <button onClick={(e) => { e.stopPropagation(); setWhyOpenId(whyOpenId === t.id ? null : t.id); }} className="rounded-full flex items-center justify-center shrink-0" style={{ width: 20, height: 20, background: "#EFEAD8", color: "#8A8360" }}>
                          <span style={{ fontSize: 11 }}>ⓘ</span>
                        </button>
                      )}
                      <div
                        className={`check-circle rounded-full flex items-center justify-center shrink-0 ${t.done ? "pop-in" : ""}`}
                        style={{ width: 30, height: 30, background: t.done ? period.color : "#EFEAD8", border: t.done ? "none" : "2px solid #DCD3AE" }}
                      >
                        {t.done && <Check size={16} color="#fff" strokeWidth={3} />}
                      </div>
                    </div>
                    {whyOpenId === t.id && (
                      <div className="px-3 pb-2.5 -mt-1">
                        <p style={{ color: "#8A8360", background: "#F8F4E4" }} className="text-[11px] rounded-lg px-2.5 py-2">{t.why}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="rounded-3xl p-4 mb-4" style={{ background: achieved ? GOLD : "#FFFDF7", border: achieved ? "none" : "2px solid #EFE6CE" }}>
        <div className="flex items-center gap-2 mb-1">
          <Award size={16} color={achieved ? INK : "#B8860B"} />
          <span style={{ fontFamily: "'Baloo 2', sans-serif", color: INK }} className="font-bold text-sm">Progres Mingguan</span>
        </div>
        <ProgressBar pct={weekPct} color={achieved ? INK : GOLD} track={achieved ? "rgba(27,37,89,0.15)" : "#EFEAD8"} height={12} />
        <p style={{ color: INK }} className="text-xs mt-1.5 font-semibold">{child.weeklyPoints} / {child.weeklyGoal} poin</p>
        {child.weeklyReward ? (
          <p style={{ color: INK }} className="text-xs mt-1">🎁 Hadiah: {child.weeklyReward}</p>
        ) : null}
        {achieved && (
          <p style={{ color: INK, fontFamily: "'Baloo 2', sans-serif" }} className="font-bold text-sm mt-2">🎉 Target minggu ini tercapai!</p>
        )}
        {achieved && child.weeklyReward ? (
          child.rewardClaimed ? (
            <p style={{ color: INK }} className="text-xs font-bold mt-2">✅ Hadiah sudah diklaim minggu ini</p>
          ) : (
            <button
              onClick={() => onClaimReward(child.id)}
              className="w-full rounded-xl py-2 text-sm font-bold mt-2"
              style={{ background: INK, color: GOLD }}
            >
              🎁 Klaim Hadiah
            </button>
          )
        ) : null}
      </div>

      <div className="mb-4">
        <p style={{ fontFamily: "'Baloo 2', sans-serif", color: INK }} className="font-bold text-sm mb-2">Lencana Pencapaian</p>
        <div className="flex flex-wrap gap-2">
          {BADGE_THRESHOLDS.map((b) => {
            const earned = (child.bestStreak || 0) >= b.days;
            return (
              <div
                key={b.days}
                className="flex flex-col items-center justify-center rounded-2xl px-1 py-2"
                style={{ width: 64, background: earned ? "#FFFDF7" : "#EFEAD8", opacity: earned ? 1 : 0.45, border: earned ? `2px solid ${GOLD}` : "2px solid transparent" }}
              >
                <span style={{ fontSize: 20 }}>{b.emoji}</span>
                <span style={{ color: INK, fontSize: 9 }} className="font-bold text-center mt-1 leading-tight">{b.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {(child.violations || []).length > 0 && (
        <div className="mb-4">
          <p style={{ fontFamily: "'Baloo 2', sans-serif", color: INK }} className="font-bold text-sm mb-2">Catatan Perilaku</p>
          <div className="flex flex-col gap-1.5">
            {child.violations.slice(0, 5).map((v) => (
              <div key={v.id} className="rounded-2xl px-3 py-2" style={{ background: "#FFFDF7" }}>
                <div className="flex items-center justify-between gap-2">
                  <p style={{ color: INK }} className="text-xs font-semibold truncate flex-1">{v.note}</p>
                  <span style={{ color: DANGER }} className="text-xs font-bold shrink-0">-{v.points}</span>
                </div>
                <p style={{ color: v.resolved ? "#00B8A9" : "#8A8360" }} className="text-[10px] mt-0.5">
                  {v.date}{v.resolved ? ` · Sudah diselesaikan (+${v.refund} dikembalikan)` : " · Belum diselesaikan"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-2">
        <div className="flex items-center justify-between mb-2">
          <p style={{ fontFamily: "'Baloo 2', sans-serif", color: INK }} className="font-bold text-sm">Kalender Kebiasaan</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setHeatmapMonth(new Date(hmYear, hmMonth - 1, 1))} className="p-1 rounded-full" style={{ background: "#FFFDF7" }}>
              <ChevronLeft size={13} color={INK} />
            </button>
            <span style={{ color: INK }} className="text-[11px] font-semibold w-16 text-center">{MONTH_NAMES[hmMonth].slice(0, 3)} {hmYear}</span>
            <button onClick={() => setHeatmapMonth(new Date(hmYear, hmMonth + 1, 1))} className="p-1 rounded-full" style={{ background: "#FFFDF7" }}>
              <ChevronRight size={13} color={INK} />
            </button>
          </div>
        </div>
        <div className="rounded-3xl p-3" style={{ background: "#FFFDF7" }}>
          <div className="grid grid-cols-7 gap-1">
            {hmCells.map((d, i) => {
              if (d === null) return <div key={i} />;
              const dateStr = `${hmYear}-${String(hmMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
              const frac = dateStr > todayStr ? null : getDayCompletion(child, dateStr, todayStr);
              const isToday = dateStr === todayStr;
              return (
                <div
                  key={i}
                  title={frac === null ? "" : `${Math.round(frac * 100)}%`}
                  className="rounded-md flex items-center justify-center"
                  style={{
                    aspectRatio: "1/1",
                    background: frac === null ? "#EFEAD8" : child.color,
                    opacity: frac === null ? 0.5 : Math.max(0.15, frac),
                    border: isToday ? `2px solid ${INK}` : "none",
                  }}
                >
                  <span style={{ fontSize: 8, color: frac && frac > 0.5 ? "#fff" : "#8A8360" }}>{d}</span>
                </div>
              );
            })}
          </div>
          <p style={{ color: "#8A8360" }} className="text-[10px] mt-2">Makin gelap warnanya, makin banyak tugas yang selesai hari itu.</p>
        </div>
      </div>

      {photoView && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(27,37,89,0.9)" }} onClick={() => setPhotoView(null)}>
          <img src={photoView} alt="Bukti tugas" className="rounded-2xl" style={{ maxWidth: "100%", maxHeight: "80%", objectFit: "contain" }} />
        </div>
      )}
    </div>
  );
}

/* ---------- Calendar ---------- */
function CalendarView({ data, calMonth, setCalMonth, selectedDay, setSelectedDay, onAddEvent, onEditEvent, onDeleteEvent }) {
  const year = calMonth.getFullYear(), month = calMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const eventsByDay = {};
  data.events.forEach((e) => {
    eventsByDay[e.date] = eventsByDay[e.date] || [];
    eventsByDay[e.date].push(e);
  });

  const selectedEvents = (eventsByDay[selectedDay] || []).sort((a, b) => (a.time || "").localeCompare(b.time || ""));

  return (
    <div>
      <div className="flex items-center justify-between pt-2 pb-3">
        <h1 style={{ fontFamily: "'Baloo 2', sans-serif", color: INK }} className="text-xl font-extrabold">Kalender Keluarga</h1>
      </div>
      <div className="flex items-center justify-between mb-2 px-1">
        <button onClick={() => setCalMonth(new Date(year, month - 1, 1))} className="p-1.5 rounded-full" style={{ background: "#FFFDF7" }}>
          <ChevronLeft size={16} color={INK} />
        </button>
        <span style={{ color: INK, fontFamily: "'Baloo 2', sans-serif" }} className="font-bold text-sm">{MONTH_NAMES[month]} {year}</span>
        <button onClick={() => setCalMonth(new Date(year, month + 1, 1))} className="p-1.5 rounded-full" style={{ background: "#FFFDF7" }}>
          <ChevronRight size={16} color={INK} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {["Sen","Sel","Rab","Kam","Jum","Sab","Min"].map((d) => (
          <div key={d} style={{ color: "#8A8360" }} className="text-center text-[10px] font-bold py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const isToday = dateStr === localDateStr();
          const isSel = dateStr === selectedDay;
          const evs = eventsByDay[dateStr] || [];
          return (
            <button
              key={i}
              onClick={() => setSelectedDay(dateStr)}
              className="rounded-xl flex flex-col items-center py-1.5"
              style={{ background: isSel ? INK : isToday ? "#FFEDE6" : "transparent" }}
            >
              <span style={{ color: isSel ? "#fff" : INK }} className="text-xs font-semibold">{d}</span>
              <div className="flex gap-0.5 mt-0.5" style={{ minHeight: 4 }}>
                {evs.slice(0, 3).map((e, idx) => {
                  const who = e.who === "all" ? null : data.children.find((c) => c.id === e.who);
                  return <div key={idx} style={{ width: 4, height: 4, borderRadius: 999, background: who ? who.color : (isSel ? GOLD : INK) }} />;
                })}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <p style={{ fontFamily: "'Baloo 2', sans-serif", color: INK }} className="font-bold text-sm">
            {new Date(selectedDay + "T00:00:00").getDate()} {MONTH_NAMES[new Date(selectedDay + "T00:00:00").getMonth()]}
          </p>
          <button onClick={onAddEvent} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-white" style={{ background: "#00B8A9" }}>
            <Plus size={13} /> Acara
          </button>
        </div>
        {selectedEvents.length === 0 ? (
          <p style={{ color: "#8A8360" }} className="text-xs px-1">Belum ada acara di hari ini.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {selectedEvents.map((e) => {
              const who = e.who === "all" ? null : data.children.find((c) => c.id === e.who);
              return (
                <div key={e.id} className="flex items-center gap-2 rounded-2xl px-3 py-2" style={{ background: "#FFFDF7" }}>
                  <div style={{ width: 8, height: 8, borderRadius: 999, background: who ? who.color : INK }} />
                  <div className="flex-1">
                    <p style={{ color: INK }} className="text-xs font-bold">{e.title}</p>
                    <p style={{ color: "#8A8360" }} className="text-[10px]">{e.time ? `${e.time} · ` : ""}{who ? who.name : "Semua Keluarga"}</p>
                  </div>
                  <button onClick={() => onEditEvent(e)} className="p-1.5 rounded-full" style={{ background: "#F1ECDB" }}>
                    <Pencil size={12} color={INK} />
                  </button>
                  <button onClick={() => onDeleteEvent(e.id)} className="p-1.5 rounded-full" style={{ background: "#F1ECDB" }}>
                    <Trash2 size={12} color={DANGER} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Settings ---------- */
function SettingsView({ data, accent, userEmail, onLogout, onAddChild, onEditChild, onDeleteChild, confirmDeleteChild, onConfirmDelete, onCancelDelete, newPin, setNewPin, pinSaved, onSavePin, periods, onUpdatePeriod, onAddPeriod, onDeletePeriod, onMovePeriod, settings, onToggleLeaderboard, onUpdateFamilyName, onOpenViolationSheet, onResolveViolation, location, locationStatus, onDetectLocation, onSetManualLocation }) {
  const [confirmDeletePeriod, setConfirmDeletePeriod] = useState(null);
  const [manualLoc, setManualLoc] = useState({ lat: location ? String(location.lat) : "", lon: location ? String(location.lon) : "" });
  const [familyNameDraft, setFamilyNameDraft] = useState(settings.familyName || "");
  return (
    <div>
      <h1 style={{ fontFamily: "'Baloo 2', sans-serif", color: INK }} className="text-xl font-extrabold pt-2 pb-3">Pengaturan</h1>

      <p style={{ fontFamily: "'Baloo 2', sans-serif", color: INK }} className="font-bold text-sm mb-1">Nama Keluarga</p>
      <p style={{ color: "#8A8360" }} className="text-[11px] mb-2">Tampil sebagai identitas di halaman Beranda.</p>
      <div className="rounded-2xl p-3 mb-6 flex items-center gap-2" style={{ background: "#FFFDF7" }}>
        <input
          value={familyNameDraft}
          onChange={(e) => setFamilyNameDraft(e.target.value)}
          onBlur={() => onUpdateFamilyName(familyNameDraft.trim())}
          placeholder="misal: Keluarga Nugraha"
          className="flex-1 min-w-0 rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: "#F1ECDB", color: INK }}
        />
      </div>

      <p style={{ fontFamily: "'Baloo 2', sans-serif", color: INK }} className="font-bold text-sm mb-1">Akun</p>
      <div className="rounded-2xl p-3 mb-6 flex items-center gap-2" style={{ background: "#FFFDF7" }}>
        <div className="flex-1 min-w-0">
          <p style={{ color: "#8A8360" }} className="text-[10px]">Masuk sebagai</p>
          <p style={{ color: INK }} className="text-xs font-semibold truncate">{userEmail}</p>
        </div>
        <button
          onClick={onLogout}
          className="shrink-0 rounded-full px-3 py-1.5 text-xs font-bold"
          style={{ background: "#FDECEA", color: DANGER }}
        >
          Keluar
        </button>
      </div>

      <p style={{ fontFamily: "'Baloo 2', sans-serif", color: INK }} className="font-bold text-sm mb-1">Lokasi untuk Jadwal Shalat</p>
      <p style={{ color: "#8A8360" }} className="text-[11px] mb-2">Dipakai untuk menghitung jadwal shalat di beranda (dihitung sendiri, tidak perlu internet).</p>
      <div className="rounded-2xl p-3 mb-6" style={{ background: "#FFFDF7" }}>
        {location ? (
          <p style={{ color: INK }} className="text-xs font-semibold mb-2">📍 Lokasi tersimpan: {location.lat.toFixed(3)}, {location.lon.toFixed(3)}</p>
        ) : (
          <p style={{ color: "#8A8360" }} className="text-xs mb-2">Lokasi belum diatur.</p>
        )}
        {locationStatus === "error" && (
          <p style={{ color: DANGER }} className="text-[11px] mb-2">Deteksi otomatis gagal (izin lokasi ditolak/tidak didukung). Isi lintang & bujur manual di bawah.</p>
        )}
        <button
          onClick={onDetectLocation}
          disabled={locationStatus === "locating"}
          className="w-full rounded-xl py-2 text-xs font-bold text-white mb-2"
          style={{ background: locationStatus === "locating" ? "#C9BE93" : "#00B8A9" }}
        >
          {locationStatus === "locating" ? "Mendeteksi…" : "📍 Deteksi Lokasi Otomatis"}
        </button>
        <div className="flex gap-2">
          <input
            value={manualLoc.lat}
            onChange={(e) => setManualLoc({ ...manualLoc, lat: e.target.value })}
            placeholder="Lintang (misal -6.20)"
            inputMode="decimal"
            className="flex-1 rounded-xl px-2.5 py-1.5 text-xs outline-none"
            style={{ background: "#F1ECDB", color: INK }}
          />
          <input
            value={manualLoc.lon}
            onChange={(e) => setManualLoc({ ...manualLoc, lon: e.target.value })}
            placeholder="Bujur (misal 106.84)"
            inputMode="decimal"
            className="flex-1 rounded-xl px-2.5 py-1.5 text-xs outline-none"
            style={{ background: "#F1ECDB", color: INK }}
          />
          <button
            onClick={() => {
              const lat = parseFloat(manualLoc.lat), lon = parseFloat(manualLoc.lon);
              if (!isNaN(lat) && !isNaN(lon)) onSetManualLocation(lat, lon);
            }}
            className="rounded-xl px-3 text-xs font-bold text-white shrink-0"
            style={{ background: INK }}
          >
            Simpan
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <p style={{ fontFamily: "'Baloo 2', sans-serif", color: INK }} className="font-bold text-sm">Kelola Anak</p>
        <button onClick={onAddChild} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-white" style={{ background: accent }}>
          <Plus size={13} /> Anak
        </button>
      </div>
      <div className="flex flex-col gap-2 mb-6">
        {data.children.length === 0 && <p style={{ color: "#8A8360" }} className="text-xs">Belum ada data anak.</p>}
        {data.children.map((c) => (
          <div key={c.id} className="rounded-2xl px-3 py-2" style={{ background: "#FFFDF7" }}>
            {confirmDeleteChild && confirmDeleteChild.id === c.id ? (
              <div className="flex items-center justify-between">
                <span style={{ color: DANGER }} className="text-xs font-bold">Hapus {c.name}?</span>
                <div className="flex gap-2">
                  <button onClick={onCancelDelete} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "#F1ECDB", color: INK }}>Batal</button>
                  <button onClick={onConfirmDelete} className="text-xs font-semibold px-2.5 py-1 rounded-full text-white" style={{ background: DANGER }}>Hapus</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Avatar emoji={c.emoji} color={c.color} size={32} />
                <span style={{ color: INK }} className="text-sm font-bold flex-1">{c.name}</span>
                <button onClick={() => onEditChild(c)} className="p-1.5 rounded-full" style={{ background: "#F1ECDB" }}>
                  <Pencil size={12} color={INK} />
                </button>
                <button onClick={() => onDeleteChild(c)} className="p-1.5 rounded-full" style={{ background: "#F1ECDB" }}>
                  <Trash2 size={12} color={DANGER} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-2xl px-3 py-3 mb-6" style={{ background: "#FFFDF7" }}>
        <div>
          <p style={{ fontFamily: "'Baloo 2', sans-serif", color: INK }} className="font-bold text-sm">Mode Kompetisi Antar Saudara</p>
          <p style={{ color: "#8A8360" }} className="text-[10px] mt-0.5">Tampilkan papan peringkat mingguan di beranda</p>
        </div>
        <button
          onClick={onToggleLeaderboard}
          className="rounded-full px-3 py-1.5 text-xs font-bold shrink-0"
          style={{ background: settings.leaderboardEnabled ? "#00B8A9" : "#EFEAD8", color: settings.leaderboardEnabled ? "#fff" : "#8A8360" }}
        >
          {settings.leaderboardEnabled ? "Aktif" : "Nonaktif"}
        </button>
      </div>

      <p style={{ fontFamily: "'Baloo 2', sans-serif", color: INK }} className="font-bold text-sm mb-1">Kategori Waktu</p>
      <p style={{ color: "#8A8360" }} className="text-[11px] mb-2">Atur nama, warna, dan rentang jam tiap kategori untuk mengelompokkan tugas harian.</p>
      <div className="flex flex-col gap-2 mb-3">
        {periods.map((period, idx) => (
          <div key={period.key} className="rounded-2xl p-3" style={{ background: "#FFFDF7" }}>
            {confirmDeletePeriod === period.key ? (
              <div className="flex items-center justify-between">
                <span style={{ color: DANGER }} className="text-xs font-bold">Hapus "{period.label}"? Tugasnya pindah ke kategori pertama.</span>
                <div className="flex gap-2 shrink-0 ml-2">
                  <button onClick={() => setConfirmDeletePeriod(null)} className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "#F1ECDB", color: INK }}>Batal</button>
                  <button onClick={() => { onDeletePeriod(period.key); setConfirmDeletePeriod(null); }} className="text-xs font-semibold px-2.5 py-1 rounded-full text-white" style={{ background: DANGER }}>Hapus</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex flex-wrap gap-1 shrink-0" style={{ maxWidth: 108 }}>
                    {["🌅", "🌤️", "🌙", "⭐", "📚", "🏠", "🍽️", "🧹"].map((em) => (
                      <button key={em} onClick={() => onUpdatePeriod(period.key, { emoji: em })} className="rounded-full flex items-center justify-center" style={{ width: 22, height: 22, background: period.emoji === em ? period.color : "#F1ECDB", fontSize: 12 }}>{em}</button>
                    ))}
                  </div>
                  <input
                    value={period.label}
                    onChange={(e) => onUpdatePeriod(period.key, { label: e.target.value })}
                    className="flex-1 min-w-0 rounded-xl px-2.5 py-1.5 text-xs font-bold outline-none"
                    style={{ background: "#F1ECDB", color: INK }}
                  />
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <button onClick={() => onMovePeriod(period.key, -1)} disabled={idx === 0} className="rounded-md flex items-center justify-center" style={{ width: 18, height: 14, background: "#F1ECDB", opacity: idx === 0 ? 0.35 : 1 }}>
                      <ChevronUp size={11} color={INK} />
                    </button>
                    <button onClick={() => onMovePeriod(period.key, 1)} disabled={idx === periods.length - 1} className="rounded-md flex items-center justify-center" style={{ width: 18, height: 14, background: "#F1ECDB", opacity: idx === periods.length - 1 ? 0.35 : 1 }}>
                      <ChevronDown size={11} color={INK} />
                    </button>
                  </div>
                  <button onClick={() => setConfirmDeletePeriod(period.key)} disabled={periods.length <= 1} className="p-1.5 rounded-full shrink-0" style={{ background: "#F1ECDB", opacity: periods.length <= 1 ? 0.35 : 1 }}>
                    <Trash2 size={12} color={DANGER} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex flex-wrap gap-1 shrink-0">
                    {NEW_PERIOD_COLORS.map((c) => (
                      <button key={c} onClick={() => onUpdatePeriod(period.key, { color: c })} className="rounded-full" style={{ width: 16, height: 16, background: c, border: period.color === c ? `2px solid ${INK}` : "2px solid transparent" }} />
                    ))}
                  </div>
                  <input
                    type="time"
                    value={period.start}
                    onChange={(e) => onUpdatePeriod(period.key, { start: e.target.value })}
                    className="rounded-xl px-2 py-1.5 text-xs outline-none"
                    style={{ background: "#F1ECDB", color: INK, width: 84 }}
                  />
                  <span style={{ color: "#8A8360" }} className="text-xs">–</span>
                  <input
                    type="time"
                    value={period.end}
                    onChange={(e) => onUpdatePeriod(period.key, { end: e.target.value })}
                    className="rounded-xl px-2 py-1.5 text-xs outline-none"
                    style={{ background: "#F1ECDB", color: INK, width: 84 }}
                  />
                </div>
              </>
            )}
          </div>
        ))}
      </div>
      <button onClick={onAddPeriod} className="flex items-center justify-center gap-1 w-full rounded-2xl py-2.5 text-xs font-bold mb-6" style={{ border: "2px dashed #C9BE93", color: "#8A8360" }}>
        <Plus size={14} /> Tambah Kategori Waktu
      </button>

      <p style={{ fontFamily: "'Baloo 2', sans-serif", color: INK }} className="font-bold text-sm mb-2">Ubah PIN Orang Tua</p>
      <div className="rounded-2xl p-3 flex flex-col gap-2" style={{ background: "#FFFDF7" }}>
        <input
          value={newPin.a}
          onChange={(e) => setNewPin({ ...newPin, a: e.target.value.replace(/\D/g, "").slice(0, 4) })}
          placeholder="PIN baru (4 digit)"
          inputMode="numeric"
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: "#F1ECDB", color: INK }}
        />
        <input
          value={newPin.b}
          onChange={(e) => setNewPin({ ...newPin, b: e.target.value.replace(/\D/g, "").slice(0, 4) })}
          placeholder="Ulangi PIN baru"
          inputMode="numeric"
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: "#F1ECDB", color: INK }}
        />
        {newPin.a.length === 4 && newPin.a !== newPin.b && <p style={{ color: DANGER }} className="text-[11px]">PIN tidak sama</p>}
        {pinSaved && <p style={{ color: "#00B8A9" }} className="text-[11px] font-semibold">PIN berhasil diperbarui ✓</p>}
        <button
          onClick={onSavePin}
          disabled={!(newPin.a.length === 4 && newPin.a === newPin.b)}
          className="rounded-xl py-2 text-sm font-bold text-white mt-1"
          style={{ background: newPin.a.length === 4 && newPin.a === newPin.b ? INK : "#C9BE93" }}
        >
          Simpan PIN
        </button>
      </div>

      <div className="flex items-center justify-between mt-6 mb-2">
        <p style={{ fontFamily: "'Baloo 2', sans-serif", color: INK }} className="font-bold text-sm">Catatan Perilaku</p>
        <button onClick={onOpenViolationSheet} disabled={data.children.length === 0} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold text-white" style={{ background: data.children.length === 0 ? "#C9BE93" : DANGER }}>
          <Plus size={13} /> Catat
        </button>
      </div>
      <p style={{ color: "#8A8360" }} className="text-[11px] mb-2">Mencatat pelanggaran (misal berbohong) dan mengurangi sebagian poin hari ini & minggu ini secara manual.</p>
      <div className="flex flex-col gap-2">
        {data.children.flatMap((c) => (c.violations || []).map((v) => ({ ...v, child: c }))).length === 0 && (
          <p style={{ color: "#8A8360" }} className="text-xs">Belum ada catatan.</p>
        )}
        {data.children
          .flatMap((c) => (c.violations || []).map((v) => ({ ...v, child: c })))
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((v) => (
            <div key={v.id} className="rounded-2xl px-3 py-2.5" style={{ background: "#FFFDF7" }}>
              <div className="flex items-center gap-2">
                <Avatar emoji={v.child.emoji} color={v.child.color} size={26} />
                <div className="flex-1 min-w-0">
                  <p style={{ color: INK }} className="text-xs font-bold truncate">{v.note}</p>
                  <p style={{ color: "#8A8360" }} className="text-[10px]">{v.child.name} · {v.date} · -{v.points} poin{v.resolved ? ` · +${v.refund} dikembalikan` : ""}</p>
                </div>
                {v.resolved ? (
                  <span style={{ color: "#00B8A9" }} className="text-[10px] font-bold shrink-0">Selesai ✓</span>
                ) : (
                  <button onClick={() => onResolveViolation(v.child.id, v.id)} className="text-[10px] font-bold px-2.5 py-1.5 rounded-full text-white shrink-0" style={{ background: "#00B8A9" }}>
                    Sudah Minta Maaf
                  </button>
                )}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

/* ---------- Draggable Task Row ---------- */
function TaskEditRow({ task, meta, isDragging, dragOffset, onDragStart, onDragMove, onDragEnd, onToggleActive, onRemove, expanded, onToggleExpand, onUpdateField }) {
  return (
    <div>
      <div
        className="flex items-center gap-2 rounded-xl px-2 py-2"
        style={{
          background: isDragging ? "#FFFDF7" : "#F8F4E4",
          transform: isDragging ? `translateY(${dragOffset}px) scale(1.02)` : "none",
          boxShadow: isDragging ? "0 6px 14px rgba(27,37,89,0.25)" : "none",
          position: "relative",
          zIndex: isDragging ? 10 : 1,
        }}
      >
        <div
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); onDragStart(e.clientY); }}
          onPointerMove={(e) => { if (isDragging) onDragMove(e.clientY); }}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          style={{ touchAction: "none", cursor: "grab", color: "#B8AF8F" }}
          className="px-0.5 shrink-0"
        >
          <GripVertical size={15} />
        </div>
        <span style={{ fontSize: 14 }} className="shrink-0">{task.emoji}</span>
        <span style={{ color: task.active === false ? "#B8AF8F" : INK }} className="text-xs font-semibold flex-1 truncate">{task.label}</span>
        <button onClick={onToggleActive} className="rounded-full flex items-center justify-center shrink-0" style={{ width: 22, height: 22, background: task.active === false ? "#EFEAD8" : meta.color }}>
          {task.active !== false && <Check size={12} color="#fff" strokeWidth={3} />}
        </button>
        {onRemove && (
          <button onClick={onRemove} className="shrink-0">
            <X size={13} color={DANGER} />
          </button>
        )}
        <button onClick={onToggleExpand} className="shrink-0" style={{ color: "#B8AF8F" }}>
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>
      {expanded && (
        <div className="mt-1 ml-6 p-2 rounded-xl flex flex-col gap-2" style={{ background: "#F1ECDB" }}>
          <div className="flex items-center justify-between">
            <span style={{ color: INK }} className="text-[11px] font-semibold">📷 Perlu foto bukti?</span>
            <button
              onClick={() => onUpdateField({ needsPhoto: !task.needsPhoto })}
              className="rounded-full px-2.5 py-1 text-[10px] font-bold"
              style={{ background: task.needsPhoto ? "#00B8A9" : "#EFEAD8", color: task.needsPhoto ? "#fff" : "#8A8360" }}
            >
              {task.needsPhoto ? "Ya" : "Tidak"}
            </button>
          </div>
          <textarea
            value={task.why || ""}
            onChange={(e) => onUpdateField({ why: e.target.value })}
            placeholder="Kenapa tugas ini penting? (opsional, muncul sebagai info untuk anak)"
            rows={2}
            className="rounded-lg px-2 py-1.5 text-[11px] outline-none resize-none"
            style={{ background: "#FFFDF7", color: INK }}
          />
        </div>
      )}
    </div>
  );
}

/* ---------- Child Edit Sheet ---------- */
function ChildEditSheet({ initial, siblingCount, periods, accent, onClose, onSave, onApplyAll, newTaskDraft, setNewTaskDraft }) {
  const isNew = !initial;
  const [form, setForm] = useState(() => {
    if (initial) return initial;
    const initialTasks = cloneTemplate();
    return {
      id: genId(),
      name: "",
      emoji: AVATAR_EMOJIS[0],
      color: AVATAR_COLORS[0],
      tasks: initialTasks,
      points: 0,
      weeklyPoints: 0,
      weeklyGoal: 500,
      weeklyReward: "",
      rewardClaimed: false,
      streak: 0,
      bestStreak: 0,
      totalPoints: 0,
      history: {},
      bonusTaskId: pickBonusTask(initialTasks),
      violations: [],
    };
  });

  const toggleActive = (id) => setForm((f) => ({ ...f, tasks: f.tasks.map((t) => (t.id === id ? { ...t, active: t.active === false ? true : false } : t)) }));
  const removeCustom = (id) => setForm((f) => ({ ...f, tasks: f.tasks.filter((t) => t.id !== id) }));
  const updateTaskField = (id, patch) => setForm((f) => ({ ...f, tasks: f.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  const [expandedTaskId, setExpandedTaskId] = useState(null);
  const addCustom = () => {
    if (!newTaskDraft.label.trim()) return;
    setForm((f) => ({ ...f, tasks: [...f.tasks, { id: genId(), label: newTaskDraft.label.trim(), time: newTaskDraft.time, emoji: "📌", active: true, done: false, doneAt: null, earnedPoints: 0, custom: true, needsPhoto: false, photo: null, why: "" }] }));
    setNewTaskDraft({ label: "", time: "subuh" });
  };

  const [dragState, setDragState] = useState(null);
  const startDrag = (id, time, clientY) => {
    const order = form.tasks.filter((t) => t.time === time).map((t) => t.id);
    setDragState({ id, time, startY: clientY, offsetY: 0, order });
  };
  const moveDrag = (clientY) => {
    setDragState((ds) => (ds ? { ...ds, offsetY: clientY - ds.startY } : ds));
  };
  const endDrag = () => {
    setDragState((ds) => {
      if (!ds) return null;
      const steps = Math.round(ds.offsetY / DRAG_ROW_HEIGHT);
      if (steps !== 0) {
        const fromIdx = ds.order.indexOf(ds.id);
        const toIdx = Math.max(0, Math.min(ds.order.length - 1, fromIdx + steps));
        if (toIdx !== fromIdx) {
          setForm((f) => ({ ...f, tasks: reorderWithinGroup(f.tasks, ds.time, ds.id, toIdx) }));
        }
      }
      return null;
    });
  };

  return (
    <Sheet title={isNew ? "Tambah Anak" : "Edit Data Anak"} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <label style={{ color: "#8A8360" }} className="text-xs font-semibold">Nama</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nama anak"
            className="w-full mt-1 rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: "#F1ECDB", color: INK }}
          />
        </div>

        <div>
          <label style={{ color: "#8A8360" }} className="text-xs font-semibold">Avatar</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {AVATAR_EMOJIS.map((em) => (
              <button key={em} onClick={() => setForm({ ...form, emoji: em })} className="rounded-full flex items-center justify-center" style={{ width: 34, height: 34, background: form.emoji === em ? form.color : "#F1ECDB", fontSize: 16 }}>{em}</button>
            ))}
          </div>
        </div>

        <div>
          <label style={{ color: "#8A8360" }} className="text-xs font-semibold">Warna</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {AVATAR_COLORS.map((c) => (
              <button key={c} onClick={() => setForm({ ...form, color: c })} className="rounded-full" style={{ width: 26, height: 26, background: c, border: form.color === c ? `3px solid ${INK}` : "3px solid transparent" }} />
            ))}
          </div>
        </div>

        <div>
          <label style={{ color: "#8A8360" }} className="text-xs font-semibold">Target Poin Mingguan & Hadiah</label>
          <div className="flex gap-2 mt-1">
            <input
              type="number"
              value={form.weeklyGoal}
              onChange={(e) => setForm({ ...form, weeklyGoal: Number(e.target.value) || 0 })}
              className="w-24 rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: "#F1ECDB", color: INK }}
            />
            <input
              value={form.weeklyReward}
              onChange={(e) => setForm({ ...form, weeklyReward: e.target.value })}
              placeholder="misal: Es krim & nonton bareng"
              className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
              style={{ background: "#F1ECDB", color: INK }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label style={{ color: "#8A8360" }} className="text-xs font-semibold">Daftar Tugas Harian</label>
            {!isNew && siblingCount > 1 && (
              <button onClick={() => onApplyAll(form.id)} className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white" style={{ background: "#00B8A9" }}>
                Terapkan ke Semua Anak
              </button>
            )}
          </div>
          <p style={{ color: "#8A8360" }} className="text-[10px] mt-1 mb-2">Tahan ikon ⠿ lalu geser untuk mengubah urutan tugas.</p>
          {periods.map((period) => {
            const time = period.key;
            const groupTasks = form.tasks.filter((t) => t.time === time);
            if (groupTasks.length === 0) return null;
            return (
              <div key={time} className="mb-3">
                <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
                  <span style={{ fontSize: 12 }}>{period.emoji}</span>
                  <span style={{ color: period.color }} className="text-[11px] font-bold">{period.label}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {groupTasks.map((t) => (
                    <TaskEditRow
                      key={t.id}
                      task={t}
                      meta={period}
                      isDragging={!!(dragState && dragState.id === t.id)}
                      dragOffset={dragState && dragState.id === t.id ? dragState.offsetY : 0}
                      onDragStart={(clientY) => startDrag(t.id, time, clientY)}
                      onDragMove={moveDrag}
                      onDragEnd={endDrag}
                      onToggleActive={() => toggleActive(t.id)}
                      onRemove={t.custom ? () => removeCustom(t.id) : null}
                      expanded={expandedTaskId === t.id}
                      onToggleExpand={() => setExpandedTaskId((id) => (id === t.id ? null : t.id))}
                      onUpdateField={(patch) => updateTaskField(t.id, patch)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
          <div className="flex gap-2 mt-2">
            <input
              value={newTaskDraft.label}
              onChange={(e) => setNewTaskDraft({ ...newTaskDraft, label: e.target.value })}
              placeholder="Tambah tugas baru"
              className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
              style={{ background: "#F1ECDB", color: INK }}
            />
            <select
              value={newTaskDraft.time}
              onChange={(e) => setNewTaskDraft({ ...newTaskDraft, time: e.target.value })}
              className="rounded-xl px-2 text-xs outline-none"
              style={{ background: "#F1ECDB", color: INK }}
            >
              {periods.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
            <button onClick={addCustom} className="rounded-xl px-3 text-white font-bold text-xs" style={{ background: INK }}>+</button>
          </div>
        </div>

        <button
          onClick={() => form.name.trim() && onSave(form)}
          disabled={!form.name.trim()}
          className="rounded-xl py-3 text-sm font-bold text-white mt-1"
          style={{ background: form.name.trim() ? accent : "#C9BE93" }}
        >
          Simpan
        </button>
      </div>
    </Sheet>
  );
}

/* ---------- Notification Banner ---------- */
function NotificationBanner({ event, data, onDismiss }) {
  const who = event.who === "all" ? null : data.children.find((c) => c.id === event.who);
  const eventDT = new Date(`${event.date}T${event.time}:00`);
  const minsLeft = Math.max(0, Math.round((eventDT.getTime() - Date.now()) / 60000));
  const untilText = minsLeft >= 60 ? `${Math.round(minsLeft / 60)} jam lagi` : `${minsLeft} menit lagi`;
  return (
    <div className="absolute top-0 left-0 right-0 z-50 px-3 pt-3 pop-in">
      <div className="rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: INK, boxShadow: "0 8px 20px rgba(27,37,89,0.4)" }}>
        <div className="rounded-full flex items-center justify-center shrink-0" style={{ width: 34, height: 34, background: GOLD }}>
          <Bell size={16} color={INK} />
        </div>
        <div className="flex-1 min-w-0">
          <p style={{ color: "#fff", fontFamily: "'Baloo 2', sans-serif" }} className="text-sm font-bold truncate">{event.title}</p>
          <p style={{ color: "#C9D2F0" }} className="text-[11px]">
            {untilText}{who ? ` · ${who.name}` : " · Semua Keluarga"}{event.time ? ` · ${event.time}` : ""}
          </p>
        </div>
        <button onClick={onDismiss} className="p-1.5 rounded-full shrink-0" style={{ background: "rgba(255,255,255,0.15)" }}>
          <X size={14} color="#fff" />
        </button>
      </div>
    </div>
  );
}

/* ---------- Violation Sheet ---------- */
function ViolationSheet({ children, value, setValue, onClose, onSave }) {
  const canSave = value.childId && value.note.trim() && value.points > 0;
  return (
    <Sheet title="Catat Pelanggaran" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <label style={{ color: "#8A8360" }} className="text-xs font-semibold">Anak</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {children.map((c) => (
              <button
                key={c.id}
                onClick={() => setValue({ ...value, childId: c.id })}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ background: value.childId === c.id ? c.color : "#F1ECDB", color: value.childId === c.id ? "#fff" : INK }}
              >
                {c.emoji} {c.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ color: "#8A8360" }} className="text-xs font-semibold">Catatan Pelanggaran</label>
          <textarea
            value={value.note}
            onChange={(e) => setValue({ ...value, note: e.target.value })}
            placeholder="misal: Berbohong soal PR sekolah"
            rows={3}
            className="w-full mt-1 rounded-xl px-3 py-2 text-sm outline-none resize-none"
            style={{ background: "#F1ECDB", color: INK }}
          />
        </div>
        <div>
          <label style={{ color: "#8A8360" }} className="text-xs font-semibold">Poin Dikurangi</label>
          <input
            type="number"
            value={value.points}
            onChange={(e) => setValue({ ...value, points: Number(e.target.value) || 0 })}
            className="w-24 mt-1 rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: "#F1ECDB", color: INK }}
          />
          <p style={{ color: "#8A8360" }} className="text-[10px] mt-1">Memotong poin hari ini & poin minggu ini. Poin total (maskot) tidak berubah.</p>
        </div>
        <button onClick={onSave} disabled={!canSave} className="rounded-xl py-3 text-sm font-bold text-white mt-1" style={{ background: canSave ? DANGER : "#C9BE93" }}>
          Simpan Catatan
        </button>
      </div>
    </Sheet>
  );
}

/* ---------- Event Sheet ---------- */
function EventSheet({ day, children, value, setValue, isEditing, onClose, onSave }) {
  const d = new Date(day + "T00:00:00");
  return (
    <Sheet title={isEditing ? "Edit Acara" : `Tambah Acara · ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <label style={{ color: "#8A8360" }} className="text-xs font-semibold">Judul Acara</label>
          <input
            value={value.title}
            onChange={(e) => setValue({ ...value, title: e.target.value })}
            placeholder="misal: Ulang tahun Kakak"
            className="w-full mt-1 rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: "#F1ECDB", color: INK }}
          />
        </div>
        <div>
          <label style={{ color: "#8A8360" }} className="text-xs font-semibold">Jam Acara (opsional)</label>
          <input
            type="time"
            value={value.time}
            onChange={(e) => setValue({ ...value, time: e.target.value })}
            className="w-full mt-1 rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: "#F1ECDB", color: INK }}
          />
        </div>
        <div>
          <label style={{ color: "#8A8360" }} className="text-xs font-semibold">Pengingat</label>
          <select
            value={value.reminderMinutes}
            onChange={(e) => setValue({ ...value, reminderMinutes: Number(e.target.value) })}
            disabled={!value.time}
            className="w-full mt-1 rounded-xl px-3 py-2 text-sm outline-none"
            style={{ background: "#F1ECDB", color: INK, opacity: value.time ? 1 : 0.5 }}
          >
            <option value={0}>Tidak ada</option>
            <option value={15}>15 menit sebelum</option>
            <option value={30}>30 menit sebelum</option>
            <option value={60}>1 jam sebelum</option>
            <option value={180}>3 jam sebelum</option>
            <option value={1440}>1 hari sebelum</option>
          </select>
          {!value.time && (
            <p style={{ color: "#8A8360" }} className="text-[10px] mt-1">Isi jam acara dulu untuk mengatur pengingat.</p>
          )}
        </div>
        <div>
          <label style={{ color: "#8A8360" }} className="text-xs font-semibold">Untuk Siapa</label>
          <div className="flex flex-wrap gap-2 mt-1">
            <button onClick={() => setValue({ ...value, who: "all" })} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: value.who === "all" ? INK : "#F1ECDB", color: value.who === "all" ? "#fff" : INK }}>
              <Users size={12} /> Semua Keluarga
            </button>
            {children.map((c) => (
              <button key={c.id} onClick={() => setValue({ ...value, who: c.id })} className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold" style={{ background: value.who === c.id ? c.color : "#F1ECDB", color: value.who === c.id ? "#fff" : INK }}>
                {c.emoji} {c.name}
              </button>
            ))}
          </div>
        </div>
        <button onClick={onSave} disabled={!value.title.trim()} className="rounded-xl py-3 text-sm font-bold text-white mt-1" style={{ background: value.title.trim() ? "#00B8A9" : "#C9BE93" }}>
          {isEditing ? "Simpan Perubahan" : "Simpan Acara"}
        </button>
      </div>
    </Sheet>
  );
}
