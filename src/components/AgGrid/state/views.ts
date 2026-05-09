import { useCallback, useEffect, useRef, useState } from 'react';
import isEqual from 'lodash/isEqual';
import type { AgGridReact } from 'ag-grid-react';
import type { GridApi } from 'ag-grid-community';
import type { IColumn } from '../AgGrid.config';
import {
  columnStateForAgGridApply,
  enrichColumnStateWithSource,
  findSavedRecord,
  hasMeaningfulColumnState,
  savedRecordKey,
  savedRecordsFromDatasourceValue,
  withoutSortFromColumnState,
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
  /**
   * `SavedFilter.id` to associate with this view.
   * On update, `null` or `''` clears the association. If the key is omitted, the existing link is kept.
   */
  linkedFilter?: string | number | null;
  linkedFilterId?: string | number | null;
}

function normalizeLinkedFilterId(raw: string | number): string | number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const t = raw.trim();
    const n = Number(t);
    if (t !== '' && String(n) === t && Number.isFinite(n)) return n;
    return t;
  }
  return raw;
}

function linkedFilterFromSaveOptions(options?: SaveViewOptions): string | number | undefined {
  if (!options) return undefined;
  const raw = 'linkedFilterId' in options ? options.linkedFilterId : options.linkedFilter;
  if (raw === null || raw === undefined || raw === '') return undefined;
  return normalizeLinkedFilterId(raw as string | number);
}

/**
 * Project a column state array down to only the fields the views manager
 * persists (visibility, order, width, pinning). Used by `applyPersistedValue`
 * to detect "no-op" updates and short-circuit before calling `applyColumnState`
 * a second time.
 */
function viewStateForCompare(columnState: any[]): any[] {
  return columnState.map((entry: any) => ({
    colId: entry?.colId ?? null,
    hide: entry?.hide ?? false,
    pinned: entry?.pinned ?? null,
    width: entry?.width ?? null,
    flex: entry?.flex ?? null,
  }));
}

