import {
  useDataLoader,
  useRenderer,
  useSources,
  useDsChangeHandler,
  entitySubject,
  EntityActions,
  useEnhancedNode,
  useWebformPath,
  useEnhancedEditor,
  useI18n,
  useLocalization,
} from '@ws-ui/webform-editor';
import cn from 'classnames';
import {
  CSSProperties,
  FC,
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AgGridReact } from 'ag-grid-react';
import { IAgGridProps, IColumn } from './AgGrid.config';
import {
  buildFocusedCellClipboardText,
  buildManualSelectedCellsClipboardText,
  buildSelectedCellRangesClipboardText,
  buildSelectedRowsClipboardText,
  getFirstDataColumnForCopy,
  isEditableTarget,
  isCopyShortcut,
  type TManualSelectedCell,
  writeTextToClipboard,
} from './AgGrid.clipboard';
import {
  buildFilterQueries,
  extractRefDatasetKeyFromSource,
  getColumnFilterParams,
  getColumnFilterType,
  isBooleanLikeColumn,
  refOptionI18nCompositeKey,
} from './AgGrid.filtering';
import { QodlyRefSelectFilter } from './AgGridRefSelectFilter';
import {
  ColDef,
  FilterChangedEvent,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  IGetRowsParams,
  PostProcessPopupParams,
  SortModelItem,
  StateUpdatedEvent,
  ModuleRegistry,
  ColumnHoverModule,
  CellStyleModule,
  RowStyleModule,
  RenderApiModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  RowClassParams,
  themeQuartz,
} from 'ag-grid-community';
import isEqual from 'lodash/isEqual';
import cloneDeep from 'lodash/cloneDeep';
import CustomCell from './CustomCell';
import AgGridSelectionHeader from './AgGridSelectionHeader';
import {
  AgGridCalculsStatistique,
  type CalculsStatistiqueResultDatasource,
} from './AgGridCalculsStatistique';
import { StatisticCalculations } from './StatisticCalculations';
import { Element } from '@ws-ui/craftjs-core';
import { selectResolver } from '@ws-ui/webform-editor';
import { format } from 'date-fns';
import { get } from 'lodash';
import { FaTableColumns, FaCopy } from 'react-icons/fa6';
import { FaClockRotateLeft } from 'react-icons/fa6';
import { IoMdClose } from 'react-icons/io';
import { FaSortAmountDown, FaFilter } from 'react-icons/fa';
import { GoTrash } from 'react-icons/go';
import {
  ROW_NUMBER_COL_ID,
  agGridColumnField,
  buildSortModelFromColumnState,
  normalizeAgGridFilterModel,
  normalizeSortModel,
  withoutSyntheticRowColumnState,
} from './state/gridState';
import { useViewsManager } from './state/views';
import { useFiltersManager } from './state/filters';
import { useSortsManager } from './state/sorts';
import { SortingDialog } from './dialogs/SortingDialog';
import { FilterDialog } from './dialogs/FilterDialog';

ModuleRegistry.registerModules([
  ColumnHoverModule,
  CellStyleModule,
  RowStyleModule,
  RenderApiModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
]);

/**
 * After "Clear result" calls `setFilterModel(null)`, the filter popup can close (especially in
 * hosted / MF builds). AG Grid supports reopening via `showColumnFilter` — schedule a few passes
 * so it runs after internal teardown + async refresh.
 * @see https://www.ag-grid.com/react-data-grid/filter-api/#launching-filters
 */
function scheduleReopenColumnFilterAfterClear(api: GridApi, colId: string | undefined): void {
  if (!colId || colId === ROW_NUMBER_COL_ID) return;
  const reopen = () => {
    try {
      (api as unknown as { showColumnFilter?: (key: string) => void }).showColumnFilter?.(colId);
    } catch {
      // Older typings or host wrappers
    }
  };
  queueMicrotask(reopen);
  requestAnimationFrame(() => {
    requestAnimationFrame(reopen);
  });
  window.setTimeout(reopen, 120);
}

/**
 * Condition-type `AgSelect` renders its option list in a separate layered popup. A mousedown there
 * can be treated as "outside" the column filter panel, so the panel closes before Apply — especially
 * when there are no value inputs (`numberOfInputs: 0`, e.g. boolean True/False on a number filter).
 * Marking the open list lets AG Grid treat those clicks as part of the filter UI flow.
 */
function attachColumnFilterNestedSelectPopupWorkaround(ePopup: HTMLElement): void {
  if (ePopup.getAttribute('data-qodly-nested-select-popup-fix') === '1') return;
  if (!ePopup.querySelector('.ag-filter')) return;
  ePopup.setAttribute('data-qodly-nested-select-popup-fix', '1');

  const markListFromEvent = (eventTarget: EventTarget | null) => {
    const list = (eventTarget as HTMLElement | null)?.closest?.('.ag-select-list');
    if (list) list.classList.add('ag-custom-component-popup');
  };

  const onPointerDownCapture = (e: Event) => {
    if (!ePopup.isConnected) {
      cleanup();
      return;
    }
    markListFromEvent(e.target);
  };

  let detachInterval: number | undefined;
  const cleanup = () => {
    document.removeEventListener('mousedown', onPointerDownCapture, true);
    document.removeEventListener('touchstart', onPointerDownCapture, true);
    if (detachInterval != null) {
      window.clearInterval(detachInterval);
      detachInterval = undefined;
    }
  };

  document.addEventListener('mousedown', onPointerDownCapture, true);
  document.addEventListener('touchstart', onPointerDownCapture, true);

  detachInterval = window.setInterval(() => {
    if (!ePopup.isConnected) {
      cleanup();
    }
  }, 500);
}

const RowNumberCell: FC<ICellRendererParams> = (params) => (
  <span style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
    {params.value ?? ''}
  </span>
);

function findAgGridRowCssValue(data: any, field: string, cols: IColumn[]): any {
  if (data[field] !== undefined && data[field] !== null) {
    return data[field];
  }
  const bySource = cols.find((c) => c.source === field);
  if (bySource) {
    const stable = agGridColumnField(bySource);
    const v = data[stable];
    if (v !== undefined && v !== null) return v;
    if (data[bySource.title] !== undefined && data[bySource.title] !== null) {
      return data[bySource.title];
    }
  }
  const byTitle = cols.find((c) => c.title === field);
  if (byTitle) {
    const stable = agGridColumnField(byTitle);
    const v = data[stable];
    if (v !== undefined && v !== null) return v;
    return data[byTitle.title];
  }
  return undefined;
}

type CopyMode = 'cells' | 'rows' | 'none';

