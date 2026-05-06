import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgGridReact } from 'ag-grid-react';
import type { GridApi } from 'ag-grid-community';
import { stripAdvancedRulesFromFilterModel } from '../AgGrid.filtering';
import {
  applyGridFilterModel,
  findSavedRecord,
  normalizeAgGridFilterModel,
  savedRecordsFromDatasourceValue,
} from './gridState';
import type { FilterStateValue, SavedFilter } from './types';

/** For web-event payloads only — removes internal `__qodlyAdvancedRules` from AG Grid filter models. */
function filterModelForEmit(model: any): Record<string, any> {
  return normalizeAgGridFilterModel(stripAdvancedRulesFromFilterModel(model ?? {})) ?? {};
}

interface UseFiltersManagerArgs {
  filterDs: any | null;
  filtersDs: any | null;
  gridRef: React.MutableRefObject<AgGridReact | null>;
  emit: (eventName: string, payload?: any) => void;
  applyingExternalRef: React.MutableRefObject<boolean>;
  /** Mutable ref holding the fiscal-year toggle so it persists alongside the filter model. */
  dateFinancialEnabledRef: React.MutableRefObject<boolean>;
  /** Mutable ref for “filter inactive records” toggle (persisted with filter model). */
  filterInactiveRecordsEnabledRef: React.MutableRefObject<boolean>;
  /** Optional hook to apply a linked sort when a filter gets loaded. */
  onFilterLoaded?: (record: SavedFilter, selectedKey: string) => void;
}

export interface SaveFilterOptions {
  linkedSort?: string;
  /** When set (e.g. from the advanced filter modal draft), used instead of `gridApi.getFilterModel()`. */
  filterModel?: any;
}

export interface FiltersManager {
  savedFilters: SavedFilter[];
  refreshSavedFilters: () => Promise<void>;
  persistCurrent: (filterModel: any) => void;
  /** Returns true if the value carried a non-empty filter model. */
  applyPersistedValue: (api: GridApi, value: any) => boolean;
  saveFilter: (name: string, options?: SaveFilterOptions) => void;
  loadFilter: (key: string) => void;
  updateFilter: (key: string, options?: SaveFilterOptions) => void;
  deleteFilter: (key: string) => void;
}

