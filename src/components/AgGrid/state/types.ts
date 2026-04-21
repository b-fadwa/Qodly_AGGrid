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
}

export interface SavedView extends SavedRecordBase {
  columnState: any[];
}

export interface SavedFilter extends SavedRecordBase {
  filterModel: any;
  /** Toggle for the Date_Financial companion filter (see AgGrid.render.tsx). */
  dateFinancialFilterEnabled?: boolean;
}

export interface SavedSort extends SavedRecordBase {
  sortModel: SortModelItem[];
}

export type SavedRecord = SavedView | SavedFilter | SavedSort;

/** Scalar object datasource bound to the live view (current columnState). */
export interface ViewStateValue {
  columnState?: any[];
}

/** Scalar object datasource bound to the live filter model (+ fiscal year toggle). */
export interface FilterStateValue {
  filterModel?: any;
  dateFinancialFilterEnabled?: boolean;
}

/** Scalar object datasource bound to the live sort model. */
export interface SortStateValue {
  sortModel?: SortModelItem[];
}
