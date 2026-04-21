import { useCallback, useEffect, useRef, useState } from 'react';
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

export interface SortsManager {
  savedSorts: SavedSort[];
  refreshSavedSorts: () => Promise<void>;
  persistCurrent: (sortModel: SortModelItem[]) => void;
  applyPersistedValue: (api: GridApi, value: any) => void;
  saveSort: (name: string) => void;
  loadSort: (key: string) => void;
  updateSort: (key: string) => void;
  deleteSort: (key: string) => void;
  loadSortsList: () => void;
  /** Apply a given sort model to the grid and persist it (shared with the advanced-sorting dialog). */
  applySortModelToGrid: (sortModel: SortModelItem[]) => void;
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
    (api: GridApi, value: any) => {
      if (!value || typeof value !== 'object') return;
      const v = value as SortStateValue;
      const sortModel = Array.isArray(v.sortModel)
        ? normalizeSortModel(v.sortModel, columnsRef.current, sortableColIdsRef.current)
        : [];
      applySortModelToGridApi(api, sortModel);
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
    (rawName: string) => {
      const name = rawName.trim();
      if (!name) return;
      const sortModel = captureCurrentSortModel();
      const record: SavedSort = { name, sortModel };
      const updated = [...savedSortsRef.current, record];
      setSavedSorts(updated);
      if (sortsDs) sortsDs.setValue(null, updated);
      emit('onsavesort', { name, sortModel, sort: record });
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
    (key: string) => {
      const selectedKey = key.trim();
      if (!selectedKey) return;
      const sortModel = captureCurrentSortModel();
      const updated = savedSortsRef.current.map((record) => {
        const matches =
          record.name === selectedKey ||
          record.title === selectedKey ||
          (record.id != null && String(record.id) === selectedKey);
        if (!matches) return record;
        return {
          ...record,
          name: record.name || record.title || String(record.id ?? selectedKey),
          sortModel,
        };
      });
      setSavedSorts(updated);
      if (sortsDs) sortsDs.setValue(null, updated);
      const row = findSavedRecord(updated, selectedKey);
      emit('onupdatesort', { selectedSort: selectedKey, sortModel, sort: row });
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

  const loadSortsList = useCallback(() => {
    emit('onloadsorts');
  }, [emit]);

  return {
    savedSorts,
    refreshSavedSorts,
    persistCurrent,
    applyPersistedValue,
    saveSort,
    loadSort,
    updateSort,
    deleteSort,
    loadSortsList,
    applySortModelToGrid,
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
