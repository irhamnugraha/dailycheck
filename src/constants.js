// Shared between App.jsx (period editor defaults / new-period button) and
// dataStore.js (seeds a fresh install whose `periods` table is still empty).
export const DEFAULT_PERIODS = [
  { key: "tengah-malam", label: "Tengah Malam", emoji: "🌌", color: "#5B6EE1", start: "00:00", end: "04:00" },
  { key: "subuh", label: "Subuh", emoji: "🌅", color: "#4A90E2", start: "04:00", end: "06:00" },
  { key: "pagi", label: "Pagi", emoji: "🌤️", color: "#FF9F45", start: "06:00", end: "12:00" },
  { key: "siang", label: "Siang & Sore", emoji: "🌇", color: "#00B8A9", start: "12:00", end: "18:00" },
  { key: "magrib", label: "Magrib", emoji: "🕌", color: "#FF6FA5", start: "18:00", end: "19:30" },
  { key: "malam", label: "Malam", emoji: "🌙", color: "#7B5EA7", start: "19:30", end: "00:00" },
];
