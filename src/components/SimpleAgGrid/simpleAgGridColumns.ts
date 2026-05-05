import type { ISimpleColumn } from './SimpleAgGrid.config';

/**
 * Stable AG Grid `field` / row-data key: prefer trimmed `source`, else string `title`,
 * else synthetic id — same idea as full AgGrid `agGridColumnField`, but safe when
 * `title` is an i18n object.
 */
export function simpleAgGridRowField(col: Pick<ISimpleColumn, 'id' | 'title' | 'source'>): string {
  const s = typeof col.source === 'string' ? col.source.trim() : '';
  if (s) {
    // AG Grid treats dots in `field` as deep references unless suppressed.
    // We keep `source` as-is (for get() / payload keys), but use a safe key for row objects.
    return s.replace(/\./g, '__');
  }
  const t = col.title as unknown;
  if (typeof t === 'string' && t.trim()) return t.trim();
  return col.id ? `__col_${col.id}` : '__col';
}

function pickEntryString(
  entry: Record<string, unknown> | undefined,
  lang: string | undefined,
): string | undefined {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return undefined;
  if (lang) {
    const v = entry[lang];
    if (typeof v === 'string' && v !== '') return v;
  }
  const d = entry.default;
  return typeof d === 'string' && d !== '' ? d : undefined;
}

/**
 * Resolved header label for Studio i18n field (`ESetting.I18NFIELD`) or plain string title.
 */
export function resolveSimpleColumnTitle(
  title: unknown,
  i18n: { keys?: Record<string, Record<string, unknown>> } | null | undefined,
  lang: string | undefined,
): string {
  if (title == null || title === '') return '';
  if (typeof title === 'string') {
    const entry = i18n?.keys?.[title] as Record<string, unknown> | undefined;
    const fromKeys = pickEntryString(entry, lang);
    return fromKeys ?? title;
  }
  if (typeof title === 'object' && !Array.isArray(title)) {
    const o = title as Record<string, unknown>;
    if (typeof o.key === 'string') {
      const entry = i18n?.keys?.[o.key] as Record<string, unknown> | undefined;
      const fromKeys = pickEntryString(entry, lang);
      if (fromKeys) return fromKeys;
      if (typeof o.default === 'string') return o.default;
      return o.key;
    }
    if (typeof o.default === 'string') return o.default;
    if (typeof o.defaultValue === 'string') return o.defaultValue;
  }
  if (typeof title === 'number' || typeof title === 'boolean') return String(title);
  return '';
}