export interface ViewsManager {
  savedViews: SavedView[];
  /** Read the list from the `views` datasource and update state. */
  refreshSavedViews: () => Promise<void>;
  /**
   * Write the current grid column state to the `view` datasource (no event).
   * Pass `{ force: true }` to bypass the echo guard for deterministic
   * bootstrap writes (initial state, default-view application).
   */
  persistCurrent: (columnState: any[], options?: { force?: boolean }) => void;
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
   * and emit `onloadview`. Returns the applied record's name (so callers can
   * sync their "currently selected" UI state) or `null` when nothing applied.
   */
  tryApplyDefault: () => string | null;
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

  /**
   * Build the `ViewStateValue` payload written to the live `view` datasource.
   * Views own column visibility / order / width / pinning ONLY — sort is
   * owned by the sorts manager. Stripping `sort`/`sortIndex` keeps the two
   * concerns from clobbering each other and prevents `loadView` from
   * triggering a `sortChanged` (which would issue an extra getRows).
   */
  const buildViewPayload = useCallback(
    (columnState: any[]): ViewStateValue => ({
      columnState: enrichColumnStateWithSource(
        withoutSortFromColumnState(withoutSyntheticRowColumnState(columnState)),
        columnsRef.current,
      ),
    }),
    [columnsRef],
  );

  const persistCurrent = useCallback(
    (columnState: any[], options?: { force?: boolean }) => {
      if (!viewDs) return;
      // The `applyingExternalRef` guard breaks the DS-listener echo loop
      // (`setValue` → `changed` → `applyPersistedValue` → grid update →
      // `stateUpdated` → `persistCurrent`). At bootstrap, however, the
      // listener can race with `getState` and leave the flag momentarily
      // true, silently swallowing the very first write. Pass `force: true`
      // for those deterministic, non-echoing bootstrap writes.
      if (!options?.force && applyingExternalRef.current) return;
      viewDs.setValue(null, buildViewPayload(columnState));
    },
    [viewDs, applyingExternalRef, buildViewPayload],
  );

  const applyPersistedValue = useCallback(
    (api: GridApi, value: any): boolean => {
      if (!value || typeof value !== 'object') return false;
      const raw = withoutSortFromColumnState(
        withoutSyntheticRowColumnState((value as ViewStateValue).columnState),
      );
      if (!hasMeaningfulColumnState(raw)) return false;
      const enriched = enrichColumnStateWithSource(raw, columnsRef.current);
      const nextState = columnStateForAgGridApply(enriched);
      // Idempotency guard: when persistGridState writes back the same
      // columnState the DS listener calls us with the freshly-persisted
      // value. Re-applying would emit `stateUpdated` again and (combined
      // with the setTimeout(0) flag-reset) can start an infinite loop.
      const currentState = withoutSortFromColumnState(
        withoutSyntheticRowColumnState(api.getColumnState()),
      );
      if (isEqual(viewStateForCompare(currentState), viewStateForCompare(nextState))) {
        return true;
      }
      api.applyColumnState({ state: nextState, applyOrder: true });
      return true;
    },
    [columnsRef],
  );

  const captureCurrentColumnState = useCallback((): any[] => {
    const api = gridRef.current?.api;
    if (!api) return [];
    const raw = withoutSortFromColumnState(withoutSyntheticRowColumnState(api.getColumnState()));
    return enrichColumnStateWithSource(raw, columnsRef.current);
  }, [gridRef, columnsRef]);

  const saveView = useCallback(
    (rawName: string, options?: SaveViewOptions) => {
      const name = rawName.trim();
      if (!name) return;
      const columnState = captureCurrentColumnState();
      const isDefault = Boolean(options?.isDefault);
      const linkedFilter = linkedFilterFromSaveOptions(options);
      const view: SavedView = {
        name,
        columnState,
        isDefault,
        ...(linkedFilter !== undefined ? { linkedFilter } : {}),
      };
      const withoutOtherDefaults = isDefault
        ? savedViewsRef.current.map((v) => ({ ...v, isDefault: false }))
        : savedViewsRef.current;
      const updated = [...withoutOtherDefaults, view];
      setSavedViews(updated);
      if (viewsDs) viewsDs.setValue(null, updated);
      emit('onsaveview', {
        name,
        columnState,
        isDefault,
        linkedFilter: view.linkedFilterId ?? view.linkedFilter,
        linkedFilterId: view.linkedFilterId,
        view,
      });
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
        // Strip sort here too — older views saved before this fix may still
        // contain sort/sortIndex in their columnState.
        const enriched = enrichColumnStateWithSource(
          withoutSortFromColumnState(withoutSyntheticRowColumnState(view.columnState)),
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
        linkedFilter: view.linkedFilterId ?? view.linkedFilter,
        linkedFilterId: view.linkedFilterId,
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
      const hasLinkedFilterOpt =
        options !== undefined && ('linkedFilter' in options || 'linkedFilterId' in options);
      const updated = savedViewsRef.current.map((view) => {
        const matches =
          view.name === selectedKey ||
          view.title === selectedKey ||
          (view.id != null && String(view.id) === selectedKey);
        if (matches) {
          const base: SavedView = {
            ...view,
            name: view.name || view.title || String(view.id ?? selectedKey),
            columnState,
            ...(hasDefaultOpt ? { isDefault } : {}),
          };
          if (!hasLinkedFilterOpt) {
            return base;
          }
          const nextLinkedFilter = linkedFilterFromSaveOptions(options);
          if (nextLinkedFilter === undefined) {
            const { linkedFilter: _drop, linkedFilterId: _dropId, ...cleared } = base;
            return cleared as SavedView;
          }
          return {
            ...base,
            linkedFilter: nextLinkedFilter,
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
        linkedFilter: row?.linkedFilterId ?? row?.linkedFilter,
        linkedFilterId: row?.linkedFilterId,
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

  const tryApplyDefault = useCallback((): string | null => {
    const defaultView = savedViewsRef.current.find((v) => v.isDefault);
    if (!defaultView) return null;
    const key = savedRecordKey(defaultView);
    if (!key) return null;
    loadView(key);
    // Initialize the live `view` datasource with the default view's
    // `columnState`. Use `force: true` so the bootstrap write cannot be
    // swallowed by the `applyingExternalRef` echo guard — at startup, the
    // `viewDs` listener can race with `getState` and leave the flag set.
    // Likewise, AG Grid's `stateUpdated` during init carries the
    // `gridInitializing` source and is skipped by `onStateUpdated`.
    if (Array.isArray(defaultView.columnState)) {
      persistCurrent(defaultView.columnState, { force: true });
    }
    return key;
  }, [loadView, persistCurrent]);

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
