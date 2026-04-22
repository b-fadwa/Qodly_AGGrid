import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgGridReact } from 'ag-grid-react';
import type { GridApi } from 'ag-grid-community';
import type { IColumn } from '../AgGrid.config';
import {
  columnStateForAgGridApply,
  enrichColumnStateWithSource,
  findSavedRecord,
  hasMeaningfulColumnState,
  savedRecordsFromDatasourceValue,
  withoutSyntheticRowColumnState,
} from './gridState';
import type { SavedView, ViewStateValue } from './types';

interface UseViewsManagerArgs {
  viewDs: any | null;
  viewsDs: any | null;
  gridRef: React.MutableRefObject<AgGridReact | null>;
  columnsRef: React.MutableRefObject<IColumn[]>;
  emit: (eventName: string, payload?: any) => void;
  /** Set to `true` while applying an external snapshot so we don't echo it back to the DS. */
  applyingExternalRef: React.MutableRefObject<boolean>;
}

/** Options accepted by save / update to flag the record as the default. */
export interface SaveViewOptions {
  isDefault?: boolean;
}

export interface ViewsManager {
  savedViews: SavedView[];
  /** Read the list from the `views` datasource and update state. */
  refreshSavedViews: () => Promise<void>;
  /** Write the current grid column state to the `view` datasource (no event). */
  persistCurrent: (columnState: any[]) => void;
  /** Apply the `view` datasource snapshot to the grid (used on initial load). */
  applyPersistedValue: (api: GridApi, value: any) => boolean;
  /** Save the current grid state as a named view — emits `onsaveview`. */
  saveView: (name: string, options?: SaveViewOptions) => void;
  /** Load a named view into the grid — emits `onloadview`. */
  loadView: (key: string) => void;
  /** Update the saved view `key` with the current grid state — emits `onupdateview`. */
  updateView: (key: string, options?: SaveViewOptions) => void;
  /** Ask the host to delete the saved view `key` — emits `ondeleteview`. */
  deleteView: (key: string) => void;
  /**
   * If the list contains a record flagged `isDefault`, apply it to the grid
   * and emit `onloadview`. Returns `true` when a default was applied.
   */
  tryApplyDefault: () => boolean;
}

