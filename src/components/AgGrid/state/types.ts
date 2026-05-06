import type { SortModelItem } from 'ag-grid-community';

/**
 * Shared identity for every "saved" record (view / filter / sort).
 * `name` is required (used as the lookup key in the UI).
 * `id` / `title` are optional mirrors for backend compatibility
 * (4D server responses typically carry `id` and sometimes `title` instead of `name`).
 */
export interface SavedRecordBase {
  name: string;
  title?: string;
  id?: string | number;
  /**
   * When true, this record is the one auto-applied on grid bootstrap if the
   * live DS (`view` / `filter` / `sort`) does not already carry a value.
   * Only one record per list should have `isDefault: true` — the managers
   * enforce this on save/update.
   */
  isDefault?: boolean;
}

export interface SavedView extends SavedRecordBase {
  columnState: any[];
}

export interface SavedFilter extends SavedRecordBase {
  filterModel: any;
  /** Fiscal-year companion toggle (see AgGrid.render.tsx). */
  dateFinancialFilterEnabled?: boolean;
  /** Hide inactive records toggle persisted with saved filters. */
  filterInactiveRecords?: boolean;
  /** Optional saved sort name applied automatically when this filter loads. */
  linkedSort?: string;
}

export interface SavedSort extends SavedRecordBase {
  sortModel: SortModelItem[];
}

export type SavedRecord = SavedView | SavedFilter | SavedSort;

/** Scalar object datasource bound to the live view (current columnState). */
export interface ViewStateValue {
  columnState?: any[];
}

/** Scalar object datasource bound to the live filter model (+ companion toggles). */
export interface FilterStateValue {
  filterModel?: any;
  dateFinancialFilterEnabled?: boolean;
  filterInactiveRecords?: boolean;
}

/** Scalar object datasource bound to the live sort model. */
export interface SortStateValue {
  sortModel?: SortModelItem[];
}
