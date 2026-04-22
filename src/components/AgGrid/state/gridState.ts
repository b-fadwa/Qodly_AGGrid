import type { GridApi, SortModelItem } from 'ag-grid-community';
import isEqual from 'lodash/isEqual';
import type { IColumn } from '../AgGrid.config';
import type { SavedRecord, SavedRecordBase } from './types';

/** Synthetic row index column — excluded from Columns config and persisted grid state. */
export const ROW_NUMBER_COL_ID = '__qodlyRowNumber';

/**
 * Stable AG Grid `field` / `colId`: datasource attribute `source`.
 * Row objects use this key; `title` stays free to change with i18n without breaking cell values.
 */
export function agGridColumnField(col: Pick<IColumn, 'title' | 'source'>): string {
  const s = typeof col.source === 'string' ? col.source.trim() : '';
  return s || col.title;
}

export function withoutSyntheticRowColumnState(
  columnState: any[] | undefined | null,
): any[] {
  if (!Array.isArray(columnState)) return [];
  return columnState.filter((s) => s && s.colId !== ROW_NUMBER_COL_ID);
}

/**
 * Columns whose `title` or `source` is exactly "id" (case-insensitive — so
 * "ID", "Id", "iD" all match) are treated as internal: they still render in
 * the grid (the data is needed) but they are hidden from every "manage"
 * surface (column visibility dialog, sortable columns dropdown, advanced
 * filter column picker).
 */
export function isHiddenIdColumn(
  col: Pick<IColumn, 'title' | 'source'> | null | undefined,
): boolean {
  if (!col) return false;
  const t = typeof col.title === 'string' ? col.title.trim() : '';
  const s = typeof col.source === 'string' ? col.source.trim() : '';
  return /^id$/i.test(t) || /^id$/i.test(s);
}

export function hasMeaningfulColumnState(columnState: unknown): boolean {
  return Array.isArray(columnState) && columnState.length > 0;
}

/** Merge Qodly attribute path onto AG Grid column state (resolve colId → stable field, attach source). */
export function enrichColumnStateWithSource(
  columnState: any[] | undefined | null,
  columns: IColumn[],
): any[] {
  if (!Array.isArray(columnState)) return [];
  const byKey = new Map<string, IColumn>();
  columns.forEach((c) => {
    byKey.set(c.title, c);
    if (c.source?.trim()) byKey.set(c.source, c);
    byKey.set(agGridColumnField(c), c);
  });
  return columnState.map((cs: any) => {
    const col = cs?.colId != null ? byKey.get(cs.colId) : undefined;
    if (!col) return { ...cs };
    const stableColId = agGridColumnField(col);
    return col.source != null
      ? { ...cs, colId: stableColId, source: col.source }
      : { ...cs, colId: stableColId };
  });
}

/** Strip custom keys before applyColumnState (AG Grid only uses its own column state shape). */
export function columnStateForAgGridApply(
  columnState: any[] | undefined | null,
): any[] {
  if (!Array.isArray(columnState)) return [];
  return columnState.map((s: any) => {
    if (s && typeof s === 'object' && 'source' in s) {
      const next = { ...s };
      delete next.source;
      return next;
    }
    return s;
  });
}

/** AG Grid ignores `{}` for clearing; use `null` to reset all column filters. */
export function normalizeAgGridFilterModel(model: any): any {
  if (model == null) return null;
  if (typeof model !== 'object' || Array.isArray(model)) return model;
  return Object.keys(model).length === 0 ? null : model;
}

export function applyGridFilterModel(api: GridApi, filterModel: any): void {
  const desired = normalizeAgGridFilterModel(filterModel);
  const current = normalizeAgGridFilterModel(api.getFilterModel());
  if (isEqual(current, desired)) return;
  api.setFilterModel(desired === null ? null : filterModel);
}

/** Derive an explicit sortModel from AG Grid column state (ordered by `sortIndex`). */
export function buildSortModelFromColumnState(
  columnState: any[] | undefined | null,
): SortModelItem[] {
  if (!Array.isArray(columnState)) return [];
  return columnState
    .filter((column) => column?.sort === 'asc' || column?.sort === 'desc')
    .sort((a, b) => {
      const aIdx =
        typeof a?.sortIndex === 'number' ? a.sortIndex : Number.MAX_SAFE_INTEGER;
      const bIdx =
        typeof b?.sortIndex === 'number' ? b.sortIndex : Number.MAX_SAFE_INTEGER;
      return aIdx - bIdx;
    })
    .map((column) => ({ colId: column.colId, sort: column.sort as 'asc' | 'desc' }));
}

