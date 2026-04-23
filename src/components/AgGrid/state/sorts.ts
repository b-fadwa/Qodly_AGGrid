import { useCallback, useEffect, useRef, useState } from 'react';
import isEqual from 'lodash/isEqual';
import type { AgGridReact } from 'ag-grid-react';
import type { GridApi, SortModelItem } from 'ag-grid-community';
import type { IColumn } from '../AgGrid.config';
import {
  applySortModelToGridApi,
  buildSortModelFromColumnState,
  findSavedRecord,
  normalizeSortModel,
  savedRecordsFromDatasourceValue,
} from './gridState';
import type { SavedSort, SortStateValue } from './types';

interface UseSortsManagerArgs {
  sortDs: any | null;
  sortsDs: any | null;
  gridRef: React.MutableRefObject<AgGridReact | null>;
  columnsRef: React.MutableRefObject<IColumn[]>;
  /** Ids of columns currently allowed to sort (derived from the `sorting` flag). */
  sortableColIdsRef: React.MutableRefObject<string[]>;
  emit: (eventName: string, payload?: any) => void;
  applyingExternalRef: React.MutableRefObject<boolean>;
}

export interface SaveSortOptions {
  isDefault?: boolean;
}

export interface SortsManager {
  savedSorts: SavedSort[];
  refreshSavedSorts: () => Promise<void>;
  persistCurrent: (sortModel: SortModelItem[]) => void;
  /** Returns true if the value carried a non-empty sort model. */
  applyPersistedValue: (api: GridApi, value: any) => boolean;
  saveSort: (name: string, options?: SaveSortOptions) => void;
  loadSort: (key: string) => void;
  updateSort: (key: string, options?: SaveSortOptions) => void;
  deleteSort: (key: string) => void;
  /** Apply a given sort model to the grid and persist it (shared with the advanced-sorting dialog). */
  applySortModelToGrid: (sortModel: SortModelItem[]) => void;
  /**
   * Apply the record flagged `isDefault`, if any. Returns the applied
   * record's name (for syncing dropdown state) or `null` when nothing
   * was applied.
   */
  tryApplyDefault: () => string | null;
}

