/**
 * Single source of truth for the app's two supported display modes.
 *
 * The visual palette is intentionally fixed to the ADOLF v3.0 identity:
 *   dark  → #050506 → #021330 background, #73F3FF foreground/accent
 *   light → #C1FAFF → #FFFFFF background, #050506 foreground/accent
 *
 * There is no user-selectable accent/theme catalog. Light/dark is the
 * only appearance control and is exposed in the global top-right header.
 */

export const MODES = ["light", "dark"] as const;

export type Mode = (typeof MODES)[number];

export const DEFAULT_MODE: Mode = "dark";

export const MODE_STORAGE_KEY = "wacrm.mode";

export function isMode(value: unknown): value is Mode {
  return (
    typeof value === "string" &&
    (MODES as ReadonlyArray<string>).includes(value)
  );
}
