/**
 * Single source of truth for app branding. Change the name here — it flows
 * into the UI header, Settings "About" panel, and export file names.
 * (The PWA manifest name/short_name live in vite.config.ts and must be
 * updated separately since the manifest is generated at build time.)
 */
export const APP_CONFIG = {
  name: 'Momentum',
  fullName: 'Momentum — Goals & Habits',
  tagline: 'Calm, focused progress — one week at a time.',
  version: '1.0.0',
  schemaVersion: 1,
} as const
