import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgGridReact } from 'ag-grid-react';
import type { GridApi } from 'ag-grid-community';
import {
  applyGridFilterModel,
  findSavedRecord,
  normalizeAgGridFilterModel,
  savedRecordsFromDatasourceValue,
} from './gridState';
import type { FilterStateValue, SavedFilter } from './types';

interface UseFiltersManagerArgs {
  filterDs: any | null;
  filtersDs: any | null;
  gridRef: React.MutableRefObject<AgGridReact | null>;
  emit: (eventName: string, payload?: any) => void;
  applyingExternalRef: React.MutableRefObject<boolean>;
  /** Mutable ref holding the fiscal-year toggle so it persists alongside the filter model. */
  dateFinancialEnabledRef: React.MutableRefObject<boolean>;
}

export interface FiltersManager {
  savedFilters: SavedFilter[];
  refreshSavedFilters: () => Promise<void>;
  persistCurrent: (filterModel: any) => void;
  applyPersistedValue: (api: GridApi, value: any) => void;
  saveFilter: (name: string) => void;
  loadFilter: (key: string) => void;
  updateFilter: (key: string) => void;
  deleteFilter: (key: string) => void;
  loadFiltersList: () => void;
}

export function useFiltersManager({
  filterDs,
  filtersDs,
  gridRef,
  emit,
  applyingExternalRef,
  dateFinancialEnabledRef,
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
      };
      filterDs.setValue(null, next);
    },
    [filterDs, dateFinancialEnabledRef, applyingExternalRef],
  );

  const applyPersistedValue = useCallback(
    (api: GridApi, value: any) => {
      if (!value || typeof value !== 'object') return;
      const v = value as FilterStateValue;
      if ('dateFinancialFilterEnabled' in v) {
        dateFinancialEnabledRef.current = Boolean(v.dateFinancialFilterEnabled);
      }
      if ('filterModel' in v) {
        applyGridFilterModel(api, v.filterModel);
      }
    },
    [dateFinancialEnabledRef],
  );

  const captureCurrentFilterModel = useCallback(() => {
    const api = gridRef.current?.api;
    if (!api) return {};
    return api.getFilterModel() ?? {};
  }, [gridRef]);

  const saveFilter = useCallback(
    (rawName: string) => {
      const name = rawName.trim();
      if (!name) return;
      const filterModel = captureCurrentFilterModel();
      const record: SavedFilter = {
        name,
        filterModel,
        dateFinancialFilterEnabled: dateFinancialEnabledRef.current,
      };
      const updated = [...savedFiltersRef.current, record];
      setSavedFilters(updated);
      if (filtersDs) filtersDs.setValue(null, updated);
      emit('onsavefilter', {
        name,
        filterModel,
        dateFinancialFilterEnabled: record.dateFinancialFilterEnabled,
        filter: record,
      });
    },
    [captureCurrentFilterModel, emit, filtersDs, dateFinancialEnabledRef],
  );

  const loadFilter = useCallback(
    (key: string) => {
      const selectedKey = key.trim();
      if (!selectedKey) return;
      const record = findSavedRecord(savedFiltersRef.current, selectedKey);
      if (!record) return;
      const api = gridRef.current?.api;
      if (api) {
        applyGridFilterModel(api, record.filterModel);
        if ('dateFinancialFilterEnabled' in record) {
          dateFinancialEnabledRef.current = Boolean(record.dateFinancialFilterEnabled);
        }
        api.refreshInfiniteCache();
      }
      emit('onloadfilter', {
        selectedFilter: selectedKey,
        filterModel: record.filterModel,
        dateFinancialFilterEnabled: record.dateFinancialFilterEnabled,
        filter: record,
      });
    },
    [emit, gridRef, dateFinancialEnabledRef],
  );

  const updateFilter = useCallback(
    (key: string) => {
      const selectedKey = key.trim();
      if (!selectedKey) return;
      const filterModel = captureCurrentFilterModel();
      const updated = savedFiltersRef.current.map((record) => {
        const matches =
          record.name === selectedKey ||
          record.title === selectedKey ||
          (record.id != null && String(record.id) === selectedKey);
        if (!matches) return record;
        return {
          ...record,
          name: record.name || record.title || String(record.id ?? selectedKey),
          filterModel,
          dateFinancialFilterEnabled: dateFinancialEnabledRef.current,
        };
      });
      setSavedFilters(updated);
      if (filtersDs) filtersDs.setValue(null, updated);
      const row = findSavedRecord(updated, selectedKey);
      emit('onupdatefilter', {
        selectedFilter: selectedKey,
        filterModel,
        dateFinancialFilterEnabled: dateFinancialEnabledRef.current,
        filter: row,
      });
    },
    [captureCurrentFilterModel, emit, filtersDs, dateFinancialEnabledRef],
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

  const loadFiltersList = useCallback(() => {
    emit('onloadfilters');
  }, [emit]);

  return {
    savedFilters,
    refreshSavedFilters,
    persistCurrent,
    applyPersistedValue,
    saveFilter,
    loadFilter,
    updateFilter,
    deleteFilter,
    loadFiltersList,
  };
}