const AgGrid: FC<IAgGridProps> = ({
  datasource,
  columns,
  view = '',
  views = '',
  filter = '',
  filters = '',
  sort = '',
  sorts = '',
  dateFinancial = '',
  calculStatistiqueResult = '',
  currentSelection = '',
  spacing,
  accentColor,
  backgroundColor,
  textColor,
  fontSize,
  borderColor,
  wrapperBorderRadius,
  oddRowBackgroundColor,
  rowBorder,
  columnBorder,
  headerBackgroundColor,
  headerTextColor,
  headerColumnBorder,
  headerVerticalPaddingScale,
  headerFontSize,
  headerFontWeight,
  cellHorizontalPaddingScale,
  rowVerticalPaddingScale,
  iconSize,
  enableCellFocus,
  enableColumnHover,
  multiSelection,
  rowCssField,
  style,
  disabled = false,
  showColumnActions,
  showToolbarActions = true,
  showToolbarView = true,
  showToolbarSorting = true,
  showToolbarFiltering = true,
  showToolbarStatistics = true,
  showToolbarSaveView = true,
  showToolbarSavedViews = true,
  className,
  classNames = [],
  showCopyActions,
  showRecordCount = true,
  showRowNumbers = false,
}) => {
  const { connect, emit } = useRenderer({
    autoBindEvents: !disabled,
    omittedEvents: [
      'onrowclick',
      'onrowdblclick',
      'onheaderclick',
      'oncellclick',
      'oncelldblclick',
      'oncellkeydown',
      'oncellmouseover',
      'oncellmouseout',
      'oncellmousedown',
      'onsaveview',
      'onloadview',
      'onloadviews',
      'onupdateview',
      'ondeleteview',
      'onsavefilter',
      'onloadfilter',
      'onloadfilters',
      'onupdatefilter',
      'ondeletefilter',
      'onsavesort',
      'onloadsort',
      'onloadsorts',
      'onupdatesort',
      'ondeletesort',
      'oncalculstatistique',
    ],
  });
  const { resolver } = useEnhancedEditor(selectResolver);
  const {
    sources: { datasource: ds, currentElement },
  } = useSources({ acceptIteratorSel: true });
  const { id: nodeID } = useEnhancedNode();
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const prevSortModelRef = useRef<SortModelItem[]>([]);
  /** Skip persisting to `state` while we apply datasource → grid (avoids echo with external updates). */
  const applyingExternalStateRef = useRef(false);
  const gridRef = useRef<AgGridReact>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const dateFinancialRef = useRef<Date | null>(null);
  const dateFinancialEnabledRef = useRef<boolean>(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.contentRect.height;
        if (h > 0) setContainerHeight(h);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { i18n } = useI18n();
  const { selected: lang } = useLocalization();

  //add key aggrid_
  const translation = (key: string): string => {
    const formattedKey = key.replace(/\s+/g, '_');
    return get(
      i18n,
      `keys.aggrid_${formattedKey}.${lang}`,
      get(i18n, `keys.aggrid_${formattedKey}.default`, key),
    );
  };

  const searchDs = useMemo(() => {
    if (ds) {
      const clone: any = cloneDeep(ds);
      clone.id = `${clone.id}_clone`;
      clone.children = {};
      return clone;
    }
    return null;
  }, [ds?.id, (ds as any)?.entitysel]);

  const { fetchIndex, fetchPage } = useDataLoader({
    source: ds,
  });

  const { fetchPage: fetchClone } = useDataLoader({
    source: searchDs,
  });

  const path = useWebformPath();
  const viewDs = useMemo(
    () => (view ? window.DataSource.getSource(view, path) : null),
    [view, path],
  );
  const viewsDs = useMemo(
    () => (views ? window.DataSource.getSource(views, path) : null),
    [views, path],
  );
  const filterDs = useMemo(
    () => (filter ? window.DataSource.getSource(filter, path) : null),
    [filter, path],
  );
  const filtersDs = useMemo(
    () => (filters ? window.DataSource.getSource(filters, path) : null),
    [filters, path],
  );
  const sortDs = useMemo(
    () => (sort ? window.DataSource.getSource(sort, path) : null),
    [sort, path],
  );
  const sortsDs = useMemo(
    () => (sorts ? window.DataSource.getSource(sorts, path) : null),
    [sorts, path],
  );
  const dateFinancialDS = useMemo(() => {
    const id = dateFinancial?.trim();
    if (!id) return null;
    return window.DataSource.getSource(id, path);
  }, [dateFinancial, path]);
  const calculStatistiqueResultDS = useMemo(() => {
    const id = calculStatistiqueResult?.trim();
    if (!id) return null;
    return window.DataSource.getSource(id, path);
  }, [calculStatistiqueResult, path]);
  const currentSelectionDS = window.DataSource.getSource(currentSelection, path);

  const parseDateFinancial = useCallback((raw: any): Date | null => {
    if (raw == null || raw === '') return null;
    if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }, []);

  useEffect(() => {
    if (!dateFinancialDS) {
      dateFinancialRef.current = null;
      dateFinancialEnabledRef.current = false;
      return;
    }
    let cancelled = false;
    const syncNow = async () => {
      try {
        const v = await dateFinancialDS.getValue();
        if (cancelled) return;
        dateFinancialRef.current = parseDateFinancial(v);
      } catch {
        if (!cancelled) dateFinancialRef.current = null;
      }
    };
    void syncNow();
    const listener = async () => {
      await syncNow();
      gridRef.current?.api?.refreshInfiniteCache();
    };
    dateFinancialDS.addListener('changed', listener);
    return () => {
      cancelled = true;
      dateFinancialDS.removeListener('changed', listener);
    };
  }, [dateFinancialDS, parseDateFinancial]);

  const [selected, setSelected] = useState(-1);
  const [scrollIndex, setScrollIndex] = useState(0);
  const [, setCount] = useState(0);
  /** Row total for the current grid query (main ds or filtered clone), from getRows `length`. */
  const [displayedRecordCount, setDisplayedRecordCount] = useState(0);
  /** Select-all only when this fetch returned every row (rowData.length >= total length from server). */
  const [showSelectAllHeaderCheckbox, setShowSelectAllHeaderCheckbox] = useState(false);

  const selectionColumnDef = useMemo(
    () =>
      multiSelection
        ? {
            headerComponent: AgGridSelectionHeader,
            headerComponentParams: {
              ariaLabelSelectAll: translation('Select all rows'),
              showSelectAllCheckbox: showSelectAllHeaderCheckbox,
            },
            suppressHeaderMenuButton: true,
            width: 48,
            minWidth: 48,
            maxWidth: 56,
            flex: 0,
            pinned: 'left' as const,
            lockPinned: true,
            lockPosition: 'left' as const,
            suppressMovable: true,
            resizable: false,
          }
        : undefined,
    [multiSelection, i18n, lang, showSelectAllHeaderCheckbox],
  );

  const [copyMode, setCopyMode] = useState<CopyMode>('none');
  const [showCopyModeDialog, setShowCopyModeDialog] = useState(false);
  const [copyModeDraft, setCopyModeDraft] = useState<CopyMode>('none');
  const [manualSelectedCells, setManualSelectedCells] = useState<TManualSelectedCell[]>([]);
  const [cellRangeSelectionActive, setCellRangeSelectionActive] = useState(false);
  const [isCellSelectionAvailable, setIsCellSelectionAvailable] = useState(false);
  const [showPropertiesDialog, setShowPropertiesDialog] = useState(false);
  const [showSortingDialog, setShowSortingDialog] = useState(false);
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [sortDialogInitialModel, setSortDialogInitialModel] = useState<SortModelItem[]>([]);
  const [filterDialogModelSnapshot, setFilterDialogModelSnapshot] = useState<any>(null);

  // view management (toolbar UI state)
  const [viewName, setViewName] = useState<string>('');
  const [selectedView, setSelectedView] = useState<string>('');

  // columns dialog
  const [propertySearch, setPropertySearch] = useState('');
  const [showVisibleOnly, setShowVisibleOnly] = useState(false);

  const manualSelectedCellKeySet = useMemo(
    () => new Set(manualSelectedCells.map((cell) => `${cell.rowIndex}::${cell.colId}`)),
    [manualSelectedCells],
  );

  useEffect(() => {
    let cancelled = false;
    const registerEnterpriseCellSelection = async () => {
      try {
        const enterpriseModuleName = 'ag-grid-' + 'enterprise';
        const enterprise: any = await import(/* @vite-ignore */ enterpriseModuleName);
        const cellSelectionModule = enterprise?.CellSelectionModule;
        if (cellSelectionModule) {
          ModuleRegistry.registerModules([cellSelectionModule]);
          if (!cancelled) setIsCellSelectionAvailable(true);
        }
      } catch (_) {
        if (!cancelled) setIsCellSelectionAvailable(false);
      }
    };

    registerEnterpriseCellSelection();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!multiSelection) setShowSelectAllHeaderCheckbox(false);
  }, [multiSelection]);

  useEffect(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    const id = requestAnimationFrame(() => {
      api.refreshHeader();
    });
    return () => cancelAnimationFrame(id);
  }, [showSelectAllHeaderCheckbox]);

  useEffect(() => {
    if (copyMode !== 'cells' || !showCopyActions) {
      setManualSelectedCells([]);
      setCellRangeSelectionActive(false);
    }
  }, [copyMode, showCopyActions]);

  useEffect(() => {
    if (!isCellSelectionAvailable) {
      setCellRangeSelectionActive(false);
    }
  }, [isCellSelectionAvailable]);

  useEffect(() => {
    if (!showCopyActions) {
      setManualSelectedCells([]);
      setCellRangeSelectionActive(false);
      if (isCellSelectionAvailable) {
        (gridRef.current?.api as any)?.clearCellSelection?.();
      }
      gridRef.current?.api?.refreshCells({ force: true });
    }
  }, [showCopyActions, isCellSelectionAvailable]);

  useEffect(() => {
    if (copyMode !== 'cells' || isCellSelectionAvailable || !showCopyActions) return;
    gridRef.current?.api?.refreshCells({ force: true });
  }, [copyMode, isCellSelectionAvailable, manualSelectedCells, showCopyActions]);

  /** After copy mode changes, restore grid cell focus so Ctrl+C works without re-clicking (dialog steals focus; row # col has no `field`). */
  useEffect(() => {
    if (!showCopyActions || copyMode === 'none') return;
    const api = gridRef.current?.api;
    if (!api) return;
    const t = window.setTimeout(() => {
      const selected = api.getSelectedNodes().filter((n: any) => n?.data);
      if (!selected.length) return;
      const rowIndex = selected[selected.length - 1]?.rowIndex;
      if (typeof rowIndex !== 'number') return;
      const col = getFirstDataColumnForCopy(api);
      if (!col) return;
      // Rows mode uses selection for TSV; single-row has no multi checkbox flow. Cells mode needs a focused data cell.
      if (copyMode === 'rows' && !multiSelection) return;
      api.setFocusedCell(rowIndex, col);
    }, 0);
    return () => clearTimeout(t);
  }, [copyMode, showCopyActions, multiSelection, isCellSelectionAvailable]);

  // Multi-select only: if "Selected Selection" is cleared externally, clear grid checkboxes.
  // In single-row mode, `currentSelection` may be emptied on row click; must not deselectAll or the highlight is lost.
  // In Cells copy mode, we intentionally clear `currentSelection` but keep grid row selection for context.
  useEffect(() => {
    if (!currentSelectionDS) return;

    const listener = async (/* event */) => {
      if (!multiSelection) return;
      const value = await currentSelectionDS.getValue();
      if (Array.isArray(value) && value.length === 0) {
        if (showCopyActions && copyMode === 'cells') return;
        gridRef.current?.api?.deselectAll();
      }
    };
    listener();
    currentSelectionDS.addListener('changed', listener);
    return () => {
      currentSelectionDS.removeListener('changed', listener);
    };
  }, [currentSelectionDS, multiSelection, copyMode, showCopyActions]);

  //very initial state of columns
  const initialColumnVisibility = useMemo(
    () =>
      columns.map((col) => ({
        field: agGridColumnField(col),
        isHidden: col.hidden || false, // use col.hidden directly from properties
        pinned: null as 'left' | 'right' | null,
      })),
    [columns],
  );

  const [columnVisibility, setColumnVisibility] = useState<any[]>(initialColumnVisibility);
  const [initialColumnState, setInitialColumnState] = useState<any>(null); // Store the initial AG Grid column state

  const rowNumberColDef = useMemo<ColDef>(
    () => ({
      colId: ROW_NUMBER_COL_ID,
      headerName: '#',
      valueGetter: (params) => {
        const idx = params.node?.rowIndex;
        if (typeof idx !== 'number') return '';
        return idx + 1;
      },
      width: 58,
      maxWidth: 72,
      flex: 0,
      minWidth: 48,
      pinned: 'left',
      lockPinned: true,
      lockPosition: 'left',
      suppressMovable: true,
      sortable: false,
      filter: false,
      resizable: false,
      editable: false,
      suppressHeaderMenuButton: true,
      suppressHeaderFilterButton: true,
      cellRenderer: RowNumberCell,
    }),
    [],
  );

  const agGridFilterComponents = useMemo(
    () => ({ qodlyRefSelectFilter: QodlyRefSelectFilter }),
    [],
  );

  const colDefs: ColDef[] = useMemo(() => {
    return columns.map((col) => {
      const stableField = agGridColumnField(col);
      const colState = columnVisibility.find((c) => c.field === stableField) || {
        isHidden: false,
        pinned: null,
      };
      const isBooleanColumn = isBooleanLikeColumn(col);
      const refKey = extractRefDatasetKeyFromSource(col.source);
      const isRefSource = refKey != null;
      return {
        field: stableField,
        headerName: col.title,
        source: col.source,
        hide: colState.isHidden,
        pinned: colState.pinned,
        cellRendererParams: {
          format: col.format,
          dataType: col.dataType,
        },
        cellStyle: (params: any) => {
          if (isCellSelectionAvailable) return undefined;
          const resetStyle = {
            border: '',
            boxSizing: '',
            backgroundColor: '',
          };
          if (!showCopyActions || copyMode !== 'cells') return resetStyle;
          const rowIndex = params?.node?.rowIndex;
          if (typeof rowIndex !== 'number') return resetStyle;
          const key = `${rowIndex}::${params.column.getColId()}`;
          if (!manualSelectedCellKeySet.has(key)) return resetStyle;
          return {
            border: '2px dashed #1d4ed8',
            boxSizing: 'border-box',
            backgroundColor: 'rgba(29, 78, 216, 0.08)',
          };
        },
        lockPosition: col.locked,
        sortable: col.dataType !== 'image' && col.dataType !== 'object' && col.sorting,
        resizable: col.sizing,
        width: col.width,
        flex: col.flex,
        filter: isRefSource ? 'qodlyRefSelectFilter' : getColumnFilterType(col, isBooleanColumn),
        filterParams: isRefSource
          ? {
              refDatasetKey: refKey,
              maxOptions: 256,
              placeholderLabel: translation('Choose one'),
              applyButtonLabel: translation('Apply'),
              resolveOptionLabel: (index: number) => {
                const composite = refOptionI18nCompositeKey(refKey, index);
                const fromLang = lang ? get(i18n, `keys.${composite}.${lang}`) : undefined;
                return String(fromLang ?? get(i18n, `keys.${composite}.default`, '') ?? '');
              },
            }
          : getColumnFilterParams(col, isBooleanColumn),
      };
    });
  }, [
    columns,
    columnVisibility,
    copyMode,
    i18n,
    isCellSelectionAvailable,
    lang,
    manualSelectedCellKeySet,
    showCopyActions,
  ]);

  const gridColumnDefs = useMemo(
    () => (showRowNumbers ? [rowNumberColDef, ...colDefs] : colDefs),
    [showRowNumbers, rowNumberColDef, colDefs],
  );

  const defaultColDef = useMemo<ColDef>(() => {
    return {
      minWidth: 100,
      sortingOrder: ['asc', 'desc'],
      cellRenderer: CustomCell,
    };
  }, []);

  const sortableColumns = useMemo(
    () =>
      columns
        .filter((col) => col.dataType !== 'image' && col.dataType !== 'object' && col.sorting)
        .map((col) => ({
          colId: agGridColumnField(col),
          label: col.title,
        })),
    [columns],
  );

  const statisticsColumns = useMemo(
    () => StatisticCalculations.fromAgGridColumns(columns),
    [columns],
  );

  /** Toolbar column list: show translated `title`, while `field` stays the stable datasource key. */
  const columnLabelByStableField = useMemo(() => {
    const m = new Map<string, string>();
    columns.forEach((c) => {
      m.set(agGridColumnField(c), c.title);
    });
    return m;
  }, [columns]);

  const sortableColIdsRef = useRef<string[]>([]);
  sortableColIdsRef.current = sortableColumns.map((c) => c.colId);

  const viewsManager = useViewsManager({
    viewDs,
    viewsDs,
    gridRef,
    columnsRef,
    emit,
    applyingExternalRef: applyingExternalStateRef,
  });

  const filtersManager = useFiltersManager({
    filterDs,
    filtersDs,
    gridRef,
    emit,
    applyingExternalRef: applyingExternalStateRef,
    dateFinancialEnabledRef,
  });

  const sortsManager = useSortsManager({
    sortDs,
    sortsDs,
    gridRef,
    columnsRef,
    sortableColIdsRef,
    emit,
    applyingExternalRef: applyingExternalStateRef,
  });

  /** Re-apply grid state whenever one of the 3 live datasources changes externally. */
  useEffect(() => {
    if (!viewDs) return;
    const listener = async () => {
      const api = gridRef.current?.api;
      if (!api) return;
      const data = await viewDs.getValue();
      applyingExternalStateRef.current = true;
      try {
        const applied = viewsManager.applyPersistedValue(api, data);
        if (applied && Array.isArray(data?.columnState)) {
          setColumnVisibility(
            withoutSyntheticRowColumnState(data.columnState).map((col: any) => ({
              field: col.colId,
              isHidden: col.hide || false,
              pinned: col.pinned || null,
            })),
          );
        }
      } finally {
        setTimeout(() => {
          applyingExternalStateRef.current = false;
        }, 0);
      }
    };
    viewDs.addListener('changed', listener);
    return () => {
      viewDs.removeListener('changed', listener);
    };
  }, [viewDs, viewsManager]);

  useEffect(() => {
    if (!filterDs) return;
    const listener = async () => {
      const api = gridRef.current?.api;
      if (!api) return;
      const data = await filterDs.getValue();
      applyingExternalStateRef.current = true;
      try {
        filtersManager.applyPersistedValue(api, data);
        api.refreshInfiniteCache();
      } finally {
        setTimeout(() => {
          applyingExternalStateRef.current = false;
        }, 0);
      }
    };
    filterDs.addListener('changed', listener);
    return () => {
      filterDs.removeListener('changed', listener);
    };
  }, [filterDs, filtersManager]);

  useEffect(() => {
    if (!sortDs) return;
    const listener = async () => {
      const api = gridRef.current?.api;
      if (!api) return;
      const data = await sortDs.getValue();
      applyingExternalStateRef.current = true;
      try {
        sortsManager.applyPersistedValue(api, data);
      } finally {
        setTimeout(() => {
          applyingExternalStateRef.current = false;
        }, 0);
      }
    };
    sortDs.addListener('changed', listener);
    return () => {
      sortDs.removeListener('changed', listener);
    };
  }, [sortDs, sortsManager]);

  const theme = themeQuartz.withParams({
    spacing,
    accentColor,
    backgroundColor,
    textColor,
    fontSize,
    oddRowBackgroundColor,
    borderColor,
    rowBorder,
    columnBorder,
    wrapperBorderRadius,
    headerBackgroundColor,
    headerTextColor,
    headerColumnBorder,
    headerVerticalPaddingScale,
    headerFontSize,
    headerFontWeight,
    cellHorizontalPaddingScale,
    rowVerticalPaddingScale,
    iconSize,
    foregroundColor: textColor,
    borderRadius: wrapperBorderRadius,
    rangeSelectionBorderColor: !enableCellFocus ? 'transparent' : undefined,
  });

  const getRowClass = useCallback(
    (params: RowClassParams) => {
      if (!rowCssField || !params.data) return '';
      const value =
        params.data.__entity?.[rowCssField] ??
        findAgGridRowCssValue(params.data, rowCssField, columns);
      if (value === undefined || value === null || value === '') return '';
      const sanitized = String(value)
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .toLowerCase();
      return `aggrid-row-${sanitized}`;
    },
    [rowCssField, columns],
  );

  const { updateCurrentDsValue } = useDsChangeHandler({
    source: ds,
    currentDs: currentElement,
    selected,
    setSelected,
    scrollIndex: scrollIndex,
    setScrollIndex,
    setCount,
    fetchIndex,

    onDsChange: ({ length, selected }) => {
      if (!gridRef.current) return;
      // Keep user view/sort/filter state when datasource changes (e.g. sort requests).
      setManualSelectedCells([]);
      gridRef.current.api.deselectAll();
      gridRef.current.api.refreshInfiniteCache();
      if (multiSelection && gridRef.current.api.getSelectedNodes().length > 0) {
        gridRef.current.api.deselectAll();
      }
      if (selected >= 0) {
        updateCurrentDsValue({
          index: selected < length ? selected : 0,
          forceUpdate: true,
        });
      }
    },
    onCurrentDsChange: (selected) => {
      if (!gridRef.current) return;
      const rowNode = gridRef.current.api?.getRowNode(selected.toString());
      gridRef.current.api?.ensureIndexVisible(selected);
      rowNode?.setSelected(true);
      entitySubject.next({
        action: EntityActions.UPDATE,
        payload: {
          nodeID,
          rowIndex: selected,
        },
      });
    },
  });

  const focusRowForCopy = useCallback(
    (api: GridApi | undefined, rowIndex: number) => {
      if (!api || !showCopyActions || copyMode !== 'rows' || rowIndex < 0) return;
      const col = getFirstDataColumnForCopy(api);
      if (!col) return;
      api.setFocusedCell(rowIndex, col);
    },
    [copyMode, showCopyActions],
  );

  const onRowClicked = useCallback(
    async (event: any) => {
      if (!ds) return;
      if (multiSelection) {
        event.node?.setSelected(true, false);
        focusRowForCopy(event.api ?? gridRef.current?.api, event.rowIndex);
        emit('onrowclick');
        return;
      }
      if (currentSelectionDS) {
        await currentSelectionDS.setValue(null, []);
      }
      await updateCurrentDsValue({
        index: event.rowIndex,
      });
      focusRowForCopy(event.api ?? gridRef.current?.api, event.rowIndex);
      emit('onrowclick');
    },
    [ds, multiSelection, currentSelectionDS, updateCurrentDsValue, emit, focusRowForCopy],
  );

  const onRowDoubleClicked = useCallback(
    async (event: any) => {
      if (!ds) return;
      if (multiSelection) {
        const api = event.api ?? gridRef.current?.api;
        api?.deselectAll();
        event.node?.setSelected(true, false);
        if (currentSelectionDS) {
          await currentSelectionDS.setValue(null, event.data ? [sanitizeRow(event.data)] : []);
        }
      } else if (currentSelectionDS) {
        await currentSelectionDS.setValue(null, []);
      }
      await updateCurrentDsValue({
        index: event.rowIndex,
        forceUpdate: true,
      });
      emit('onrowdblclick');
    },
    [ds, multiSelection, currentSelectionDS, updateCurrentDsValue, emit],
  );

  const onCellClicked = useCallback(
    (event: any) => {
      if (!ds) return;

      if (showCopyActions && copyMode === 'cells' && !isCellSelectionAvailable) {
        const rowIndex = event?.node?.rowIndex;
        const colId = event?.column?.getColId?.();
        if (typeof rowIndex === 'number' && colId) {
          const headerName = String(event?.colDef?.headerName ?? colId);
          setManualSelectedCells((prev) => {
            const key = `${rowIndex}::${colId}`;
            const exists = prev.some((cell) => `${cell.rowIndex}::${cell.colId}` === key);
            if (exists) {
              return prev.filter((cell) => `${cell.rowIndex}::${cell.colId}` !== key);
            }
            return [...prev, { rowIndex, colId, headerName, value: event?.value }];
          });
        }
      }

      emit('oncellclick', {
        column: event.column.getColId(),
        value: event.value,
      });
    },
    [ds, copyMode, isCellSelectionAvailable, showCopyActions],
  );

  const onCellDoubleClicked = useCallback((event: any) => {
    if (!ds) return;
    emit('oncelldblclick', {
      column: event.column.getColId(),
      value: event.value,
    });
  }, []);

  const onHeaderClicked = useCallback((event: any) => {
    emit('onheaderclick', {
      column: event.column,
    });
  }, []);

  const onCellMouseOver = useCallback((event: any) => {
    emit('oncellmouseover', {
      column: event.column.getColId(),
      value: event.value,
    });
  }, []);

  const onCellMouseOut = useCallback((event: any) => {
    emit('oncellmouseout', {
      column: event.column.getColId(),
      value: event.value,
    });
  }, []);

  const onCellMouseDown = useCallback((event: any) => {
    emit('oncellmousedown', {
      column: event.column.getColId(),
      value: event.value,
    });
  }, []);

  const handleCopyShortcut = useCallback(
    (event: any, api: GridApi): boolean => {
      if (!isCopyShortcut(event)) return false;
      if (!showCopyActions) return false;

      if (copyMode === 'none') {
        return false;
      }

      if (copyMode === 'rows') {
        event.preventDefault?.();
        event.stopPropagation?.();
        const text = buildSelectedRowsClipboardText(api);
        if (!text) return true;
        void writeTextToClipboard(text);
        return true;
      }

      if (copyMode === 'cells') {
        event.preventDefault?.();
        event.stopPropagation?.();
        let text = '';
        if (isCellSelectionAvailable) {
          text = buildSelectedCellRangesClipboardText(api);
        }
        if (!text && manualSelectedCells.length > 0) {
          text = buildManualSelectedCellsClipboardText(manualSelectedCells, api);
        }
        if (!text) {
          text = buildFocusedCellClipboardText(api);
        }
        if (!text) return true;
        void writeTextToClipboard(text);
        return true;
      }

      return false;
    },
    [copyMode, multiSelection, isCellSelectionAvailable, manualSelectedCells, showCopyActions],
  );

  const onCellKeyDown = useCallback(
    (event: any) => {
      emit('oncellkeydown', {
        column: event.column.getColId(),
        value: event.value,
        key: event.event.key,
      });
    },
    [emit],
  );

  const onSelectionChanged = useCallback(
    async (event: any) => {
      const api = event.api;
      const selectedNodes = api.getSelectedNodes();

      if (showCopyActions && copyMode === 'rows' && selectedNodes.length > 0) {
        const rowIndex = selectedNodes[selectedNodes.length - 1]?.rowIndex;
        if (typeof rowIndex === 'number') {
          focusRowForCopy(api, rowIndex);
        }
      }

      if (multiSelection) {
        // Cells copy mode uses row checkboxes for range context only; do not drive Selected Selection.
        if (currentSelectionDS && copyMode !== 'cells') {
          const sanitized = selectedNodes.map((n: any) => sanitizeRow(n.data || {}));
          await currentSelectionDS.setValue(null, sanitized);
        }
      }
    },
    [copyMode, focusRowForCopy, multiSelection, currentSelectionDS, showCopyActions],
  );

  /** Push the current column / filter / sort state to their respective live datasources. */
  const persistGridState = useCallback(
    (columnState: any[], filterModel: any, sortModel: SortModelItem[]) => {
      viewsManager.persistCurrent(columnState);
      filtersManager.persistCurrent(filterModel);
      sortsManager.persistCurrent(sortModel);
    },
    [viewsManager, filtersManager, sortsManager],
  );

  /** Extra control in the column filter footer (built-in Apply/Reset cannot clear other columns). */
  const postProcessPopup = useCallback(
    (params: PostProcessPopupParams) => {
      const panel = params.ePopup.querySelector<HTMLElement>('.ag-filter-apply-panel');
      if (!panel || !params.ePopup.querySelector('.ag-filter')) return;
      attachColumnFilterNestedSelectPopupWorkaround(params.ePopup);
      if (panel.querySelector('[data-qodly-clear-all-filters-button]')) return;

      const financialDate = dateFinancialRef.current;
      if (financialDate && !params.ePopup.querySelector('[data-qodly-date-financial-row]')) {
        const labelText = get(
          i18n,
          `keys.filter_by_fiscal_year.${lang}`,
          get(i18n, 'keys.filter_by_fiscal_year.default', 'Filtrer sur exercice(s)'),
        );

        const row = document.createElement('div');
        row.setAttribute('data-qodly-date-financial-row', '1');
        Object.assign(row.style, {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: '8px',
          padding: '10px 16px',
          borderTop: '1px solid rgb(229, 231, 235)',
          fontSize: '12px',
          color: 'rgb(68, 68, 76)',
        });

        const labelEl = document.createElement('label');
        Object.assign(labelEl.style, {
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          cursor: 'pointer',
          margin: '0',
          userSelect: 'none',
        });

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = Boolean(dateFinancialEnabledRef.current);

        const span = document.createElement('span');
        span.textContent = String(labelText);

        labelEl.appendChild(input);
        labelEl.appendChild(span);
        row.appendChild(labelEl);

        // Do NOT apply immediately; only sync this control when the user clicks the filter Apply button.
        input.addEventListener('change', () => {
          // keep UI state only
        });
        panel.parentElement?.insertBefore(row, panel);
      }

      // Hook the built-in filter Apply button so the Date_Financial checkbox is applied only on Apply.
      if (!panel.getAttribute('data-qodly-date-financial-apply-hook')) {
        panel.setAttribute('data-qodly-date-financial-apply-hook', '1');
        panel.addEventListener(
          'click',
          (ev) => {
            const target = ev.target as HTMLElement | null;
            const btnEl = target?.closest?.('button') as HTMLButtonElement | null;
            if (!btnEl) return;
            if (btnEl.getAttribute('data-qodly-clear-all-filters-button')) return;

            const finInput = params.ePopup.querySelector<HTMLInputElement>(
              '[data-qodly-date-financial-row] input[type="checkbox"]',
            );
            if (finInput) {
              dateFinancialEnabledRef.current = Boolean(finInput.checked);
              params.api.refreshInfiniteCache();
              const columnState = withoutSyntheticRowColumnState(params.api.getColumnState());
              const filterModel = params.api.getFilterModel() ?? {};
              const sortModel = buildSortModelFromColumnState(columnState);
              persistGridState(columnState, filterModel, sortModel);
            }
          },
          true,
        );
      }

      Object.assign(panel.style, {
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '8px',
        borderTop: '1px solid rgb(229, 231, 235)',
        padding: '16px',
      });

      const secondaryBtn: Partial<CSSStyleDeclaration> = {
        boxSizing: 'border-box',
        height: '32px',
        borderRadius: '6px',
        fontSize: '12px',
        padding: '0 12px',
        margin: '0px',
        border: '1px solid rgba(0, 0, 0, 0.1)',
        color: 'rgb(68, 68, 76)',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        cursor: 'pointer',
      };

      const primaryBtn: Partial<CSSStyleDeclaration> = {
        boxSizing: 'border-box',
        height: '31px',
        borderRadius: '6px',
        fontSize: '12px',
        padding: '0 12px',
        margin: '0px',
        background: 'rgb(43, 87, 151)',
        color: '#fff',
        border: '1px solid rgb(43, 87, 151)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        cursor: 'pointer',
      };

      panel.querySelectorAll('button').forEach((el) => {
        if (el.getAttribute('data-qodly-clear-all-filters-button')) return;
        Object.assign(el.style, primaryBtn);
      });

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-qodly-clear-all-filters-button', '1');
      btn.textContent = translation('Clear result');
      Object.assign(btn.style, secondaryBtn);

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const { api } = params;
        const filterColId = params.column?.getColId?.();
        // Reset Date_Financial toggle on clear.
        dateFinancialEnabledRef.current = false;
        const finInput = params.ePopup.querySelector<HTMLInputElement>(
          '[data-qodly-date-financial-row] input[type="checkbox"]',
        );
        if (finInput) finInput.checked = false;
        api.setFilterModel(null);
        const columnState = withoutSyntheticRowColumnState(api.getColumnState());
        const filterModel = api.getFilterModel() ?? {};
        const sortModel = buildSortModelFromColumnState(columnState);
        persistGridState(columnState, filterModel, sortModel);
        scheduleReopenColumnFilterAfterClear(api, filterColId);
      });

      panel.insertBefore(btn, panel.firstChild);
    },
    [i18n, lang, persistGridState, translation],
  );

  const onStateUpdated = useCallback(
    (params: StateUpdatedEvent) => {
      if (params.sources.length === 1 && params.sources.includes('rowSelection')) return; // to avoid multiple triggers when selecting a row
      if (applyingExternalStateRef.current) return;
      if (params.type === 'stateUpdated' && !params.sources.includes('gridInitializing')) {
        const columnState = withoutSyntheticRowColumnState(params.api.getColumnState());
        const filterModel = params.api.getFilterModel();
        const sortModel = buildSortModelFromColumnState(columnState);
        persistGridState(columnState, filterModel, sortModel);
      }
    },
    [persistGridState],
  );

  const onFilterChanged = useCallback((event: FilterChangedEvent) => {
    event.api.refreshInfiniteCache();
  }, []);

  const getState = useCallback(
    async (params: any) => {
      const api: GridApi = params.api;
      let applied = false;

      if (viewDs) {
        try {
          const value = await viewDs.getValue();
          if (viewsManager.applyPersistedValue(api, value)) {
            applied = true;
            if (value && Array.isArray(value.columnState)) {
              setColumnVisibility(
                withoutSyntheticRowColumnState(value.columnState).map((col: any) => ({
                  field: col.colId,
                  isHidden: col.hide || false,
                  pinned: col.pinned || null,
                })),
              );
            }
          }
        } catch {
          /* ignore */
        }
      }

      if (filterDs) {
        try {
          const value = await filterDs.getValue();
          filtersManager.applyPersistedValue(api, value);
        } catch {
          /* ignore */
        }
      }

      if (sortDs) {
        try {
          const value = await sortDs.getValue();
          sortsManager.applyPersistedValue(api, value);
        } catch {
          /* ignore */
        }
      }

      if (!applied) {
        const columnState = withoutSyntheticRowColumnState(api.getColumnState());
        const filterModel = api.getFilterModel() ?? {};
        const sortModel = buildSortModelFromColumnState(columnState);
        prevSortModelRef.current = sortModel;
        persistGridState(columnState, filterModel, sortModel);
      } else {
        prevSortModelRef.current = buildSortModelFromColumnState(api.getColumnState());
      }
    },
    [viewDs, filterDs, sortDs, viewsManager, filtersManager, sortsManager, persistGridState],
  );

  const applySorting = useCallback(
    async (params: IGetRowsParams, cols: IColumn[], activeDs: any) => {
      if (params.sortModel.length === 0) {
        prevSortModelRef.current = [];
        return;
      }
      if (isEqual(params.sortModel, prevSortModelRef.current)) {
        return;
      }

      const sortInstructions = params.sortModel
        .map((rule) => {
          const matchedColumn = cols.find(
            (column) => column.title === rule.colId || column.source === rule.colId,
          );
          if (!matchedColumn?.source || !rule.sort) return '';
          return `${matchedColumn.source} ${rule.sort}`;
        })
        .filter(Boolean);

      if (!sortInstructions.length) {
        return;
      }
      prevSortModelRef.current = params.sortModel;
      const orderBy = sortInstructions.join(', ');
      await activeDs.orderBy(orderBy);
    },
    [],
  );

  // (fix bug when calling 4d function on aggrid that displayes related values)
  // sanitize values to plain JSON-safe primitives/objects to avoid circular refs
  const sanitizeValue = (v: any): any => {
    if (v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      return v;
    }
    if (v instanceof Date) return v.toISOString();

    if (Array.isArray(v)) return v.map(sanitizeValue);

    if (typeof v === 'object') {
      // Entity-like object: return key or minimal id if available
      // shallow copy of primitive props only
      const out: any = {};
      Object.keys(v).forEach((k) => {
        const val = v[k];
        if (val === null || val === undefined) out[k] = val;
        else if (['string', 'number', 'boolean'].includes(typeof val)) out[k] = val;
        else if (val instanceof Date) out[k] = val.toISOString();
      });
      return out;
    }
    return String(v);
  };

  const sanitizeRow = (row: any) => {
    const result: any = {};
    (columns || []).forEach((col: any) => {
      const key = col.source ?? col.title;
      const stable = agGridColumnField(col);
      const raw = row?.[stable] ?? row?.[col.title] ?? row?.__entity?.[col.source];
      result[key] = sanitizeValue(raw);
    });
    return result;
  };

  const prevCopyModeRef = useRef<CopyMode | null>(null);
  useEffect(() => {
    if (!showCopyActions || !currentSelectionDS) {
      prevCopyModeRef.current = copyMode;
      return;
    }

    const prev = prevCopyModeRef.current;
    prevCopyModeRef.current = copyMode;

    let cancel: (() => void) | undefined;

    // Cells: always clear Selected Selection when entering this mode (defer so it wins over grid churn).
    if (copyMode === 'cells' && prev !== 'cells') {
      const t = window.setTimeout(() => {
        void currentSelectionDS.setValue(null, []);
      }, 0);
      cancel = () => clearTimeout(t);
    } else if (copyMode === 'rows' && prev !== 'rows' && multiSelection) {
      // Rows: never push [] on mode change — that was wiping Selected Selection. Only sync when grid has rows checked.
      const t = window.setTimeout(() => {
        const api = gridRef.current?.api;
        if (!api) return;
        const selectedNodes = api.getSelectedNodes().filter((n: any) => n?.data);
        if (selectedNodes.length === 0) return;
        const sanitized = selectedNodes.map((n: any) => sanitizeRow(n.data || {}));
        void currentSelectionDS.setValue(null, sanitized);
      }, 0);
      cancel = () => clearTimeout(t);
    }

    return () => cancel?.();
  }, [copyMode, showCopyActions, currentSelectionDS, multiSelection, columns]);

  const onGridKeyDownCapture = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (isEditableTarget(event.target)) return;

      const api = gridRef.current?.api;
      if (!api) return;
      handleCopyShortcut(event, api);
    },
    [handleCopyShortcut],
  );

  const syncCellRangeSelectionFromApi = useCallback(() => {
    const api = gridRef.current?.api;
    if (!api || typeof (api as any).getCellRanges !== 'function') {
      setCellRangeSelectionActive(false);
      return;
    }
    const ranges = (api as any).getCellRanges() as unknown[] | null;
    setCellRangeSelectionActive(Array.isArray(ranges) && ranges.length > 0);
  }, []);

  const onCellSelectionChanged = useCallback(() => {
    if (!showCopyActions || !isCellSelectionAvailable || copyMode !== 'cells') return;
    syncCellRangeSelectionFromApi();
  }, [copyMode, isCellSelectionAvailable, showCopyActions, syncCellRangeSelectionFromApi]);

  const clearCopyCellsSelection = useCallback(() => {
    if (isCellSelectionAvailable) {
      (gridRef.current?.api as any)?.clearCellSelection?.();
      setCellRangeSelectionActive(false);
    } else {
      setManualSelectedCells([]);
    }
  }, [isCellSelectionAvailable]);

  const fetchData = useCallback(async (fetchCallback: any, params: IGetRowsParams) => {
    const count = params.endRow - params.startRow;
    const cols = columnsRef.current;
    const entities = await fetchCallback(params.startRow, count);
    const rowData = entities.map((data: any) => {
      const row: any = {
        __entity: data,
      };
      cols.forEach((col) => {
        row[agGridColumnField(col)] = data[col.source];
      });
      return row;
    });
    return { entities, rowData };
  }, []);

  const getSelectedRow = useCallback(async (api: GridApi) => {
    // select current element
    if (multiSelection) return;
    if (currentElement && selected === -1) {
      try {
        let index = -1;
        if (currentElement.type === 'entity') {
          const entity = (currentElement as any).getEntity();
          if (entity) {
            const pos = entity.getPos();
            const ownerSel = entity.getSelection();
            const sel = (ds as any)?.getSelection();
            if (sel && sel !== ownerSel) {
              // fixes qs#461
              sel.findEntityPosition(entity).then((posInSel: number) => {
                if (posInSel === pos) {
                  const rowNode = api.getRowNode(pos.toString());
                  api.ensureIndexVisible(pos, 'middle');
                  rowNode?.setSelected(true);
                }
              });
            } else {
              index = pos;
            }
          }
        } else if (
          currentElement.type === 'scalar' &&
          currentElement.dataType === 'object' &&
          currentElement.parentSource
        ) {
          index = (currentElement as any).getPos();
        }
        const rowNode = api.getRowNode(index.toString());
        (ds as any)?.getSelection().getServerRef() !==
          (searchDs as any).getSelection().getServerRef() &&
          api.ensureIndexVisible(index, 'middle');
        rowNode?.setSelected(true);
      } catch (e) {
        // proceed
      }
    }
  }, []);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    // save initial column state on first load
    setInitialColumnState(params.api.getColumnState());
    params.api.setGridOption('datasource', {
      getRows: async (rowParams: IGetRowsParams) => {
        const rowFm = rowParams.filterModel ?? {};
        const apiFm = params.api.getFilterModel() ?? {};
        /** Infinite row model can call `getRows` before `rowParams.filterModel` is synced after `refreshInfiniteCache`; `api.getFilterModel()` is the source of truth. */
        const effectiveFilterModel = !isEqual(rowFm, {}) ? rowFm : apiFm;
        const financialDate = dateFinancialRef.current;
        const hasFinancialFilter = financialDate != null && dateFinancialEnabledRef.current;
        const hasColumnFilters = normalizeAgGridFilterModel(effectiveFilterModel) != null;
        const hasActiveFilter = hasColumnFilters || hasFinancialFilter;

        let entities = null;
        let length = 0;
        let rowData: any[] = [];
        const cols = columnsRef.current;
        if (hasActiveFilter) {
          // Unfiltered getRows uses `ds` only; `searchDs.entitysel` would stay narrowed after a prior
          // filter. Re-sync from the main DS so each filter applies to the full current selection.
          if (ds && searchDs) {
            const mainSel = (ds as any).entitysel;
            if (mainSel != null) {
              (searchDs as any).entitysel = mainSel;
            }
          }

          const filterQueries = buildFilterQueries(effectiveFilterModel, cols);
          const extra =
            hasFinancialFilter && financialDate
              ? `Date_Document >= ${format(financialDate, 'yyyy-MM-dd')}`
              : '';
          const queryStr = [...filterQueries.filter(Boolean), extra].filter(Boolean).join(' AND ');

          const { entitysel } = searchDs as any;
          const dataSetName = entitysel?.getServerRef();
          (searchDs as any).entitysel = searchDs.dataclass.query(queryStr, {
            dataSetName,
            filterAttributes: searchDs.filterAttributesText || searchDs._private.filterAttributes,
          });

          await applySorting(rowParams, cols, searchDs);

          const result = await fetchData(fetchClone, rowParams);
          entities = result.entities;
          rowData = result.rowData;
          length = searchDs.entitysel._private.selLength;
        } else {
          await applySorting(rowParams, cols, ds);

          const result = await fetchData(fetchPage, rowParams);
          entities = result.entities;
          rowData = result.rowData;
          length = (ds as any).entitysel._private.selLength;
        }

        if (Array.isArray(entities)) {
          // Only evaluate on the first block: later infinite-range requests can return 0 rows and would
          // incorrectly clear the flag (e.g. rowData.length 0 while length is still the total).
          if (rowParams.startRow === 0) {
            setShowSelectAllHeaderCheckbox(
              multiSelection && length > 0 && rowData.length >= length,
            );
            setDisplayedRecordCount(length);
          }
          rowParams.successCallback(rowData, length);
        } else {
          setShowSelectAllHeaderCheckbox(false);
          rowParams.failCallback();
        }
        getSelectedRow(params.api);
      },
    });
    getState(params);
  }, []);

  const handleColumnToggle = (colField: string) => {
    setColumnVisibility((prev) =>
      prev.map((c) => (c.field === colField ? { ...c, isHidden: !c.isHidden } : c)),
    );
  };

  const resetColumnview = () => {
    setColumnVisibility(initialColumnVisibility);
    setSelectedView('');
    if (initialColumnState && gridRef.current?.api) {
      gridRef.current.api.applyColumnState({ state: initialColumnState, applyOrder: true });
      gridRef.current.api.setFilterModel(null);
      sortsManager.applySortModelToGrid([]);
    }
  };

  const handlePinChange = (colField: string, value: string) => {
    setColumnVisibility((prev) =>
      prev.map((col) => {
        if (col.field !== colField) return col;
        const pinnedValue = value === 'unpinned' ? null : (value as 'left' | 'right');
        return { ...col, pinned: pinnedValue };
      }),
    );
  };

  const openAdvancedSortingDialog = () => {
    const fromGrid = buildSortModelFromColumnState(gridRef.current?.api?.getColumnState());
    setSortDialogInitialModel(
      normalizeSortModel(fromGrid, columnsRef.current, sortableColIdsRef.current),
    );
    setShowSortingDialog(true);
  };

  const openAdvancedFilterDialog = () => {
    setFilterDialogModelSnapshot(gridRef.current?.api?.getFilterModel() ?? {});
    setShowFilterDialog(true);
  };

  const normalizedColumns = useMemo(
    () =>
      columnVisibility.filter(
        (column) =>
          column.field !== 'ag-Grid-SelectionColumn' && column.field !== ROW_NUMBER_COL_ID,
      ),
    [columnVisibility],
  );

  const filteredColumns = useMemo(() => {
    const rawSearch = propertySearch.trim().toLowerCase();
    const compactSearch = rawSearch.replace(/[_\s]+/g, '');

    return [...normalizedColumns]
      .sort((a, b) => {
        const aVisible = !a.isHidden;
        const bVisible = !b.isHidden;
        if (aVisible !== bVisible) return aVisible ? -1 : 1;
        return a.field.localeCompare(b.field);
      })
      .filter((column) => {
        const isVisible = !column.isHidden;
        if (showVisibleOnly && !isVisible) return false;
        if (!rawSearch) return true;

        const displayLabel = columnLabelByStableField.get(column.field) ?? column.field;
        const field = column.field.toLowerCase();
        const label = String(displayLabel).toLowerCase();
        const compactField = field.replace(/[_\s]+/g, '');
        const compactLabel = label.replace(/[_\s]+/g, '');
        return (
          field.includes(rawSearch) ||
          compactField.includes(compactSearch) ||
          label.includes(rawSearch) ||
          compactLabel.includes(compactSearch)
        );
      });
  }, [columnLabelByStableField, normalizedColumns, propertySearch, showVisibleOnly]);

  const setFilteredColumnsVisible = (visible: boolean) => {
    filteredColumns.forEach((column) => {
      const isVisible = !column.isHidden;
      if (isVisible !== visible) {
        handleColumnToggle(column.field);
      }
    });
  };

  const resolvedStyle = useMemo<CSSProperties>(() => {
    const s = { ...style };
    if (s.height === '100%' || s.height === 'auto' || s.height === 'inherit') {
      if (containerHeight && containerHeight > 0) {
        s.height = `${containerHeight}px`;
      } else {
        s.height = '600px';
      }
    }
    return s;
  }, [style, containerHeight]);

  const showAnyToolbarSection =
    showToolbarActions ||
    showToolbarView ||
    showToolbarSorting ||
    showToolbarStatistics ||
    showToolbarSaveView ||
    showToolbarSavedViews;

  const showClearCopyCells =
    showCopyActions &&
    copyMode === 'cells' &&
    (cellRangeSelectionActive || (!isCellSelectionAvailable && manualSelectedCells.length > 0));

  const renderCopyCellsClearButton = () => {
    if (!showCopyActions || !showClearCopyCells) return null;
    return (
      <button
        type="button"
        className="rounded-md border px-2 py-1 text-xs"
        style={{
          height: '31px',
          borderColor: '#0000001A',
          color: '#44444C',
          fontSize: '12px',
          fontWeight: 500,
        }}
        onClick={clearCopyCellsSelection}
      >
        {!isCellSelectionAvailable && manualSelectedCells.length > 0
          ? `${translation('Clear')} (${manualSelectedCells.length})`
          : translation('Clear')}
      </button>
    );
  };

  return (
    <div
      ref={(el) => {
        containerRef.current = el?.parentElement as HTMLDivElement;
        connect(el);
      }}
      style={resolvedStyle}
      className={cn(className, classNames)}
    >
      {datasource ? (
        <div className="flex flex-col gap-2 h-full" onKeyDownCapture={onGridKeyDownCapture}>
          {showCopyActions && !(showColumnActions && showToolbarActions) && (
            <div className="flex items-center gap-2 px-4 pt-1">
              <button
                type="button"
                onClick={() => {
                  setCopyModeDraft(copyMode);
                  setShowCopyModeDialog(true);
                }}
                className="header-button-reload-view inline-flex items-center justify-center rounded-lg border"
                style={{
                  width: '31px',
                  height: '31px',
                  borderRadius: '8px',
                  borderColor: '#0000001A',
                  color: '#44444C',
                }}
                title={`${translation('Copy mode')}: ${copyMode === 'cells' ? translation('Cells') : copyMode === 'rows' ? translation('Rows') : translation('Nothing')}`}
                aria-label={translation('Copy mode')}
              >
                <FaCopy size={14} />
              </button>
              {renderCopyCellsClearButton()}
            </div>
          )}
          {showColumnActions && (
            <>
              {showAnyToolbarSection && (
                <div
                  className="grid-header flex items-start justify-between flex-wrap gap-4 "
                  style={{ boxShadow: '0px 1px 3px 0px rgba(0, 0, 0, 0.1)' }}
                >
                  {/* AGGrid header actions */}
                  {showToolbarActions && (
                    <div className="actions-section flex flex-col gap-2 rounded-lg bg-white px-4 py-2">
                      <span
                        className="actions-title"
                        style={{ color: '#717182', fontWeight: 500, fontSize: '11px' }}
                      >
                        {translation('Actions')}
                      </span>
                      <div className="flex flex-row gap-2">
                        <div className="flex gap-2">
                          <Element id="agGridActions" is={resolver.StyleBox} canvas />
                        </div>
                        <AgGridCalculsStatistique
                          translation={translation}
                          showToolbarStatistics={showToolbarStatistics}
                          statisticsColumns={statisticsColumns}
                          columnsRef={columnsRef}
                          gridRef={gridRef}
                          emit={emit}
                          calculStatistiqueResultDS={
                            calculStatistiqueResultDS as
                              | CalculsStatistiqueResultDatasource
                              | null
                              | undefined
                          }
                        />
                        {showToolbarSorting && (
                          <div className="sorting-section ">
                            <button
                              onClick={openAdvancedSortingDialog}
                              className="header-button-reload-view inline-flex items-center justify-center rounded-lg border"
                              style={{
                                width: '31px',
                                height: '31px',
                                borderRadius: '8px',
                                borderColor: '#0000001A',
                                color: '#44444C',
                              }}
                              title={translation('Advanced sorting')}
                            >
                              <FaSortAmountDown />
                            </button>
                          </div>
                        )}
                        {showToolbarFiltering && (
                          <div className="filtering-section ">
                            <button
                              onClick={openAdvancedFilterDialog}
                              className="header-button-reload-view inline-flex items-center justify-center rounded-lg border"
                              style={{
                                width: '31px',
                                height: '31px',
                                borderRadius: '8px',
                                borderColor: '#0000001A',
                                color: '#44444C',
                              }}
                              title={translation('Advanced filtering')}
                            >
                              <FaFilter />
                            </button>
                          </div>
                        )}
                        {showCopyActions && (
                          <div className="copy-mode-section flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setCopyModeDraft(copyMode);
                                setShowCopyModeDialog(true);
                              }}
                              className="header-button-reload-view inline-flex items-center justify-center rounded-lg border"
                              style={{
                                width: '31px',
                                height: '31px',
                                borderRadius: '8px',
                                borderColor: '#0000001A',
                                color: '#44444C',
                              }}
                              title={`${translation('Copy mode')}: ${copyMode === 'cells' ? translation('Cells') : copyMode === 'rows' ? translation('Rows') : translation('Nothing')}`}
                              aria-label={translation('Copy mode')}
                            >
                              <FaCopy size={14} />
                            </button>
                            {renderCopyCellsClearButton()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-row gap-2 flex-wrap">
                    {showToolbarView && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* columns customizer button */}
                        <div className="customizer-section flex flex-col gap-2 rounded-lg bg-white px-4 py-2">
                          <span
                            className="customizer-title"
                            style={{ color: '#717182', fontWeight: 500, fontSize: '11px' }}
                          >
                            {translation('View')}
                          </span>
                          <div className="flex gap-2">
                            <button
                              className="header-button-customize-view inline-flex items-center justify-center rounded-lg border"
                              style={{
                                width: '31px',
                                height: '31px',
                                borderRadius: '8px',
                                borderColor: '#0000001A',
                                color: '#44444C',
                              }}
                              onClick={() => setShowPropertiesDialog(true)}
                            >
                              <FaTableColumns size={14} />
                            </button>
                            <button
                              className="header-button-reload-view inline-flex items-center justify-center rounded-lg border"
                              style={{
                                width: '31px',
                                height: '31px',
                                borderRadius: '8px',
                                borderColor: '#0000001A',
                                color: '#44444C',
                              }}
                              onClick={() => resetColumnview()}
                            >
                              <FaClockRotateLeft size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* new view section */}
                    {showToolbarSaveView && (
                      <div className="view-management flex flex-row ">
                        <div className="view-section flex flex-col gap-2 rounded-lg bg-white px-4 py-2">
                          <span
                            className="view-title"
                            style={{ color: '#717182', fontWeight: 500, fontSize: '11px' }}
                          >
                            {translation('Save view')}
                          </span>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder={translation('View name')}
                              className="view-input rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-800"
                              value={viewName}
                              onChange={(e: any) => {
                                setViewName(e.target.value);
                              }}
                              style={{
                                height: '31px',
                                borderRadius: '6px',
                                borderColor: '#0000001A',
                                color: '#44444C',
                                fontSize: '12px',
                                fontWeight: 500,
                              }}
                            />
                            <button
                              className="header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-800"
                              onClick={() => {
                                if (!viewName.trim()) return;
                                viewsManager.saveView(viewName);
                                setViewName('');
                              }}
                              style={{
                                height: '31px',
                                borderRadius: '6px',
                                borderColor: '#0000001A',
                                color: '#44444C',
                                fontSize: '12px',
                                fontWeight: 500,
                              }}
                            >
                              {translation('Save new')}
                            </button>
                          </div>
                        </div>
                        {/* saved views section */}
                        {showToolbarSavedViews && (
                          <div className="views-section flex flex-col gap-2 rounded-lg bg-white px-4 py-2">
                            <span
                              className="views-title "
                              style={{ color: '#717182', fontWeight: 500, fontSize: '11px' }}
                            >
                              {translation('Saved views')}
                            </span>
                            <div className="flex gap-2">
                              <select
                                value={selectedView}
                                className="rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-800"
                                onChange={(e: any) => {
                                  const next = e.target.value;
                                  setSelectedView(next);
                                  if (next) viewsManager.loadView(next);
                                }}
                                style={{
                                  height: '31px',
                                  borderRadius: '6px',
                                  borderColor: '#0000001A',
                                  color: '#44444C',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                }}
                              >
                                <option value="">{translation('Select view')}</option>
                                {viewsManager.savedViews.map((savedView) => (
                                  <option key={savedView.name} value={savedView.name}>
                                    {savedView.name}
                                  </option>
                                ))}
                              </select>
                              <button
                                className="header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-800"
                                onClick={() => {
                                  if (!selectedView) return;
                                  viewsManager.updateView(selectedView);
                                }}
                                style={{
                                  height: '31px',
                                  borderRadius: '6px',
                                  borderColor: '#0000001A',
                                  color: '#44444C',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                }}
                              >
                                {translation('Update')}
                              </button>
                              <button
                                className="header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-800"
                                onClick={() => viewsManager.loadViewsList()}
                                style={{
                                  height: '31px',
                                  borderRadius: '6px',
                                  borderColor: '#0000001A',
                                  color: '#44444C',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                }}
                                title={translation('Reload list')}
                              >
                                {translation('Load list')}
                              </button>
                              <button
                                className="header-button-trash inline-flex items-center justify-center rounded-lg border"
                                style={{
                                  width: '31px',
                                  height: '31px',
                                  borderRadius: '8px',
                                  color: '#EC7B80',
                                  borderColor: '#EC7B80',
                                  backgroundColor: '#EC7B8033',
                                }}
                                onClick={() => {
                                  if (!selectedView) return;
                                  viewsManager.deleteView(selectedView);
                                }}
                              >
                                <GoTrash size={14} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* columns customizer dialog */}
                  {showToolbarView && showPropertiesDialog && (
                    <div
                      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                      onClick={() => setShowPropertiesDialog(false)}
                    >
                      <div
                        className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-start justify-between gap-3  px-5 py-4 rounded-t-xl">
                          <div>
                            <h1
                              className="text-sm tracking-wide"
                              style={{ color: '#0A0A0A', fontSize: '21px', fontWeight: 500 }}
                            >
                              {translation('COLUMN STATE')}
                            </h1>
                            <span
                              className="mt-1 block text-sm "
                              style={{ color: '#6B7280', fontSize: '16px' }}
                            >
                              {translation('Show or hide columns for this grid view')}
                            </span>
                          </div>
                          <button
                            className=" inline-flex items-center justify-center"
                            style={{
                              color: '#6A7282',
                            }}
                            onClick={() => setShowPropertiesDialog(false)}
                          >
                            <IoMdClose />
                          </button>
                        </div>
                        <div className="px-5 py-4">
                          <div className="sticky top-0 z-10 bg-white pb-3">
                            <div className="flex flex-row gap-2 md:flex-row md:items-center">
                              <input
                                className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-500"
                                placeholder={translation('Search field')}
                                value={propertySearch}
                                onChange={(e) => setPropertySearch(e.target.value)}
                                style={{
                                  height: '31px',
                                  borderColor: '#0000001A',
                                  borderRadius: '6px',
                                }}
                              />

                              <label
                                className="inline-flex items-center gap-2 whitespace-nowrap text-sm"
                                style={{ color: '#717182', fontSize: '12px', fontWeight: 500 }}
                              >
                                <input
                                  type="checkbox"
                                  checked={showVisibleOnly}
                                  onChange={(e) => setShowVisibleOnly(e.target.checked)}
                                  style={{
                                    height: '12px',
                                    width: '12px',
                                    backgroundColor: '#2b5797',
                                    borderRadius: '4px',
                                  }}
                                />
                                <span>{translation('Visible only')}</span>
                              </label>
                              <div>
                                <button
                                  type="button"
                                  className="rounded-md border  bg-white px-3 py-2 flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
                                  style={{
                                    borderColor: 'rgba(0, 0, 0, 0.1)',
                                    color: '#0A0A0A',
                                    height: '31px',
                                    fontSize: '12px',
                                    fontWeight: 500,
                                  }}
                                  onClick={() => setFilteredColumnsVisible(true)}
                                  disabled={filteredColumns.length === 0}
                                >
                                  {translation('Select all')}
                                </button>
                              </div>
                              <button
                                type="button"
                                className="rounded-md border px-3 flex items-center justify-center py-2 disabled:cursor-not-allowed disabled:opacity-50"
                                style={{
                                  borderColor: '#6B8AD4',
                                  color: '#6B8AD4',
                                  height: '31px',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                }}
                                onClick={() => setFilteredColumnsVisible(false)}
                                disabled={filteredColumns.length === 0}
                              >
                                {translation('Clear all')}
                              </button>
                            </div>
                          </div>
                          {/* <div className="mb-3 flex items-center justify-between text-xs text-slate-600">
                        <div>
                          {translation('Visible')} : {visibleCount} / {normalizedColumns.length}
                        </div>
                        <div>
                          <div>
                            {translation('Showing')}: {filteredColumns.length}
                          </div>
                        </div> 
                      </div> */}

                          <div
                            className="max-h-96 space-y-1 overflow-y-auto rounded-lg border p-2"
                            style={{
                              backgroundColor: '#FAFAFA',
                              borderColor: '#D1D5DC',
                              borderRadius: '10px',
                            }}
                          >
                            {filteredColumns.length === 0 ? (
                              <div className="px-3 py-8 text-center text-sm text-slate-500">
                                {translation('No fields match your filter')}.
                              </div>
                            ) : (
                              filteredColumns.map((column) => {
                                const isVisible = !column.isHidden;
                                return (
                                  <div
                                    key={column.field}
                                    className="flex flex-row items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-100"
                                  >
                                    <label className="inline-flex min-w-0 flex-1 items-center gap-2 text-sm">
                                      <input
                                        type="checkbox"
                                        checked={isVisible}
                                        onChange={() => handleColumnToggle(column.field)}
                                        style={{
                                          height: '12px',
                                          width: '12px',
                                          backgroundColor: '#2b5797',
                                          borderRadius: '4px',
                                        }}
                                      />
                                      <span
                                        className={`truncate ${
                                          isVisible ? 'text-gray-700' : 'text-slate-400'
                                        }`}
                                      >
                                        {columnLabelByStableField.get(column.field) ?? column.field}
                                      </span>
                                    </label>

                                    <select
                                      value={column.pinned || 'unpinned'}
                                      className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                                      style={{ height: '31px' }}
                                      onChange={(e) =>
                                        handlePinChange(column.field, e.target.value)
                                      }
                                    >
                                      <option value="unpinned">{translation('No pin')}</option>
                                      <option value="left">{translation('Pin left')}</option>
                                      <option value="right">{translation('Pin right')}</option>
                                    </select>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {showToolbarSorting && (
                    <SortingDialog
                      open={showSortingDialog}
                      onClose={() => setShowSortingDialog(false)}
                      translation={translation}
                      sortableColumns={sortableColumns}
                      initialSortModel={sortDialogInitialModel}
                      onApply={(model) => {
                        sortsManager.applySortModelToGrid(model);
                      }}
                      onClear={() => {
                        sortsManager.applySortModelToGrid([]);
                      }}
                      savedSorts={sortsManager.savedSorts}
                      saveSort={sortsManager.saveSort}
                      loadSort={sortsManager.loadSort}
                      updateSort={sortsManager.updateSort}
                      deleteSort={sortsManager.deleteSort}
                      loadSortsList={sortsManager.loadSortsList}
                    />
                  )}
                  {showToolbarFiltering && (
                    <FilterDialog
                      open={showFilterDialog}
                      onClose={() => setShowFilterDialog(false)}
                      translation={translation}
                      columns={columns}
                      currentFilterModel={filterDialogModelSnapshot}
                      onClear={() => {
                        gridRef.current?.api?.setFilterModel(null);
                        setFilterDialogModelSnapshot({});
                      }}
                      savedFilters={filtersManager.savedFilters}
                      saveFilter={filtersManager.saveFilter}
                      loadFilter={(key) => {
                        filtersManager.loadFilter(key);
                        setFilterDialogModelSnapshot(
                          gridRef.current?.api?.getFilterModel() ?? {},
                        );
                      }}
                      updateFilter={filtersManager.updateFilter}
                      deleteFilter={filtersManager.deleteFilter}
                      loadFiltersList={filtersManager.loadFiltersList}
                    />
                  )}
                </div>
              )}
            </>
          )}
          {showCopyActions && showCopyModeDialog && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              onClick={() => setShowCopyModeDialog(false)}
            >
              <div
                className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 rounded-t-xl border-b border-slate-200 px-5 py-4">
                  <div>
                    <span
                      className="text-sm tracking-wide"
                      style={{ color: '#0A0A0A', fontSize: '21px', fontWeight: 500 }}
                    >
                      {translation('COPY MODE')}
                    </span>
                    <span
                      className="mt-1 block text-sm"
                      style={{ color: '#4A5565', fontSize: '14px' }}
                    >
                      {translation('Choose how keyboard copy applies to the grid')}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center"
                    style={{ color: '#6A7282' }}
                    onClick={() => setShowCopyModeDialog(false)}
                  >
                    <IoMdClose />
                  </button>
                </div>
                <div className="px-5 py-4">
                  <div className="space-y-2">
                    {(
                      [
                        { value: 'cells' as CopyMode, title: translation('Cells') },
                        { value: 'rows' as CopyMode, title: translation('Rows') },
                        { value: 'none' as CopyMode, title: translation('Nothing') },
                      ] as const
                    ).map((opt) => {
                      const selected = copyModeDraft === opt.value;
                      return (
                        <label
                          key={opt.value}
                          className="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 transition-colors"
                          style={{
                            borderColor: selected ? '#2B5797' : '#E5E7EB',
                            backgroundColor: selected ? '#F3F3F5' : '#FFFFFF',
                          }}
                        >
                          <input
                            type="radio"
                            name="aggrid-copy-mode"
                            style={{ accentColor: '#2B5797' }}
                            checked={selected}
                            onChange={() => setCopyModeDraft(opt.value)}
                          />
                          <span
                            className="min-w-0 flex-1 text-sm font-medium"
                            style={{ color: '#0A0A0A' }}
                          >
                            {opt.title}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div
                  className="flex w-full items-center justify-end gap-2 border-t border-slate-200 p-4"
                  style={{ borderTop: '1px solid #E5E7EB' }}
                >
                  <button
                    type="button"
                    className="flex items-center justify-center rounded-md border px-3 py-2"
                    style={{
                      height: '31px',
                      borderRadius: '6px',
                      borderColor: '#0000001A',
                      color: '#44444C',
                      fontSize: '12px',
                    }}
                    onClick={() => setShowCopyModeDialog(false)}
                  >
                    {translation('Cancel')}
                  </button>
                  <button
                    type="button"
                    className="flex items-center justify-center rounded-md border px-3 py-2 text-sm text-white"
                    style={{
                      background: '#2B5797',
                      height: '31px',
                      fontSize: '12px',
                    }}
                    onClick={() => {
                      const next = copyModeDraft;
                      setCopyMode(next);
                      if (currentSelectionDS && showCopyActions && next === 'cells') {
                        void currentSelectionDS.setValue(null, []);
                      }
                      setShowCopyModeDialog(false);
                    }}
                  >
                    {translation('Apply')}
                  </button>
                </div>
              </div>
            </div>
          )}
          {showRecordCount && (
            <div className="records-count text-sm  flex justify-end gap-2 mt-2 mb-2 pr-4">
              <span style={{ color: '#0A0A0A', fontSize: '12px', fontWeight: 400 }}>
                {displayedRecordCount}
              </span>{' '}
              <span style={{ color: '#717182', fontSize: '12px', fontWeight: 400 }}>
                {translation('records')}
              </span>
            </div>
          )}
          <div className="h-full">
            <AgGridReact
              ref={gridRef}
              columnDefs={gridColumnDefs}
              components={agGridFilterComponents}
              maintainColumnOrder
              defaultColDef={defaultColDef}
              postProcessPopup={postProcessPopup}
              onRowClicked={onRowClicked}
              onSelectionChanged={onSelectionChanged}
              onRowDoubleClicked={onRowDoubleClicked}
              onGridReady={onGridReady}
              onFilterChanged={onFilterChanged}
              rowModelType="infinite"
              rowSelection={{
                mode: multiSelection ? 'multiRow' : 'singleRow',
                enableClickSelection: true,
                enableSelectionWithoutKeys: multiSelection,
                checkboxes: multiSelection,
                copySelectedRows: copyMode === 'rows' && multiSelection,
                ...(multiSelection ? { headerCheckbox: false as const } : {}),
              }}
              selectionColumnDef={selectionColumnDef}
              cellSelection={copyMode === 'cells' && isCellSelectionAvailable}
              copyHeadersToClipboard={true}
              cacheBlockSize={100}
              maxBlocksInCache={10}
              cacheOverflowSize={2}
              maxConcurrentDatasourceRequests={1}
              rowBuffer={0}
              onStateUpdated={onStateUpdated}
              onCellClicked={onCellClicked}
              onCellDoubleClicked={onCellDoubleClicked}
              onColumnHeaderClicked={onHeaderClicked}
              onCellMouseDown={onCellMouseDown}
              onCellMouseOut={onCellMouseOut}
              onCellMouseOver={onCellMouseOver}
              onCellKeyDown={onCellKeyDown}
              onCellSelectionChanged={onCellSelectionChanged}
              getRowClass={getRowClass}
              theme={theme}
              className={cn({ 'pointer-events-none opacity-40': disabled })}
              columnHoverHighlight={enableColumnHover}
            />
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center rounded-lg border bg-purple-400 py-4 text-white">
          <p>Error</p>
        </div>
      )}
    </div>
  );
};

export default AgGrid;
