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
  FC,
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AgGridReact } from 'ag-grid-react';
import { IAgGridProps } from './AgGrid.config';
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
  RenderApiModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  themeQuartz,
} from 'ag-grid-community';
import isEqual from 'lodash/isEqual';
import cloneDeep from 'lodash/cloneDeep';
import CustomCell from './CustomCell';
import { Element } from '@ws-ui/craftjs-core';
import { selectResolver } from '@ws-ui/webform-editor';
import { get } from 'lodash';
import { FaTableColumns } from "react-icons/fa6";
import { FaClockRotateLeft } from "react-icons/fa6";
import { GoTrash } from "react-icons/go";
import { IoMdClose } from 'react-icons/io';

ModuleRegistry.registerModules([
  ColumnHoverModule,
  CellStyleModule,
  RenderApiModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
]);

const AgGrid: FC<IAgGridProps> = ({
  datasource,
  columns,
  state = '',
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
  style,
  disabled = false,
  saveLocalStorage,
  showColumnActions,
  className,
  classNames = [],
  showCopyActions,
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
    ],
  });
  const { resolver } = useEnhancedEditor(selectResolver);
  const {
    sources: { datasource: ds, currentElement },
  } = useSources({ acceptIteratorSel: true });
  const { id: nodeID } = useEnhancedNode();
  const prevSortModelRef = useRef<SortModelItem[]>([]);
  const gridRef = useRef<AgGridReact>(null);

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
  const currentSelectionDS = window.DataSource.getSource(currentSelection, path);

  const [selected, setSelected] = useState(-1);
  const [scrollIndex, setScrollIndex] = useState(0);
  const [_count, setCount] = useState(0);
  const [copyMode, setCopyMode] = useState<'cells' | 'rows'>('cells');
  const [manualSelectedCells, setManualSelectedCells] = useState<TManualSelectedCell[]>([]);
  const [isCellSelectionAvailable, setIsCellSelectionAvailable] = useState(false);
  const [showPropertiesDialog, setShowPropertiesDialog] = useState(false);
  // views management
  const [viewName, setViewName] = useState<string>('');
  // view = name + columnState
  const [savedViews, setSavedViews] = useState<{ name: string; columnState?: any }[]>([]);
  const [selectedView, setSelectedView] = useState<string>('');

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
    if (copyMode !== 'cells') {
      setManualSelectedCells([]);
    }
  }, [copyMode]);

  useEffect(() => {
    if (copyMode !== 'cells' || isCellSelectionAvailable) return;
    gridRef.current?.api?.refreshCells({ force: true });
  }, [copyMode, isCellSelectionAvailable, manualSelectedCells]);

  // Load saved views from localStorage/stateDS on init
  useEffect(() => {
    if (saveLocalStorage) {
      const stored = localStorage.getItem(`savedViews_${nodeID}`);
      if (stored) {
        setSavedViews(JSON.parse(stored));
      }
    } else if (stateDS) {
      // Load from stateDS the saved views
      stateDS.getValue().then((data: any) => {
        if (data && data.savedViews) {
          setSavedViews(data.savedViews);
        }
      });
    }
  }, []);

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
          if (copyMode !== 'cells') return resetStyle;
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
  }, [columns, columnVisibility, copyMode, isCellSelectionAvailable, manualSelectedCellKeySet]);

  const defaultColDef = useMemo<ColDef>(() => {
    return {
      minWidth: 100,
      sortingOrder: ['asc', 'desc'],
      cellRenderer: CustomCell,
    };
  }, []);

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
      if (!api || copyMode !== 'rows' || rowIndex < 0) return;
      const firstColumn = api.getAllDisplayedColumns()?.[0];
      if (!firstColumn) return;
      api.setFocusedCell(rowIndex, firstColumn);
    },
    [copyMode],
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

      if (copyMode === 'cells' && !isCellSelectionAvailable) {
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
    [ds, copyMode, isCellSelectionAvailable],
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
    [copyMode, multiSelection, isCellSelectionAvailable, manualSelectedCells],
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

      if (copyMode === 'rows' && selectedNodes.length > 0) {
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
    [copyMode, focusRowForCopy, multiSelection, currentSelectionDS],
  );

  const onStateUpdated = useCallback((params: StateUpdatedEvent) => {
    if (params.sources.length === 1 && params.sources.includes('rowSelection')) return; // to avoid multiple triggers when selecting a row
    if (params.type === 'stateUpdated' && !params.sources.includes('gridInitializing')) {
      const columnState = params.api.getColumnState();
      const filterModel = params.api.getFilterModel();
      if (saveLocalStorage) {
        localStorage.setItem(`gridState_${nodeID}`, JSON.stringify({ columnState, filterModel }));
      } else if (stateDS) {
        // Save combined data to stateDS
        stateDS.getValue().then((currentData: any) => {
          const gridData = {
            ...currentData,
            columnState,
            filterModel,
          };
          stateDS.setValue(null, gridData);
        });
      }
      emit('onsavestate', { columnState, filterModel });
    }
  }, []);

  const getState = useCallback(async (params: any) => {
    if (saveLocalStorage) {
      const storedState = localStorage.getItem(`gridState_${nodeID}`);
      if (storedState) {
        const parsedState = JSON.parse(storedState);
        if (parsedState?.columnState) {
          params.api.applyColumnState({ state: parsedState.columnState, applyOrder: true });
        }
        if (parsedState?.filterModel) {
          params.api.setFilterModel(parsedState.filterModel);
        }
      }
    } else if (stateDS) {
      const dsValue = await stateDS?.getValue();
      if (dsValue && dsValue.columnState) {
        params.api.applyColumnState({ state: dsValue.columnState, applyOrder: true });
        if (dsValue.filterModel) {
          params.api.setFilterModel(dsValue.filterModel);
        }
      }
    }
  }, []);

  const applySorting = useCallback(async (params: IGetRowsParams, columns: any[], ds: any) => {
    if (params.sortModel.length === 0) {
      prevSortModelRef.current = [];
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
    await ds.orderBy(sortInstructions.join(', '));
  }, []);

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
          rowParams.successCallback(rowData, length);
        } else {
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
    }
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

  // views actions
  const saveNewView = () => {
    if (!viewName.trim()) return;
    const columnState = gridRef.current?.api?.getColumnState();
    const filterModel = gridRef.current?.api?.getFilterModel();
    const newView = { name: viewName, columnState, filterModel };
    const updatedViews: any = [...savedViews, newView];
    setSavedViews(updatedViews);
    if (saveLocalStorage) {
      localStorage.setItem(`savedViews_${nodeID}`, JSON.stringify(updatedViews));
    } else if (stateDS) {
      stateDS.getValue().then((currentData: any) => {
        const gridData = {
          ...currentData,
          savedViews: updatedViews,
        };
        stateDS.setValue(null, gridData);
      });
    }
    setViewName('');
  };

  const loadView = () => {
    const view: any = savedViews.find((view) => view.name === selectedView);
    if (!view) return;
    if (view.columnState && gridRef.current?.api) {
      gridRef.current.api.applyColumnState({ state: view.columnState, applyOrder: true });
      // Restore filter model of selected view
      if (view.filterModel) {
        gridRef.current.api.setFilterModel(view.filterModel);
      }
      const updatedVisibility = view.columnState.map((col: any) => ({
        field: col.colId,
        isHidden: col.hide || false,
        pinned: col.pinned || null,
      }));
      setColumnVisibility(updatedVisibility);
    }
  };

  const deleteView = () => {
    const updatedViews = savedViews.filter((view) => view.name !== selectedView);
    setSavedViews(updatedViews);
    if (saveLocalStorage) {
      localStorage.setItem(`savedViews_${nodeID}`, JSON.stringify(updatedViews));
    } else if (stateDS) {
      stateDS.getValue().then((currentData: any) => {
        const gridData = {
          ...currentData,
          savedViews: updatedViews,
        };
        stateDS.setValue(null, gridData);
      });
    }
    resetColumnview();
  };

  const updateView = () => {
    const columnState = gridRef.current?.api?.getColumnState();
    const filterModel = gridRef.current?.api?.getFilterModel();
    const updatedViews = savedViews.map((view) => {
      if (view.name === selectedView) {
        return { ...view, columnState, filterModel };
      }
      return view;
    });
    setSavedViews(updatedViews);
    if (saveLocalStorage) {
      localStorage.setItem(`savedViews_${nodeID}`, JSON.stringify(updatedViews));
    } else if (stateDS) {
      stateDS.getValue().then((currentData: any) => {
        const gridData = {
          ...currentData,
          savedViews: updatedViews,
        };
        stateDS.setValue(null, gridData);
      });
    }
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

  const visibleCount = useMemo(
    () => normalizedColumns.filter((column) => !column.isHidden).length,
    [normalizedColumns],
  );

  const setFilteredColumnsVisible = (visible: boolean) => {
    filteredColumns.forEach((column) => {
      const isVisible = !column.isHidden;
      if (isVisible !== visible) {
        handleColumnToggle(column.field);
      }
    });
  };

  return (
    <div ref={connect} style={style} className={cn(className, classNames)}>
      {datasource ? (
        <div className="flex flex-col gap-2 h-full" onKeyDownCapture={onGridKeyDownCapture}>
          {showCopyActions && (<div className="flex items-center gap-2 text-sm text-gray-800">
            <span className="font-semibold">{translation('Copy mode')}:</span>
            <button
              type="button"
              className={cn(
                'rounded border px-2 py-1',
                copyMode === 'cells'
                  ? 'border-slate-700 bg-slate-700 text-white'
                  : 'border-gray-300 bg-white text-gray-800',
              )}
              onClick={() => {
                setCopyMode('cells');
              }}
            >
              {translation('Cells')}
            </button>
            <button
              type="button"
              className={cn(
                'rounded border px-2 py-1',
                copyMode === 'rows'
                  ? 'border-slate-700 bg-slate-700 text-white'
                  : 'border-gray-300 bg-white text-gray-800',
              )}
              onClick={() => {
                setCopyMode('rows');
              }}
            >
              {translation('Rows')}
            </button>
            {copyMode === 'cells' && !isCellSelectionAvailable && (
              <span className="text-xs text-slate-600">
                {translation('Clicked cells')}: {manualSelectedCells.length}
              </span>
            )}
            {copyMode === 'cells' &&
              !isCellSelectionAvailable &&
              manualSelectedCells.length > 0 && (
                <button
                  type="button"
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-800"
                  onClick={() => {
                    setManualSelectedCells([]);
                  }}
                >
                  {translation('Clear')}
                </button>
              )}
          </div>)}

          {showColumnActions && (
            <>
              {/* AGGrid header actions */}
              <div className="grid-header items-stretch flex items-center justify-between cursor-pointer flex-wrap  py-4" style={{ boxShadow: "0px 1px 3px 0px rgba(0, 0, 0, 0.1)" }}>
                {/* actions section */}
                <div className="actions-section flex flex-col gap-2 mr-4 rounded-lg  bg-white px-4 py-2 text-sm text-gray-800">
                  <span className="actions-title"
                    style={{ color: "#717182", fontWeight: 500, fontSize: "11px" }}

                  >{translation('Actions')}</span>
                  <div className="flex gap-2">
                    <Element id="agGridActions" is={resolver.StyleBox} canvas />
                  </div>
                </div>
                <div className='flex items-center gap-2 flex-wrap pr-4'>
                  {/* columns customizer button */}
                  <div className="customizer-section flex flex-col gap-2  rounded-lg  bg-white py-2 text-sm text-gray-800">
                    <span className="customizer-title" style={{ color: "#717182", fontWeight: 500, fontSize: "11px" }}>{translation('View')}</span>
                    <div className="flex gap-2">
                      <button
                        className="header-button-customize-view inline-flex items-center justify-center rounded-lg border"
                        style={{
                          width: "31px",
                          height: "31px",
                          borderRadius: "8px",
                          borderColor: "#0000001A",
                          color: "#44444C"
                        }}
                        onClick={() => setShowPropertiesDialog(true)}
                      >
                        <FaTableColumns size={14} />
                      </button>
                      <button
                        className="header-button-reload-view inline-flex items-center justify-center rounded-lg border"
                        style={{
                          width: "31px",
                          height: "31px",
                          borderRadius: "8px",
                          borderColor: "#0000001A",
                          color: "#44444C"
                        }}
                        onClick={() => resetColumnview()}
                      >
                        <FaClockRotateLeft size={14} />
                      </button>
                    </div>
                  </div>
                  {/* new view section */}
                  <div className="view-section flex flex-col gap-2 rounded-lg  bg-white  py-2 text-sm text-gray-800">
                    <span className="view-title" style={{ color: "#717182", fontWeight: 500, fontSize: "11px" }}>{translation('Save view')}</span>
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
                          height: "31px",
                          borderRadius: "6px",
                          borderColor: "#0000001A",
                          color: "#44444C",
                        }}
                      />
                      <button
                        className="header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-800"
                        onClick={() => saveNewView()}
                        style={{
                          height: "31px",
                          borderRadius: "6px",
                          borderColor: "#0000001A",
                          color: "#44444C",
                        }}
                      >
                        {translation('Save new')}
                      </button>
                    </div>
                  </div>
                  {/* saved views section */}
                  <div className="views-section flex flex-col gap-2 rounded-lg bg-white py-2 text-sm text-gray-800">
                    <span className="views-title " style={{ color: "#717182", fontWeight: 500, fontSize: "11px" }}>{translation('Saved views')}</span>

                    <div className="flex gap-2">
                      <select
                        value={selectedView}
                        className="rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-800"
                        onChange={(e: any) => {
                          setSelectedView(e.target.value);
                        }}
                        style={{
                          height: "31px",
                          borderRadius: "6px",
                          borderColor: "#0000001A",
                          color: "#44444C",
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
                          height: "31px",
                          borderRadius: "6px",
                          borderColor: "#0000001A",
                          color: "#44444C",
                        }}                      >
                        {translation('Load')}
                      </button>
                      <button
                        className="header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-800"
                        onClick={() => updateView()}
                        style={{
                          height: "31px",
                          borderRadius: "6px",
                          borderColor: "#0000001A",
                          color: "#44444C",
                        }}                      >
                        {translation('Overwrite')}
                      </button>
                      <button
                        className="header-button-trash inline-flex items-center justify-center rounded-lg border"
                        style={{
                          width: "31px",
                          height: "31px",
                          borderRadius: "8px",
                          color: "#EC7B80",
                          borderColor: "#EC7B80",
                          backgroundColor: "#EC7B8033",
                        }}
                        onClick={() => deleteView()}
                      >
                        <GoTrash  size={14} /></button>
                    </div>
                  </div>
                </div>

              </div>
              {/* columns customizer dialog */}
              {showPropertiesDialog && (
                <div
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                  onClick={() => setShowPropertiesDialog(false)}
                >
                  <div
                    className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-xl"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-start justify-between gap-3  px-5 py-4 rounded-t-xl" >
                      <div>
                        <h1 className="text-sm tracking-wide" style={{ color: "#0A0A0A", fontSize: "21px", fontWeight: 500 }}>{translation("COLUMN STATE")}</h1>
                        <span className='mt-1 block text-sm ' style={{ color: "#6B7280", fontSize: "16px" }}>{translation("Show or hide columns for this grid view")}</span>
                      </div>
                      <button
                        className=" inline-flex items-center justify-center"
                        style={{
                          color: "#0A0A0A"
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
                            style={{ height: "31px", borderColor: "#0000001A", borderRadius: "6px" }}
                          />

                          <label className="inline-flex items-center gap-2 whitespace-nowrap text-sm" style={{ color: "#717182", fontSize: "12px", fontWeight: 500 }}>
                            <input
                              type="checkbox"
                              checked={showVisibleOnly}
                              onChange={(e) => setShowVisibleOnly(e.target.checked)}
                              style={{ height: "12px", width: "12px", backgroundColor: "#2b5797", borderRadius: "4px" }}
                            />
                            <span>{translation('Visible only')}</span>
                          </label>
                          <div>
                            <button
                              type="button"
                              className="rounded-md border  bg-white px-3 py-2 flex items-center justify-center disabled:cursor-not-allowed disabled:opacity-50"
                              style={{ borderColor: "rgba(0, 0, 0, 0.1)", color: "#0A0A0A", height: "31px", fontSize: "12px", fontWeight: 500 }}
                              onClick={() => setFilteredColumnsVisible(true)}
                              disabled={filteredColumns.length === 0}
                            >
                              {translation('Select all')}
                            </button>
                          </div>
                          <button
                            type="button"
                            className="rounded-md border px-3 flex items-center justify-center py-2 disabled:cursor-not-allowed disabled:opacity-50"
                            style={{ borderColor: "#6B8AD4", color: "#6B8AD4", height: "31px", fontSize: "12px", fontWeight: 500 }}
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

                      <div className="max-h-96 space-y-1 overflow-y-auto rounded-lg border p-2" style={{ backgroundColor: "#FAFAFA", borderColor: "#D1D5DC", borderRadius: "10px" }}>
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
                                    style={{ height: "12px", width: "12px", backgroundColor: "#2b5797", borderRadius: "4px" }}
                                  />
                                  <span
                                    className={`truncate ${isVisible ? "text-gray-700" : "text-slate-400"
                                      }`}
                                  >
                                    {column.field}
                                  </span>
                                </label>

                                <select
                                  value={column.pinned || 'unpinned'}
                                  className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                                  style={{ height: "31px" }}
                                  onChange={(e) => handlePinChange(column.field, e.target.value)}
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
            </>
          )}
          <div className="records-count text-sm  flex justify-end gap-2 mt-2 mb-2 pr-4" ><span style={{ color: "#0A0A0A", fontSize: "12px", fontWeight: 400 }}>{_count}</span> <span style={{ color: "#717182", fontSize: "12px", fontWeight: 400 }}>{translation("records")}</span></div>
          <div className='px-4 h-full'>
            <AgGridReact
              ref={gridRef}
              columnDefs={colDefs}
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
              }}
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
      )
      }
    </div >
  );
};

export default AgGrid;