export function useViewsManager({
  viewDs,
  viewsDs,
  gridRef,
  columnsRef,
  emit,
  applyingExternalRef,
}: UseViewsManagerArgs): ViewsManager {
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const savedViewsRef = useRef<SavedView[]>([]);
  savedViewsRef.current = savedViews;

  const refreshSavedViews = useCallback(async () => {
    if (!viewsDs) {
      setSavedViews([]);
      return;
    }
    try {
      const value = await viewsDs.getValue();
      setSavedViews(savedRecordsFromDatasourceValue<SavedView>(value));
    } catch {
      setSavedViews([]);
    }
  }, [viewsDs]);

  useEffect(() => {
    void refreshSavedViews();
  }, [refreshSavedViews]);

  useEffect(() => {
    if (!viewsDs) return;
    const listener = async () => {
      try {
        const value = await viewsDs.getValue();
        setSavedViews(savedRecordsFromDatasourceValue<SavedView>(value));
      } catch {
        setSavedViews([]);
      }
    };
    viewsDs.addListener('changed', listener);
    return () => {
      viewsDs.removeListener('changed', listener);
    };
  }, [viewsDs]);

  const persistCurrent = useCallback(
    (columnState: any[]) => {
      if (!viewDs) return;
      if (applyingExternalRef.current) return;
      const enriched = enrichColumnStateWithSource(
        withoutSyntheticRowColumnState(columnState),
        columnsRef.current,
      );
      const next: ViewStateValue = { columnState: enriched };
      viewDs.setValue(null, next);
    },
    [viewDs, columnsRef, applyingExternalRef],
  );

  const applyPersistedValue = useCallback(
    (api: GridApi, value: any): boolean => {
      if (!value || typeof value !== 'object') return false;
      const raw = withoutSyntheticRowColumnState((value as ViewStateValue).columnState);
      if (!hasMeaningfulColumnState(raw)) return false;
      const enriched = enrichColumnStateWithSource(raw, columnsRef.current);
      api.applyColumnState({
        state: columnStateForAgGridApply(enriched),
        applyOrder: true,
      });
      return true;
    },
    [columnsRef],
  );

  const captureCurrentColumnState = useCallback((): any[] => {
    const api = gridRef.current?.api;
    if (!api) return [];
    const raw = withoutSyntheticRowColumnState(api.getColumnState());
    return enrichColumnStateWithSource(raw, columnsRef.current);
  }, [gridRef, columnsRef]);

  const saveView = useCallback(
    (rawName: string, options?: SaveViewOptions) => {
      const name = rawName.trim();
      if (!name) return;
      const columnState = captureCurrentColumnState();
      const isDefault = Boolean(options?.isDefault);
      const view: SavedView = { name, columnState, isDefault };
      const withoutOtherDefaults = isDefault
        ? savedViewsRef.current.map((v) => ({ ...v, isDefault: false }))
        : savedViewsRef.current;
      const updated = [...withoutOtherDefaults, view];
      setSavedViews(updated);
      if (viewsDs) viewsDs.setValue(null, updated);
      emit('onsaveview', { name, columnState, isDefault, view });
    },
    [captureCurrentColumnState, emit, viewsDs],
  );

  const loadView = useCallback(
    (key: string) => {
      const selectedKey = key.trim();
      if (!selectedKey) return;
      const view = findSavedRecord(savedViewsRef.current, selectedKey);
      if (!view) return;
      const api = gridRef.current?.api;
      if (api && Array.isArray(view.columnState)) {
        const enriched = enrichColumnStateWithSource(
          withoutSyntheticRowColumnState(view.columnState),
          columnsRef.current,
        );
        api.applyColumnState({
          state: columnStateForAgGridApply(enriched),
          applyOrder: true,
        });
      }
      emit('onloadview', {
        selectedView: selectedKey,
        columnState: view.columnState,
        view,
      });
    },
    [columnsRef, emit, gridRef],
  );

  const updateView = useCallback(
    (key: string, options?: SaveViewOptions) => {
      const selectedKey = key.trim();
      if (!selectedKey) return;
      const columnState = captureCurrentColumnState();
      const hasDefaultOpt = options !== undefined && 'isDefault' in options;
      const isDefault = Boolean(options?.isDefault);
      const updated = savedViewsRef.current.map((view) => {
        const matches =
          view.name === selectedKey ||
          view.title === selectedKey ||
          (view.id != null && String(view.id) === selectedKey);
        if (matches) {
          return {
            ...view,
            name: view.name || view.title || String(view.id ?? selectedKey),
            columnState,
            ...(hasDefaultOpt ? { isDefault } : {}),
          };
        }
        // When the caller sets this record as default, clear the flag on the
        // others to preserve the "only one default" invariant.
        if (hasDefaultOpt && isDefault && view.isDefault) {
          return { ...view, isDefault: false };
        }
        return view;
      });
      setSavedViews(updated);
      if (viewsDs) viewsDs.setValue(null, updated);
      const row = findSavedRecord(updated, selectedKey);
      emit('onupdateview', {
        selectedView: selectedKey,
        columnState,
        isDefault: hasDefaultOpt ? isDefault : row?.isDefault,
        view: row,
      });
    },
    [captureCurrentColumnState, emit, viewsDs],
  );

  const deleteView = useCallback(
    (key: string) => {
      const selectedKey = key.trim();
      if (!selectedKey) return;
      const row = findSavedRecord(savedViewsRef.current, selectedKey);
      emit('ondeleteview', { selectedView: selectedKey, view: row });
    },
    [emit],
  );

  const tryApplyDefault = useCallback((): boolean => {
    const defaultView = savedViewsRef.current.find((v) => v.isDefault);
    if (!defaultView) return false;
    loadView(defaultView.name);
    return true;
  }, [loadView]);

  return {
    savedViews,
    refreshSavedViews,
    persistCurrent,
    applyPersistedValue,
    saveView,
    loadView,
    updateView,
    deleteView,
    tryApplyDefault,
  };
}