export function useFiltersManager({
  filterDs,
  filtersDs,
  gridRef,
  emit,
  applyingExternalRef,
  dateFinancialEnabledRef,
  filterInactiveRecordsEnabledRef,
  onFilterLoaded,
}: UseFiltersManagerArgs): FiltersManager {
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const savedFiltersRef = useRef<SavedFilter[]>([]);
  savedFiltersRef.current = savedFilters;

  const refreshSavedFilters = useCallback(async () => {
    if (!filtersDs) {
      setSavedFilters([]);
      return;
    }
    try {
      const value = await filtersDs.getValue();
      setSavedFilters(savedRecordsFromDatasourceValue<SavedFilter>(value));
    } catch {
      setSavedFilters([]);
    }
  }, [filtersDs]);

  useEffect(() => {
    void refreshSavedFilters();
  }, [refreshSavedFilters]);

  useEffect(() => {
    if (!filtersDs) return;
    const listener = async () => {
      try {
        const value = await filtersDs.getValue();
        setSavedFilters(savedRecordsFromDatasourceValue<SavedFilter>(value));
      } catch {
        setSavedFilters([]);
      }
    };
    filtersDs.addListener('changed', listener);
    return () => {
      filtersDs.removeListener('changed', listener);
    };
  }, [filtersDs]);

  const persistCurrent = useCallback(
    (filterModel: any) => {
      if (!filterDs) return;
      if (applyingExternalRef.current) return;
      const next: FilterStateValue = {
        filterModel: normalizeAgGridFilterModel(filterModel) ?? {},
        dateFinancialFilterEnabled: dateFinancialEnabledRef.current,
        filterInactiveRecords: filterInactiveRecordsEnabledRef.current,
      };
      filterDs.setValue(null, next);
    },
    [filterDs, dateFinancialEnabledRef, filterInactiveRecordsEnabledRef, applyingExternalRef],
  );

  const applyPersistedValue = useCallback(
    (api: GridApi, value: any): boolean => {
      if (!value || typeof value !== 'object') return false;
      const v = value as FilterStateValue;
      if ('dateFinancialFilterEnabled' in v) {
        dateFinancialEnabledRef.current = Boolean(v.dateFinancialFilterEnabled);
      }
      if ('filterInactiveRecords' in v) {
        filterInactiveRecordsEnabledRef.current = Boolean(v.filterInactiveRecords);
      }
      let appliedFilter = false;
      // Some hosts clear the datasource by setting `{}` instead of
      // `{ filterModel: {} }`. Treat an empty object as "clear all filters".
      if (!('filterModel' in v) && Object.keys(v as any).length === 0) {
        applyGridFilterModel(api, null);
        appliedFilter = false;
      } else if ('filterModel' in v) {
        applyGridFilterModel(api, v.filterModel);
        const fm = v.filterModel;
        appliedFilter =
          !!fm && typeof fm === 'object' && Object.keys(fm as any).length > 0;
      }
      return appliedFilter;
    },
    [dateFinancialEnabledRef, filterInactiveRecordsEnabledRef],
  );

  const captureCurrentFilterModel = useCallback(() => {
    const api = gridRef.current?.api;
    if (!api) return {};
    return api.getFilterModel() ?? {};
  }, [gridRef]);

  const resolveFilterModelForSave = useCallback(
    (options?: SaveFilterOptions) => {
      if (options?.filterModel !== undefined) {
        return normalizeAgGridFilterModel(options.filterModel) ?? {};
      }
      return normalizeAgGridFilterModel(captureCurrentFilterModel()) ?? {};
    },
    [captureCurrentFilterModel],
  );

  const saveFilter = useCallback(
    (rawName: string, options?: SaveFilterOptions) => {
      const name = rawName.trim();
      if (!name) return;
      const filterModel = resolveFilterModelForSave(options);
      const record: SavedFilter = {
        name,
        filterModel,
        dateFinancialFilterEnabled: dateFinancialEnabledRef.current,
        filterInactiveRecords: filterInactiveRecordsEnabledRef.current,
        linkedSort: options?.linkedSort?.trim() || undefined,
      };
      const updated = [...savedFiltersRef.current, record];
      setSavedFilters(updated);
      if (filtersDs) filtersDs.setValue(null, updated);
      emit('onsavefilter', {
        name,
        filterModel: filterModelForEmit(filterModel),
        linkedSort: record.linkedSort,
        dateFinancialFilterEnabled: record.dateFinancialFilterEnabled,
        filterInactiveRecords: record.filterInactiveRecords,
        filter: record,
      });
    },
    [
      resolveFilterModelForSave,
      emit,
      filtersDs,
      dateFinancialEnabledRef,
      filterInactiveRecordsEnabledRef,
    ],
  );

  const loadFilter = useCallback(
    (key: string) => {
      const selectedKey = key.trim();
      if (!selectedKey) return;
      const record = findSavedRecord(savedFiltersRef.current, selectedKey);
      if (!record) return;
      const api = gridRef.current?.api;
      if (api) {
        // `applyGridFilterModel` calls `setFilterModel` which fires
        // `filterChanged`; the host's `onFilterChanged` listener already
        // calls `refreshInfiniteCache`, so a second refresh here would
        // produce a duplicate `getRows` (the second one losing orderBy).
        applyGridFilterModel(api, record.filterModel);
        if ('dateFinancialFilterEnabled' in record) {
          dateFinancialEnabledRef.current = Boolean(record.dateFinancialFilterEnabled);
        }
        if ('filterInactiveRecords' in record) {
          filterInactiveRecordsEnabledRef.current = Boolean(record.filterInactiveRecords);
        }
      }
      emit('onloadfilter', {
        selectedFilter: selectedKey,
        filterModel: record.filterModel,
        linkedSort: record.linkedSort,
        dateFinancialFilterEnabled: record.dateFinancialFilterEnabled,
        filterInactiveRecords: record.filterInactiveRecords,
        filter: record,
      });
      onFilterLoaded?.(record, selectedKey);
    },
    [emit, gridRef, dateFinancialEnabledRef, filterInactiveRecordsEnabledRef, onFilterLoaded],
  );

  const updateFilter = useCallback(
    (key: string, options?: SaveFilterOptions) => {
      const selectedKey = key.trim();
      if (!selectedKey) return;
      const filterModel = resolveFilterModelForSave(options);
      const updated = savedFiltersRef.current.map((record) => {
        const matches =
          record.name === selectedKey ||
          record.title === selectedKey ||
          (record.id != null && String(record.id) === selectedKey);
        if (matches) {
          return {
            ...record,
            name: record.name || record.title || String(record.id ?? selectedKey),
            filterModel,
            dateFinancialFilterEnabled: dateFinancialEnabledRef.current,
            filterInactiveRecords: filterInactiveRecordsEnabledRef.current,
            linkedSort:
              options?.linkedSort !== undefined
                ? options.linkedSort?.trim() || undefined
                : record.linkedSort,
          };
        }
        return record;
      });
      setSavedFilters(updated);
      if (filtersDs) filtersDs.setValue(null, updated);
      const row = findSavedRecord(updated, selectedKey);
      emit('onupdatefilter', {
        selectedFilter: selectedKey,
        filterModel: filterModelForEmit(filterModel),
        linkedSort: row?.linkedSort,
        dateFinancialFilterEnabled: dateFinancialEnabledRef.current,
        filterInactiveRecords: filterInactiveRecordsEnabledRef.current,
        filter: row,
      });
    },
    [
      resolveFilterModelForSave,
      emit,
      filtersDs,
      dateFinancialEnabledRef,
      filterInactiveRecordsEnabledRef,
    ],
  );

  const deleteFilter = useCallback(
    (key: string) => {
      const selectedKey = key.trim();
      if (!selectedKey) return;
      const row = findSavedRecord(savedFiltersRef.current, selectedKey);
      emit('ondeletefilter', { selectedFilter: selectedKey, filter: row });
    },
    [emit],
  );

  return {
    savedFilters,
    refreshSavedFilters,
    persistCurrent,
    applyPersistedValue,
    saveFilter,
    loadFilter,
    updateFilter,
    deleteFilter,
  };
}
