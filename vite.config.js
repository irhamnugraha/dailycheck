import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: base must match your GitHub repo name for Project Pages,
// e.g. if your repo is github.com/you/family-routine-checklist then
// the site is served from https://you.github.io/family-routine-checklist/
// and base must be "/family-routine-checklist/".
// If you deploy to a User/Org Pages repo (named you.github.io), set base to "/".
export default defineConfig({
  plugins: [react()],
  base: "/family-routine-checklist/",
});
