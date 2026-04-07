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
  isEditableTarget,
  isCopyShortcut,
  type TManualSelectedCell,
  writeTextToClipboard,
} from './AgGrid.clipboard';
import {
  buildFilterQueries,
  getColumnFilterParams,
  getColumnFilterType,
  isBooleanLikeColumn,
} from './AgGrid.filtering';
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  IGetRowsParams,
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
import { Element } from '@ws-ui/craftjs-core';
import { selectResolver } from '@ws-ui/webform-editor';
import { get } from 'lodash';
import { FaTableColumns } from 'react-icons/fa6';
import { FaClockRotateLeft } from 'react-icons/fa6';
import { GoTrash } from 'react-icons/go';
import { IoMdClose } from 'react-icons/io';
import { FaSortAmountDown } from 'react-icons/fa';
import { FaCopy } from 'react-icons/fa6';

ModuleRegistry.registerModules([
  ColumnHoverModule,
  CellStyleModule,
  RowStyleModule,
  RenderApiModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
]);

function findAgGridRowCssValue(data: any, field: string, cols: IColumn[]): any {
  const bySource = cols.find((c) => c.source === field);
  if (bySource && data[bySource.title] !== undefined && data[bySource.title] !== null) {
    return data[bySource.title];
  }
  const byTitle = cols.find((c) => c.title === field);
  if (byTitle) return data[byTitle.title];
  return undefined;
}

function hasMeaningfulColumnState(columnState: unknown): boolean {
  return Array.isArray(columnState) && columnState.length > 0;
}

/** Merge Qodly attribute path onto AG Grid column state (match by colId === column title). */
function enrichColumnStateWithSource(
  columnState: any[] | undefined | null,
  columns: IColumn[],
): any[] {
  if (!Array.isArray(columnState)) return [];
  const byTitle = new Map(columns.map((c) => [c.title, c]));
  return columnState.map((cs: any) => {
    const col = cs?.colId != null ? byTitle.get(cs.colId) : undefined;
    return col?.source != null ? { ...cs, source: col.source } : { ...cs };
  });
}

/** Strip custom keys before applyColumnState (AG Grid only uses its own column state shape). */
function columnStateForAgGridApply(columnState: any[] | undefined | null): any[] {
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
function normalizeAgGridFilterModel(model: any): any {
  if (model == null) return null;
  if (typeof model !== 'object' || Array.isArray(model)) return model;
  return Object.keys(model).length === 0 ? null : model;
}

function applyGridFilterModel(api: GridApi, filterModel: any): void {
  const desired = normalizeAgGridFilterModel(filterModel);
  const current = normalizeAgGridFilterModel(api.getFilterModel());
  if (isEqual(current, desired)) return;
  api.setFilterModel(desired === null ? null : filterModel);
}

/** Toolbar / saved-view row: unify `name` (toolbar) with backend `title` + `id`. */
function normalizeToolbarView(raw: any): any | null {
  if (!raw || typeof raw !== 'object') return null;
  const nameFromName = typeof raw.name === 'string' ? raw.name.trim() : '';
  const nameFromTitle = typeof raw.title === 'string' ? raw.title.trim() : '';
  const nameFromId = raw.id != null && raw.id !== '' ? String(raw.id) : '';
  const name = nameFromName || nameFromTitle || nameFromId;
  if (!name) return null;
  return { ...raw, name };
}

function viewsListFromDatasourceValue(value: unknown): any[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeToolbarView).filter(Boolean);
}

type CopyMode = 'cells' | 'rows' | 'none';

/** Toolbar-saved row or backend metadata (`webListViews`) merged with optional grid snapshot. */
type SavedGridView = {
  name: string;
  title?: string;
  id?: string | number;
  columnState?: any;
  filterModel?: any;
  sortModel?: SortModelItem[];
};

