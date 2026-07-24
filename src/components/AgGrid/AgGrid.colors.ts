export const DEFAULT_COLOR_PRIMARY = '#2B5797';
export const DEFAULT_COLOR_DANGER = '#EC7B80';
export const DEFAULT_COLOR_ACCENT = '#6B8AD4';
const COLOR_PRIMARY_HOVER_DARKEN_PERCENT = 18;
const COLOR_WASH_PERCENT = 20;

// color-mix() resolves any valid CSS color — hex, rgb(a), named, or a var() reference —
// natively in the browser, so it works even when a color prop is itself a theme variable.
export function washColor(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

export function darkenColor(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${100 - percent}%, black)`;
}

export interface AgGridColors {
  primary: string;
  primaryHover: string;
  accent: string;
  accentWash: string;
  danger: string;
  dangerWash: string;
  info: string;
}

export function resolveAgGridColors(
  colorPrimary?: string,
  colorDanger?: string,
  colorAccent?: string,
  colorDangerWash?: string,
): AgGridColors {
  const primary = colorPrimary || DEFAULT_COLOR_PRIMARY;
  const danger = colorDanger || DEFAULT_COLOR_DANGER;
  const accent = colorAccent || DEFAULT_COLOR_ACCENT;
  return {
    primary,
    primaryHover: darkenColor(primary, COLOR_PRIMARY_HOVER_DARKEN_PERCENT),
    accent,
    accentWash: washColor(accent, COLOR_WASH_PERCENT),
    danger,
    dangerWash: colorDangerWash || washColor(danger, COLOR_WASH_PERCENT),
    info: primary,
  };
}