export function normalizeSortModel(
  sortModel: SortModelItem[] | undefined | null,
  columns: IColumn[],
  sortableColIds: string[],
): SortModelItem[] {
  if (!Array.isArray(sortModel)) return [];
  const resolveSortColId = (raw: string): string => {
    const byStable = columns.find((c) => agGridColumnField(c) === raw);
    if (byStable) return agGridColumnField(byStable);
    const byTitle = columns.find((c) => c.title === raw);
    if (byTitle) return agGridColumnField(byTitle);
    const bySource = columns.find((c) => c.source === raw);
    if (bySource) return agGridColumnField(bySource);
    return raw;
  };
  const allowed = new Set(sortableColIds);
  const seen = new Set<string>();
  return sortModel
    .map((rule) =>
      rule?.colId ? { colId: resolveSortColId(rule.colId), sort: rule.sort } : rule,
    )
    .filter(
      (rule): rule is SortModelItem =>
        !!rule?.colId &&
        (rule.sort === 'asc' || rule.sort === 'desc') &&
        allowed.has(rule.colId),
    )
    .filter((rule) => {
      if (seen.has(rule.colId)) return false;
      seen.add(rule.colId);
      return true;
    })
    .map((rule) => ({ colId: rule.colId, sort: rule.sort }));
}

/**
 * Mutate column state so every `colId` sorts according to `sortModel` (others reset).
 *
 * AG Grid v35's `InfiniteRowModel` subscribes to `sortChanged` and calls
 * `reset()` (destroys + recreates the cache → fresh `getRows`) for us, so we
 * MUST NOT also call `refreshInfiniteCache()` here — doing so fires a second
 * `getRows` for the exact same sort model and produces the duplicate
 * server request the user was seeing.
 *
 * The `applyPersistedValue` of the sorts manager still uses an `isEqual`
 * guard to skip re-applying when the sort model already matches (prevents
 * listener echoes from the `sortDs` `changed` event).
 */
export function applySortModelToGridApi(
  api: GridApi,
  sortModel: SortModelItem[],
): void {
  const sortIndexByColId = new Map(
    sortModel.map((rule, index) => [rule.colId, { sort: rule.sort, sortIndex: index }]),
  );
  const updatedColumnState = api.getColumnState().map((columnState) => {
    const sortState = sortIndexByColId.get(columnState.colId);
    if (!sortState) return { ...columnState, sort: null, sortIndex: null };
    return { ...columnState, sort: sortState.sort, sortIndex: sortState.sortIndex };
  });
  api.applyColumnState({ state: updatedColumnState, applyOrder: false });
}

/**
 * Strip sort information from a `columnState` array so applying it never
 * triggers AG Grid's `sortChanged` (which would purge the infinite cache and
 * fire an extra `getRows`). Used by the views manager — sort is owned by the
 * sorts manager, views only carry visibility / order / width / pinning.
 */
export function withoutSortFromColumnState(columnState: any[] | undefined | null): any[] {
  if (!Array.isArray(columnState)) return [];
  return columnState.map((s: any) => {
    if (!s || typeof s !== 'object') return s;
    const { sort: _sort, sortIndex: _sortIndex, ...rest } = s;
    return rest;
  });
}

/**
 * Normalize rows from a saved-list datasource:
 *   accepts { name } | { title } | { id } and mirrors each onto `name`.
 */
export function normalizeSavedRecord<T extends SavedRecordBase>(
  raw: any,
): T | null {
  if (!raw || typeof raw !== 'object') return null;
  const nameFromName = typeof raw.name === 'string' ? raw.name.trim() : '';
  const nameFromTitle = typeof raw.title === 'string' ? raw.title.trim() : '';
  const nameFromId = raw.id != null && raw.id !== '' ? String(raw.id) : '';
  const name = nameFromName || nameFromTitle || nameFromId;
  if (!name) return null;
  return { ...raw, name } as T;
}

export function savedRecordsFromDatasourceValue<T extends SavedRecordBase>(
  value: unknown,
): T[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => normalizeSavedRecord<T>(item))
    .filter((item): item is T => item != null);
}

/** Lookup helper used by every "load by name" flow. */
export function findSavedRecord<T extends SavedRecord>(
  list: T[],
  key: string,
): T | undefined {
  return list.find(
    (item) =>
      item.name === key ||
      item.title === key ||
      (item.id != null && String(item.id) === key),
  );
}