export function useSortsManager({
  sortDs,
  sortsDs,
  gridRef,
  columnsRef,
  sortableColIdsRef,
  emit,
  applyingExternalRef,
}: UseSortsManagerArgs): SortsManager {
  const [savedSorts, setSavedSorts] = useState<SavedSort[]>([]);
  const savedSortsRef = useRef<SavedSort[]>([]);
  savedSortsRef.current = savedSorts;

  const refreshSavedSorts = useCallback(async () => {
    if (!sortsDs) {
      setSavedSorts([]);
      return;
    }
    try {
      const value = await sortsDs.getValue();
      setSavedSorts(savedRecordsFromDatasourceValue<SavedSort>(value));
    } catch {
      setSavedSorts([]);
    }
  }, [sortsDs]);

  useEffect(() => {
    void refreshSavedSorts();
  }, [refreshSavedSorts]);

  useEffect(() => {
    if (!sortsDs) return;
    const listener = async () => {
      try {
        const value = await sortsDs.getValue();
        setSavedSorts(savedRecordsFromDatasourceValue<SavedSort>(value));
      } catch {
        setSavedSorts([]);
      }
    };
    sortsDs.addListener('changed', listener);
    return () => {
      sortsDs.removeListener('changed', listener);
    };
  }, [sortsDs]);

  const persistCurrent = useCallback(
    (sortModel: SortModelItem[]) => {
      if (!sortDs) return;
      if (applyingExternalRef.current) return;
      const next: SortStateValue = { sortModel };
      sortDs.setValue(null, next);
    },
    [sortDs, applyingExternalRef],
  );

  const applyPersistedValue = useCallback(
    (api: GridApi, value: any): boolean => {
      if (!value || typeof value !== 'object') return false;
      const v = value as SortStateValue;
      const sortModel = Array.isArray(v.sortModel)
        ? normalizeSortModel(v.sortModel, columnsRef.current, sortableColIdsRef.current)
        : [];
      // Idempotency guard: this hook's listener fires after every external
      // sort change (we persist → DS emits "changed" → listener calls us
      // back with the freshly-persisted value). Re-applying the same model
      // would `applyColumnState` + `refreshInfiniteCache` again, which in
      // turn fires another `stateUpdated` and (if AG Grid emits it after our
      // setTimeout(0) flag-reset) starts an infinite request loop.
      const currentSortModel = buildSortModelFromColumnState(api.getColumnState());
      if (isEqual(currentSortModel, sortModel)) return sortModel.length > 0;
      applySortModelToGridApi(api, sortModel);
      return sortModel.length > 0;
    },
    [columnsRef, sortableColIdsRef],
  );

  const applySortModelToGrid = useCallback(
    (sortModel: SortModelItem[]) => {
      const api = gridRef.current?.api;
      if (!api) return;
      const normalized = normalizeSortModel(
        sortModel,
        columnsRef.current,
        sortableColIdsRef.current,
      );
      applySortModelToGridApi(api, normalized);
    },
    [gridRef, columnsRef, sortableColIdsRef],
  );

  const captureCurrentSortModel = useCallback((): SortModelItem[] => {
    const api = gridRef.current?.api;
    if (!api) return [];
    const fromColumnState = buildSortModelFromColumnState(api.getColumnState());
    return normalizeSortModel(
      fromColumnState,
      columnsRef.current,
      sortableColIdsRef.current,
    );
  }, [gridRef, columnsRef, sortableColIdsRef]);

  const saveSort = useCallback(
    (rawName: string, options?: SaveSortOptions) => {
      const name = rawName.trim();
      if (!name) return;
      const sortModel = captureCurrentSortModel();
      const isDefault = Boolean(options?.isDefault);
      const record: SavedSort = { name, sortModel, isDefault };
      const withoutOtherDefaults = isDefault
        ? savedSortsRef.current.map((r) => ({ ...r, isDefault: false }))
        : savedSortsRef.current;
      const updated = [...withoutOtherDefaults, record];
      setSavedSorts(updated);
      if (sortsDs) sortsDs.setValue(null, updated);
      emit('onsavesort', { name, sortModel, isDefault, sort: record });
    },
    [captureCurrentSortModel, emit, sortsDs],
  );

  const loadSort = useCallback(
    (key: string) => {
      const selectedKey = key.trim();
      if (!selectedKey) return;
      const record = findSavedRecord(savedSortsRef.current, selectedKey);
      if (!record) return;
      applySortModelToGrid(record.sortModel ?? []);
      emit('onloadsort', {
        selectedSort: selectedKey,
        sortModel: record.sortModel,
        sort: record,
      });
    },
    [applySortModelToGrid, emit],
  );

  const updateSort = useCallback(
    (key: string, options?: SaveSortOptions) => {
      const selectedKey = key.trim();
      if (!selectedKey) return;
      const sortModel = captureCurrentSortModel();
      const hasDefaultOpt = options !== undefined && 'isDefault' in options;
      const isDefault = Boolean(options?.isDefault);
      const updated = savedSortsRef.current.map((record) => {
        const matches =
          record.name === selectedKey ||
          record.title === selectedKey ||
          (record.id != null && String(record.id) === selectedKey);
        if (matches) {
          return {
            ...record,
            name: record.name || record.title || String(record.id ?? selectedKey),
            sortModel,
            ...(hasDefaultOpt ? { isDefault } : {}),
          };
        }
        if (hasDefaultOpt && isDefault && record.isDefault) {
          return { ...record, isDefault: false };
        }
        return record;
      });
      setSavedSorts(updated);
      if (sortsDs) sortsDs.setValue(null, updated);
      const row = findSavedRecord(updated, selectedKey);
      emit('onupdatesort', {
        selectedSort: selectedKey,
        sortModel,
        isDefault: hasDefaultOpt ? isDefault : row?.isDefault,
        sort: row,
      });
    },
    [captureCurrentSortModel, emit, sortsDs],
  );

  const deleteSort = useCallback(
    (key: string) => {
      const selectedKey = key.trim();
      if (!selectedKey) return;
      const row = findSavedRecord(savedSortsRef.current, selectedKey);
      emit('ondeletesort', { selectedSort: selectedKey, sort: row });
    },
    [emit],
  );

  const tryApplyDefault = useCallback((): string | null => {
    const defaultSort = savedSortsRef.current.find((r) => r.isDefault);
    if (!defaultSort) return null;
    loadSort(defaultSort.name);
    return defaultSort.name;
  }, [loadSort]);

  return {
    savedSorts,
    refreshSavedSorts,
    persistCurrent,
    applyPersistedValue,
    saveSort,
    loadSort,
    updateSort,
    deleteSort,
    applySortModelToGrid,
    tryApplyDefault,
  };
}

/** Translator type used by dialogs — prevents the dialogs from requiring `useI18n` themselves. */
export type Translation = (key: string) => string;

export interface SortableColumnDescriptor {
  colId: string;
  label: string;
}

/**
 * Pure helpers used by the Sorting dialog. Kept outside the hook so the dialog
 * component can stay a dumb presentational element.
 */
export function buildInitialSortDialogModel(
  current: SortModelItem[],
  sortableColumns: SortableColumnDescriptor[],
): SortModelItem[] {
  if (current.length > 0) return current;
  if (sortableColumns.length > 0) {
    return [{ colId: sortableColumns[0].colId, sort: 'asc' }];
  }
  return [];
}