const AgGrid: FC<IAgGridProps> = ({
  datasource,
  columns,
  state = '',
  states = '',
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
  showToolbarSaveView = true,
  showToolbarSavedViews = true,
  className,
  classNames = [],
  showCopyActions,
  showRecordCount = true,
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
      'onsavestate',
      'onloadstate',
      'onupdatestate',
      'ondeletestate',
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
  const gridRef = useRef<AgGridReact>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);

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
  const stateDS = window.DataSource.getSource(state, path);
  const statesDS = states ? window.DataSource.getSource(states, path) : null;
  const currentSelectionDS = window.DataSource.getSource(currentSelection, path);

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
          }
        : undefined,
    [multiSelection, i18n, lang, showSelectAllHeaderCheckbox],
  );

  const [copyMode, setCopyMode] = useState<CopyMode>('cells');
  const [showCopyModeDialog, setShowCopyModeDialog] = useState(false);
  const [copyModeDraft, setCopyModeDraft] = useState<CopyMode>('cells');
  const [manualSelectedCells, setManualSelectedCells] = useState<TManualSelectedCell[]>([]);
  const [cellRangeSelectionActive, setCellRangeSelectionActive] = useState(false);
  const [isCellSelectionAvailable, setIsCellSelectionAvailable] = useState(false);
  const [showPropertiesDialog, setShowPropertiesDialog] = useState(false);
  const [showSortingDialog, setShowSortingDialog] = useState(false);
  // views management
  const [viewName, setViewName] = useState<string>('');
  // view = name + columnState + filterModel + sortModel
  const [savedViews, setSavedViews] = useState<SavedGridView[]>([]);
  const [selectedView, setSelectedView] = useState<string>('');
  const [_advancedSortModel, setAdvancedSortModel] = useState<SortModelItem[]>([]);
  const [sortDialogModel, setSortDialogModel] = useState<SortModelItem[]>([]);

  // dialog
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

  // Load saved views: prefer `states` datasource; migrate legacy `state.savedViews` once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (statesDS) {
        try {
          let list = await statesDS.getValue();
          let views = viewsListFromDatasourceValue(list);
          if (views.length === 0 && stateDS) {
            const st = await stateDS.getValue();
            const legacy = st?.savedViews;
            if (Array.isArray(legacy) && legacy.length > 0) {
              views = viewsListFromDatasourceValue(legacy);
              await statesDS.setValue(null, views);
              if (st && typeof st === 'object') {
                const { savedViews: _removed, ...rest } = st as any;
                await stateDS.setValue(null, rest);
              }
            }
          }
          if (!cancelled) setSavedViews(views);
        } catch {
          if (!cancelled) setSavedViews([]);
        }
      } else if (stateDS) {
        try {
          const data = await stateDS.getValue();
          if (!cancelled && data?.savedViews) setSavedViews(data.savedViews);
        } catch {
          /* ignore */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stateDS, statesDS]);

  // External updates to `states` (e.g. after 4D loadSavedViews).
  useEffect(() => {
    if (!statesDS) return;
    const listener = async () => {
      try {
        const list = await statesDS.getValue();
        setSavedViews(viewsListFromDatasourceValue(list));
      } catch {
        setSavedViews([]);
      }
    };
    statesDS.addListener('changed', listener);
    return () => {
      statesDS.removeListener('changed', listener);
    };
  }, [statesDS]);

  //to deselct if current selection ds value is cleared from outside
  useEffect(() => {
    if (!currentSelectionDS) return;

    const listener = async (/* event */) => {
      const value = await currentSelectionDS.getValue();
      if (value.length === 0) {
        gridRef.current?.api?.deselectAll();
      }
    };
    listener();
    currentSelectionDS.addListener('changed', listener);
    return () => {
      currentSelectionDS.removeListener('changed', listener);
    };
  }, [currentSelectionDS]);

  // Re-apply filterModel when state object is updated externally (e.g. 4D clears filters).
  useEffect(() => {
    if (!stateDS) return;
    const listener = async () => {
      const api = gridRef.current?.api;
      if (!api) return;
      const data = await stateDS.getValue();
      if (data != null && typeof data === 'object' && 'filterModel' in data) {
        applyGridFilterModel(api, data.filterModel);
      }
    };
    stateDS.addListener('changed', listener);
    return () => {
      stateDS.removeListener('changed', listener);
    };
  }, [stateDS]);

  //very initial state of columns
  const initialColumnVisibility = useMemo(
    () =>
      columns.map((col) => ({
        field: col.title,
        isHidden: col.hidden || false, // use col.hidden directly from properties
        pinned: null as 'left' | 'right' | null,
      })),
    [columns],
  );

  const [columnVisibility, setColumnVisibility] = useState<any[]>(initialColumnVisibility);
  const [initialColumnState, setInitialColumnState] = useState<any>(null); // Store the initial AG Grid column state

  const colDefs: ColDef[] = useMemo(() => {
    return columns.map((col) => {
      const colState = columnVisibility.find((c) => c.field === col.title) || {
        isHidden: false,
        pinned: null,
      };
      const isBooleanColumn = isBooleanLikeColumn(col);
      return {
        field: col.title,
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
        filter: getColumnFilterType(col, isBooleanColumn),
        filterParams: getColumnFilterParams(col, isBooleanColumn),
      };
    });
  }, [
    columns,
    columnVisibility,
    copyMode,
    isCellSelectionAvailable,
    manualSelectedCellKeySet,
    showCopyActions,
  ]);

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
          colId: col.title,
          label: col.title,
        })),
    [columns],
  );

  const isSortDirection = useCallback((sort: any): sort is 'asc' | 'desc' => {
    return sort === 'asc' || sort === 'desc';
  }, []);

  const normalizeSortModel = useCallback(
    (sortModel: SortModelItem[] | undefined | null): SortModelItem[] => {
      if (!Array.isArray(sortModel)) return [];
      const seen = new Set<string>();
      const allowedColumns = new Set(sortableColumns.map((column) => column.colId));
      return sortModel
        .filter(
          (rule): rule is SortModelItem =>
            !!rule?.colId && isSortDirection(rule.sort) && allowedColumns.has(rule.colId),
        )
        .filter((rule) => {
          if (seen.has(rule.colId)) return false;
          seen.add(rule.colId);
          return true;
        })
        .map((rule) => ({ colId: rule.colId, sort: rule.sort }));
    },
    [isSortDirection, sortableColumns],
  );

  const buildSortModelFromColumnState = useCallback(
    (columnState: any[] | undefined | null): SortModelItem[] => {
      if (!Array.isArray(columnState)) return [];
      return columnState
        .filter((column) => isSortDirection(column?.sort))
        .sort((a, b) => {
          const aSortIndex =
            typeof a?.sortIndex === 'number' ? a.sortIndex : Number.MAX_SAFE_INTEGER;
          const bSortIndex =
            typeof b?.sortIndex === 'number' ? b.sortIndex : Number.MAX_SAFE_INTEGER;
          return aSortIndex - bSortIndex;
        })
        .map((column) => ({ colId: column.colId, sort: column.sort as 'asc' | 'desc' }));
    },
    [isSortDirection],
  );

  const applySortModelToGrid = useCallback(
    (sortModel: SortModelItem[] | undefined | null, api?: GridApi) => {
      const gridApi = api ?? gridRef.current?.api;
      if (!gridApi) return;
      const normalizedSortModel = normalizeSortModel(sortModel);
      const sortIndexByColId = new Map(
        normalizedSortModel.map((rule, index) => [
          rule.colId,
          { sort: rule.sort, sortIndex: index },
        ]),
      );
      const updatedColumnState = gridApi.getColumnState().map((columnState) => {
        const sortState = sortIndexByColId.get(columnState.colId);
        if (!sortState) {
          return { ...columnState, sort: null, sortIndex: null };
        }
        return {
          ...columnState,
          sort: sortState.sort,
          sortIndex: sortState.sortIndex,
        };
      });
      gridApi.applyColumnState({ state: updatedColumnState, applyOrder: false });
      prevSortModelRef.current = normalizedSortModel;
      setAdvancedSortModel(normalizedSortModel);
      gridApi.refreshInfiniteCache();
    },
    [normalizeSortModel],
  );

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
      const firstColumn = api.getAllDisplayedColumns()?.[0];
      if (!firstColumn) return;
      api.setFocusedCell(rowIndex, firstColumn);
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
      await updateCurrentDsValue({
        index: event.rowIndex,
      });
      focusRowForCopy(event.api ?? gridRef.current?.api, event.rowIndex);
      emit('onrowclick');
    },
    [ds, multiSelection, updateCurrentDsValue, emit, focusRowForCopy],
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
        if (!multiSelection) return true;
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
        if (currentSelectionDS) {
          const sanitized = selectedNodes.map((n: any) => sanitizeRow(n.data || {}));
          await currentSelectionDS.setValue(null, sanitized);
        }
      }
    },
    [copyMode, focusRowForCopy, multiSelection, currentSelectionDS, showCopyActions],
  );

  const persistGridState = useCallback(
    (columnState: any[], filterModel: any, sortModel: SortModelItem[]) => {
      const enriched = enrichColumnStateWithSource(columnState, columnsRef.current);
      if (stateDS) {
        stateDS.getValue().then((currentData: any) => {
          const gridData = {
            ...(currentData && typeof currentData === 'object' ? currentData : {}),
            columnState: enriched,
            filterModel,
            sortModel,
          };
          if (statesDS) {
            delete (gridData as any).savedViews;
          }
          stateDS.setValue(null, gridData);
        });
      }
    },
    [stateDS, statesDS],
  );

  const onStateUpdated = useCallback(
    (params: StateUpdatedEvent) => {
      if (params.sources.length === 1 && params.sources.includes('rowSelection')) return; // to avoid multiple triggers when selecting a row
      if (params.type === 'stateUpdated' && !params.sources.includes('gridInitializing')) {
        const columnState = params.api.getColumnState();
        const filterModel = params.api.getFilterModel();
        const sortModel = buildSortModelFromColumnState(columnState);
        setAdvancedSortModel(sortModel);
        persistGridState(columnState, filterModel, sortModel);
      }
    },
    [buildSortModelFromColumnState, persistGridState],
  );

  const getState = useCallback(
    async (params: any) => {
      let appliedFromStore = false;
      const cols = columnsRef.current;

      const seedInitialPersist = () => {
        const columnState = params.api.getColumnState();
        const filterModel = params.api.getFilterModel() ?? {};
        const sortModel = buildSortModelFromColumnState(columnState);
        setAdvancedSortModel(sortModel);
        prevSortModelRef.current = sortModel;
        persistGridState(columnState, filterModel, sortModel);
      };

      if (stateDS) {
        const dsValue = await stateDS?.getValue();
        let mergedForSort: any[] | null = null;
        if (dsValue && hasMeaningfulColumnState(dsValue.columnState)) {
          appliedFromStore = true;
          mergedForSort = enrichColumnStateWithSource(dsValue.columnState, cols);
          params.api.applyColumnState({
            state: columnStateForAgGridApply(mergedForSort),
            applyOrder: true,
          });
          if (dsValue != null && typeof dsValue === 'object' && 'filterModel' in dsValue) {
            applyGridFilterModel(params.api, dsValue.filterModel);
          }
          const stateSortModel = dsValue.sortModel
            ? normalizeSortModel(dsValue.sortModel)
            : buildSortModelFromColumnState(mergedForSort);
          setAdvancedSortModel(stateSortModel);
          prevSortModelRef.current = stateSortModel;
        } else {
          if (dsValue != null && typeof dsValue === 'object' && 'filterModel' in dsValue) {
            applyGridFilterModel(params.api, dsValue.filterModel);
          }
          if (dsValue?.sortModel) {
            applySortModelToGrid(dsValue.sortModel, params.api);
          }
          const stateSortModel = dsValue?.sortModel
            ? normalizeSortModel(dsValue.sortModel)
            : buildSortModelFromColumnState(params.api.getColumnState());
          setAdvancedSortModel(stateSortModel);
          prevSortModelRef.current = stateSortModel;
        }
        if (!appliedFromStore) {
          seedInitialPersist();
        }
      } else {
        seedInitialPersist();
      }
    },
    [
      applySortModelToGrid,
      buildSortModelFromColumnState,
      normalizeSortModel,
      persistGridState,
      stateDS,
    ],
  );

  const applySorting = useCallback(
    async (params: IGetRowsParams, columns: any[], ds: any) => {
      if (params.sortModel.length === 0) {
        prevSortModelRef.current = [];
        setAdvancedSortModel([]);
        return;
      }
      if (isEqual(params.sortModel, prevSortModelRef.current)) return;

      const sortInstructions = params.sortModel
        .map((sort) => {
          const matchedColumn = columns.find(
            (column) => column.title === sort.colId || column.source === sort.colId,
          );
          if (!matchedColumn?.source || !sort.sort) return '';
          return `${matchedColumn.source} ${sort.sort}`;
        })
        .filter(Boolean);

      if (!sortInstructions.length) return;
      prevSortModelRef.current = params.sortModel;
      setAdvancedSortModel(normalizeSortModel(params.sortModel));
      await ds.orderBy(sortInstructions.join(', '));
    },
    [normalizeSortModel],
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
      const raw = row?.[col.title] ?? row?.__entity?.[col.source];
      result[key] = sanitizeValue(raw);
    });
    return result;
  };

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
    const entities = await fetchCallback(params.startRow, params.endRow - params.startRow);
    const rowData = entities.map((data: any) => {
      const row: any = {
        __entity: data,
      };
      columns.forEach((col) => {
        row[col.title] = data[col.source];
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
        let entities = null;
        let length = 0;
        let rowData: any[] = [];
        if (!isEqual(rowParams.filterModel, {})) {
          // Unfiltered getRows uses `ds` only; `searchDs.entitysel` would stay narrowed after a prior
          // filter. Re-sync from the main DS so each filter applies to the full current selection.
          if (ds && searchDs) {
            const mainSel = (ds as any).entitysel;
            if (mainSel != null) {
              (searchDs as any).entitysel = mainSel;
            }
          }

          const filterQueries = buildFilterQueries(rowParams.filterModel, columns);
          const queryStr = filterQueries.filter(Boolean).join(' AND ');

          const { entitysel } = searchDs as any;
          const dataSetName = entitysel?.getServerRef();
          (searchDs as any).entitysel = searchDs.dataclass.query(queryStr, {
            dataSetName,
            filterAttributes: searchDs.filterAttributesText || searchDs._private.filterAttributes,
          });

          await applySorting(rowParams, columns, searchDs);

          const result = await fetchData(fetchClone, rowParams);
          entities = result.entities;
          rowData = result.rowData;
          length = searchDs.entitysel._private.selLength;
        } else {
          await applySorting(rowParams, columns, ds);

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
      // Clear all filters
      gridRef.current.api.setFilterModel(null);
      applySortModelToGrid([], gridRef.current.api);
    }
    setAdvancedSortModel([]);
  };

  const handlePinChange = (colField: string, value: string) => {
    setColumnVisibility((prev) =>
      prev.map((col) => {
        if (col.field !== colField) return col;
        //  pinnedValue : 'left' | 'right' | null
        const pinnedValue = value === 'unpinned' ? null : (value as 'left' | 'right');
        return {
          ...col,
          pinned: pinnedValue,
        };
      }),
    );
  };

  const openAdvancedSortingDialog = () => {
    const sortModelFromGrid = buildSortModelFromColumnState(gridRef.current?.api?.getColumnState());
    const normalizedSortModel = normalizeSortModel(sortModelFromGrid);
    if (normalizedSortModel.length > 0) {
      setSortDialogModel(normalizedSortModel);
    } else if (sortableColumns.length > 0) {
      setSortDialogModel([{ colId: sortableColumns[0].colId, sort: 'asc' }]);
    } else {
      setSortDialogModel([]);
    }
    setShowSortingDialog(true);
  };

  const addSortLevel = () => {
    if (sortableColumns.length === 0) return;
    setSortDialogModel((prev) => {
      const usedColumns = new Set(prev.map((rule) => rule.colId));
      const nextColumn = sortableColumns.find((column) => !usedColumns.has(column.colId));
      const fallbackColumn = nextColumn ?? sortableColumns[0];
      return [...prev, { colId: fallbackColumn.colId, sort: 'asc' }];
    });
  };

  const removeSortLevel = (indexToDelete: number) => {
    setSortDialogModel((prev) => prev.filter((_, index) => index !== indexToDelete));
  };

  const updateSortLevelColumn = (indexToUpdate: number, colId: string) => {
    setSortDialogModel((prev) =>
      prev.map((rule, index) => (index === indexToUpdate ? { ...rule, colId } : rule)),
    );
  };

  const updateSortLevelDirection = (indexToUpdate: number, sort: 'asc' | 'desc') => {
    setSortDialogModel((prev) =>
      prev.map((rule, index) => (index === indexToUpdate ? { ...rule, sort } : rule)),
    );
  };

  const applyAdvancedSorting = () => {
    applySortModelToGrid(sortDialogModel);
    setShowSortingDialog(false);
  };

  const clearAdvancedSorting = () => {
    setSortDialogModel([]);
    applySortModelToGrid([]);
    setShowSortingDialog(false);
  };

  // views actions
  const saveNewView = () => {
    if (!viewName.trim()) return;
    const rawState = gridRef.current?.api?.getColumnState() ?? [];
    const columnState = enrichColumnStateWithSource(rawState, columnsRef.current);
    const filterModel = gridRef.current?.api?.getFilterModel();
    const sortModel = normalizeSortModel(buildSortModelFromColumnState(columnState));
    const newView = { name: viewName.trim(), columnState, filterModel, sortModel };
    const updatedViews: any = [...savedViews, newView];
    setSavedViews(updatedViews);
    if (statesDS) {
      statesDS.setValue(null, updatedViews);
    }
    if (stateDS) {
      stateDS.getValue().then((currentData: any) => {
        const base = currentData && typeof currentData === 'object' ? { ...currentData } : {};
        if (statesDS) {
          delete (base as any).savedViews;
          stateDS.setValue(null, {
            ...base,
            columnState,
            filterModel,
            sortModel,
          });
        } else {
          stateDS.setValue(null, { ...base, savedViews: updatedViews });
        }
      });
    }
    emit('onsavestate', {
      columnState,
      filterModel,
      sortModel,
      name: newView.name,
      view: newView,
    });
    setViewName('');
  };

  const loadView = () => {
    const view: any = savedViews.find(
      (v) =>
        v.name === selectedView ||
        v.title === selectedView ||
        (v.id != null && String(v.id) === selectedView),
    );
    if (!view) return;
    if (gridRef.current?.api) {
      if (view.columnState) {
        const merged = enrichColumnStateWithSource(view.columnState, columnsRef.current);
        gridRef.current.api.applyColumnState({
          state: columnStateForAgGridApply(merged),
          applyOrder: true,
        });
      }
      // Restore filter model of selected view (including clearing when empty / {})
      if ('filterModel' in view) {
        applyGridFilterModel(gridRef.current.api, view.filterModel);
      }
      if (view.sortModel) {
        applySortModelToGrid(view.sortModel, gridRef.current.api);
      } else if (view.columnState) {
        setAdvancedSortModel(normalizeSortModel(buildSortModelFromColumnState(view.columnState)));
      }
      if (view.columnState) {
        const updatedVisibility = view.columnState.map((col: any) => ({
          field: col.colId,
          isHidden: col.hide || false,
          pinned: col.pinned || null,
        }));
        setColumnVisibility(updatedVisibility);
      }
      emit('onloadstate', {
        columnState: view.columnState,
        filterModel: view.filterModel,
        sortModel: view.sortModel,
        selectedView,
        view,
      });
    }
  };

  /** Emits only — dev removes the row (e.g. server + refresh `states` datasource). */
  const requestDeleteView = () => {
    if (!selectedView.trim()) return;
    const view = savedViews.find(
      (v) =>
        v.name === selectedView ||
        v.title === selectedView ||
        (v.id != null && String(v.id) === selectedView),
    );
    emit('ondeletestate', { selectedView, view });
  };

  const updateView = () => {
    if (!selectedView.trim()) return;
    const rawState = gridRef.current?.api?.getColumnState() ?? [];
    const columnState = enrichColumnStateWithSource(rawState, columnsRef.current);
    const filterModel = gridRef.current?.api?.getFilterModel();
    const sortModel = normalizeSortModel(buildSortModelFromColumnState(columnState));
    const updatedViews = savedViews.map((view) => {
      const matches =
        view.name === selectedView ||
        view.title === selectedView ||
        (view.id != null && String(view.id) === selectedView);
      if (matches) {
        return { ...view, name: view.name || view.title || String(view.id), columnState, filterModel, sortModel };
      }
      return view;
    });
    setSavedViews(updatedViews);
    if (statesDS) {
      statesDS.setValue(null, updatedViews);
    }
    if (stateDS) {
      stateDS.getValue().then((currentData: any) => {
        const base = currentData && typeof currentData === 'object' ? { ...currentData } : {};
        if (statesDS) {
          delete (base as any).savedViews;
          stateDS.setValue(null, {
            ...base,
            columnState,
            filterModel,
            sortModel,
          });
        } else {
          stateDS.setValue(null, { ...base, savedViews: updatedViews });
        }
      });
    }
    const updatedRow = updatedViews.find(
      (v) =>
        v.name === selectedView ||
        v.title === selectedView ||
        (v.id != null && String(v.id) === selectedView),
    );
    emit('onupdatestate', {
      columnState,
      filterModel,
      sortModel,
      selectedView,
      view: updatedRow,
    });
  };

  const normalizedColumns = useMemo(
    () => columnVisibility.filter((column) => column.field !== 'ag-Grid-SelectionColumn'),
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

        const field = column.field.toLowerCase();
        const compactField = field.replace(/[_\s]+/g, '');
        return field.includes(rawSearch) || compactField.includes(compactSearch);
      });
  }, [normalizedColumns, propertySearch, showVisibleOnly]);

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
                              disabled={sortableColumns.length === 0}
                            >
                              <FaSortAmountDown />
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
                              }}
                            />
                            <button
                              className="header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-800"
                              onClick={() => saveNewView()}
                              style={{
                                height: '31px',
                                borderRadius: '6px',
                                borderColor: '#0000001A',
                                color: '#44444C',
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
                                  setSelectedView(e.target.value);
                                }}
                                style={{
                                  height: '31px',
                                  borderRadius: '6px',
                                  borderColor: '#0000001A',
                                  color: '#44444C',
                                }}
                              >
                                <option value="">{translation('Select view')}</option>
                                {savedViews.map((view, _) => (
                                  <option value={view.name}>{view.name}</option>
                                ))}
                              </select>
                              <button
                                className="header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-800"
                                onClick={() => loadView()}
                                style={{
                                  height: '31px',
                                  borderRadius: '6px',
                                  borderColor: '#0000001A',
                                  color: '#44444C',
                                }}
                              >
                                {translation('Load')}
                              </button>
                              <button
                                className="header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-800"
                                onClick={() => updateView()}
                                style={{
                                  height: '31px',
                                  borderRadius: '6px',
                                  borderColor: '#0000001A',
                                  color: '#44444C',
                                }}
                              >
                                {translation('Update')}
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
                                onClick={() => requestDeleteView()}
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
                                        {column.field}
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
                  {showToolbarSorting && showSortingDialog && (
                    <div
                      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                      onClick={() => setShowSortingDialog(false)}
                    >
                      <div
                        className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-start justify-between gap-3 border-b border-slate-200  px-5 py-4 rounded-t-xl">
                          <div>
                            <span
                              className="text-sm tracking-wide"
                              style={{ color: '#0A0A0A', fontSize: '21px', fontWeight: 500 }}
                            >
                              {translation('ADVANCED SORTING')}
                            </span>
                            <span
                              className="mt-1 block text-sm"
                              style={{ color: '#4A5565', fontSize: '14px' }}
                            >
                              {translation(
                                'Choose one or multiple columns and define sort direction for each level',
                              )}
                            </span>
                          </div>
                          <button
                            className=" inline-flex items-center justify-center"
                            style={{
                              color: '#6A7282',
                            }}
                            onClick={() => setShowSortingDialog(false)}
                          >
                            <IoMdClose />
                          </button>
                        </div>
                        <div className="">
                          {sortableColumns.length === 0 ? (
                            <div
                              className=" bg-slate-50 px-3 py-2 "
                              style={{ color: '#4A5565', fontSize: '14px' }}
                            >
                              {translation('No sortable columns are enabled in grid properties')}
                            </div>
                          ) : (
                            <>
                              <div className="px-3 py-2 mb-4 ">
                                <div className="space-y-2 max-h-80 overflow-y-auto">
                                  {sortDialogModel.length === 0 ? (
                                    <div className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600">
                                      {translation('No sort level configured yet')}
                                    </div>
                                  ) : (
                                    sortDialogModel.map((rule, index) => (
                                      <div
                                        key={`${rule.colId}-${index}`}
                                        className="flex items-center gap-2 px-2 py-2"
                                      >
                                        <span
                                          className="w-14"
                                          style={{ color: '#364153', fontSize: '14px' }}
                                        >
                                          {translation('Level')} {index + 1}
                                        </span>
                                        <select
                                          className="min-w-0 flex-1 px-2 py-1"
                                          style={{
                                            backgroundColor: '#F3F3F5',
                                            borderRadius: '8px',
                                            height: '36px',
                                            fontSize: '14px',
                                            width: '256px',
                                          }}
                                          value={rule.colId}
                                          onChange={(e) =>
                                            updateSortLevelColumn(index, e.target.value)
                                          }
                                        >
                                          {sortableColumns.map((column) => (
                                            <option key={column.colId} value={column.colId}>
                                              {column.label}
                                            </option>
                                          ))}
                                        </select>
                                        <select
                                          className="w-28 rounded-md"
                                          style={{
                                            backgroundColor: '#F3F3F5',
                                            borderRadius: '8px',
                                            height: '36px',
                                            width: '128px',
                                            fontSize: '14px',
                                          }}
                                          value={rule.sort}
                                          onChange={(e) =>
                                            updateSortLevelDirection(
                                              index,
                                              (e.target.value as 'asc' | 'desc') || 'asc',
                                            )
                                          }
                                        >
                                          <option value="asc">{translation('Asc')}</option>
                                          <option value="desc">{translation('Desc')}</option>
                                        </select>
                                        <button
                                          type="button"
                                          className=" border bg-white px-2 py-1"
                                          style={{
                                            height: '32px',
                                            borderColor: '#0000001A',
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                          }}
                                          onClick={() => removeSortLevel(index)}
                                        >
                                          {translation('Remove')}
                                        </button>
                                      </div>
                                    ))
                                  )}
                                </div>
                                <div className="mt-3 flex items-center justify-between pb-4">
                                  <button
                                    type="button"
                                    style={{
                                      height: '31px',
                                      borderRadius: '8px',
                                      borderColor: '#0000001A',
                                      color: '#44444C',
                                      fontSize: '12px',
                                      fontWeight: 500,
                                    }}
                                    className="rounded-md border px-3 py-2 flex items-center justify-center"
                                    onClick={addSortLevel}
                                    disabled={sortableColumns.length === 0}
                                  >
                                    {translation('Add level')}
                                  </button>
                                </div>
                              </div>
                              <div
                                className="flex justify-end align-end items-center gap-2 w-full p-4 "
                                style={{ borderTop: '1px solid #E5E7EB' }}
                              >
                                <button
                                  type="button"
                                  className="rounded-md border px-3 py-2 flex items-center justify-center "
                                  style={{
                                    height: '31px',
                                    borderRadius: '6px',
                                    borderColor: '#0000001A',
                                    color: '#44444C',
                                    fontSize: '12px',
                                  }}
                                  onClick={clearAdvancedSorting}
                                >
                                  {translation('Clear')}
                                </button>
                                <button
                                  type="button"
                                  className="rounded-md border  px-3 py-2 text-sm text-white flex text-center items-center justify-center"
                                  onClick={applyAdvancedSorting}
                                  style={{
                                    background: '#2B5797',
                                    height: '31px',
                                    fontSize: '12px',
                                  }}
                                >
                                  {translation('Apply sorting')}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
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
                      setCopyMode(copyModeDraft);
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
              columnDefs={colDefs}
              maintainColumnOrder
              defaultColDef={defaultColDef}
              onRowClicked={onRowClicked}
              onSelectionChanged={onSelectionChanged}
              onRowDoubleClicked={onRowDoubleClicked}
              onGridReady={onGridReady}
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
