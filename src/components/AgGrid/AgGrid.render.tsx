import {
  useDataLoader,
  useRenderer,
  useSources,
  useDsChangeHandler,
  entitySubject,
  EntityActions,
  useEnhancedNode,
  useWebformPath,
} from '@ws-ui/webform-editor';
import cn from 'classnames';
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { IAgGridProps } from './AgGrid.config';
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  IGetRowsParams,
  SortModelItem,
  StateUpdatedEvent,
  ModuleRegistry,
  ColumnHoverModule,
  themeQuartz,
} from 'ag-grid-community';
import isEqual from 'lodash/isEqual';
import cloneDeep from 'lodash/cloneDeep';
import CustomCell from './CustomCell';
import { format } from 'date-fns';

ModuleRegistry.registerModules([ColumnHoverModule]);

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
  className,
  classNames = [],
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
      'onnewstate',
      'onallstate',
      'onminusstate',
      'onreducestate',
      'onprintstate',
    ],
  });
  const {
    sources: { datasource: ds, currentElement },
  } = useSources({ acceptIteratorSel: true });
  const { id: nodeID } = useEnhancedNode();
  const prevSortModelRef = useRef<SortModelItem[]>([]);
  const gridRef = useRef<AgGridReact>(null);
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
  const [showPropertiesDialog, setShowPropertiesDialog] = useState(false);
  // views management
  const [viewName, setViewName] = useState<string>('');
  // view = name + columnVisibility
  const [savedViews, setSavedViews] = useState<{ name: string, selectedProperties: string[] }[]>([]);
  const [selectedView, setSelectedView] = useState<string>('');

  // Load saved views from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(`savedViews_${nodeID}`);
    if (stored) {
      setSavedViews(JSON.parse(stored));
    }
  }, [nodeID]);

  //very initial state of columns
  const initialColumnVisibility = useMemo(
    () =>
      columns.map(col => ({
        field: col.title,
        isHidden: false,
        pinned: null as 'left' | 'right' | null,
      })),
    [columns]
  );

  const [columnVisibility, setColumnVisibility] = useState<any[]>(initialColumnVisibility);

  const colDefs: ColDef[] = useMemo(() => {
    return columns.map(col => {
      const colState = columnVisibility.find(c => c.field === col.title) || { isHidden: false, pinned: null };
      return {
        field: col.title,
        hide: colState.isHidden,
        pinned: colState.pinned,
        cellRendererParams: {
          format: col.format,
          dataType: col.dataType,
        },
        lockPosition: col.locked,
        sortable: col.dataType !== 'image' && col.dataType !== 'object' && col.sorting,
        resizable: col.sizing,
        width: col.width,
        flex: col.flex,
        filter:
          col.filtering &&
          (col.dataType === 'text' || col.dataType === 'string'
            ? 'agTextColumnFilter'
            : col.dataType === 'long' || col.dataType === 'number'
              ? 'agNumberColumnFilter'
              : col.dataType === 'date'
                ? 'agDateColumnFilter'
                : false),
        filterParams: {
          filterOptions:
            col.dataType === 'text' || col.dataType === 'string'
              ? ['contains', 'equals', 'notEqual', 'startsWith', 'endsWith']
              : col.dataType === 'long' || col.dataType === 'number'
                ? [
                  'equals',
                  'notEqual',
                  'greaterThan',
                  'greaterThanOrEqual',
                  'lessThan',
                  'lessThanOrEqual',
                  'inRange',
                ]
                : col.dataType === 'date'
                  ? ['equals', 'notEqual', 'greaterThan', 'lessThan', 'inRange']
                  : [],
          defaultOption: 'equals',
        },
      };
    });
  }, [columns, columnVisibility]);


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
      gridRef.current.api?.refreshInfiniteCache();
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

  const onRowClicked = useCallback(async (event: any) => {
    if (!ds || multiSelection) return;
    await updateCurrentDsValue({
      index: event.rowIndex,
    });
    emit('onrowclick');
  }, []);

  const onRowDoubleClicked = useCallback(async (event: any) => {
    if (!ds || multiSelection) return;
    await updateCurrentDsValue({
      index: event.rowIndex,
    });
    emit('onrowdblclick');
  }, []);

  const onCellClicked = useCallback((event: any) => {
    if (!ds) return;
    emit('oncellclick', {
      column: event.column.getColId(),
      value: event.value,
    });
  }, []);

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

  const onCellKeyDown = useCallback((event: any) => {
    emit('oncellkeydown', {
      column: event.column.getColId(),
      value: event.value,
      key: event.event.key,
    });
  }, []);

  const onSelectionChanged = useCallback(async (event: any) => {
    if (currentElement || !multiSelection) return; // handled by onRowClicked
    if (!currentSelectionDS) return;

    const selectedRows = event.api.getSelectedRows();
    await currentSelectionDS.setValue(null, selectedRows);
  }, []);

  const onStateUpdated = useCallback((params: StateUpdatedEvent) => {
    if (params.sources.length === 1 && params.sources.includes('rowSelection')) return; // to avoid multiple triggers when selecting a row
    if (params.type === 'stateUpdated' && !params.sources.includes('gridInitializing')) {
      const columnState = params.api.getColumnState();
      if (saveLocalStorage) {
        localStorage.setItem(`gridState_${nodeID}`, JSON.stringify(columnState));
      } else if (stateDS) {
        stateDS.setValue(null, columnState);
      }
      emit('onsavestate', columnState);
    }
  }, []);

  const getState = useCallback(async (params: any) => {
    if (saveLocalStorage) {
      const storedState = localStorage.getItem(`gridState_${nodeID}`);
      if (storedState) {
        params.api.applyColumnState({ state: JSON.parse(storedState), applyOrder: true });
      }
    } else if (stateDS) {
      const dsValue = await stateDS?.getValue();
      params.api.applyColumnState({ state: dsValue, applyOrder: true });
    }
  }, []);

  const buildFilterQuery = useCallback((filter: any, source: string): string => {
    const filterType = filter.filterType;
    const filterValue = filter.filter;
    switch (filterType) {
      case 'text':
        switch (filter.type) {
          case 'contains':
            return `${source} == "@${filterValue}@"`;
          case 'equals':
            return `${source} == "${filterValue}"`;
          case 'notEqual':
            return `${source} != "${filterValue}"`;
          case 'startsWith':
            return `${source} begin "${filterValue}"`;
          case 'endsWith':
            return `${source} == "@${filterValue}"`;
          default:
            return '';
        }
      case 'number':
        switch (filter.type) {
          case 'equals':
            return `${source} == ${filterValue}`;
          case 'notEqual':
            return `${source} != ${filterValue}`;
          case 'greaterThan':
            return `${source} > ${filterValue}`;
          case 'greaterThanOrEqual':
            return `${source} >= ${filterValue}`;
          case 'lessThan':
            return `${source} < ${filterValue}`;
          case 'lessThanOrEqual':
            return `${source} <= ${filterValue}`;
          case 'inRange':
            return `${source} >= ${filter.filter} AND ${source} <= ${filter.filterTo}`;
          default:
            return '';
        }
      case 'date':
        const dateFrom = new Date(filter.dateFrom);
        switch (filter.type) {
          case 'equals':
            return `${source} == ${format(dateFrom, 'yyyy-MM-dd')}`;
          case 'notEqual':
            return `${source} != ${format(dateFrom, 'yyyy-MM-dd')}`;
          case 'lessThan':
            return `${source} < ${format(dateFrom, 'yyyy-MM-dd')}`;
          case 'greaterThan':
            return `${source} > ${format(dateFrom, 'yyyy-MM-dd')}`;
          case 'inRange':
            return `${source} > ${format(dateFrom, 'yyyy-MM-dd')} AND ${source} < ${format(new Date(filter.dateTo), 'yyyy-MM-dd')}`;
          default:
            return '';
        }
      default:
        return '';
    }
  }, []);

  const buildFilterQueries = useCallback(
    (filterModel: any, columns: any[]): string[] => {
      return Object.keys(filterModel).map((key) => {
        const filter = filterModel[key];
        const column = columns.find((col) => col.title === key);
        if (!column) return '';
        const source = column.source;
        if (filter.operator && filter.conditions) {
          const conditionQueries = filter.conditions.map((condition: any) =>
            buildFilterQuery(condition, source),
          );
          return `(${conditionQueries.join(` ${filter.operator} `)})`;
        } else {
          return buildFilterQuery(filter, source);
        }
      });
    },
    [buildFilterQuery],
  );

  const applySorting = useCallback(async (params: IGetRowsParams, columns: any[], ds: any) => {
    if (params.sortModel.length > 0 && !isEqual(params.sortModel, prevSortModelRef.current)) {
      prevSortModelRef.current = params.sortModel;
      const sortingString = params.sortModel
        .map((sort) => `${columns.find((c) => c.title === sort.colId)?.source} ${sort.sort}`)
        .join(', ');
      await ds.orderBy(sortingString);
    }
  }, []);

  const fetchData = useCallback(async (fetchCallback: any, params: IGetRowsParams) => {
    const entities = await fetchCallback(params.startRow, params.endRow - params.startRow);
    const rowData = entities.map((data: any) => {
      const row: any = {};
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
    setColumnVisibility(prev =>
      prev.map(c => c.field === colField ? { ...c, isHidden: !c.isHidden } : c)
    );
  };

  const resetColumnview = () => {
    setColumnVisibility(initialColumnVisibility);
    (gridRef.current as any)?.columnApi.resetColumnState();
  }

  const handlePinChange = (colField: string, value: string) => {
    setColumnVisibility(prev =>
      prev.map(col => {
        if (col.field !== colField) return col;
        //  pinnedValue : 'left' | 'right' | null
        const pinnedValue = value === 'unpinned' ? null : (value as 'left' | 'right');
        return {
          ...col,
          pinned: pinnedValue,
        };
      })
    );
  };

  // action buttons handlers
  const onNewClick = () => {
    emit('onnewstate');

  }

  const onAllClick = () => {
    emit('onallstate');
  }

  const onMinusClick = () => {
    emit('onminusstate');
  }

  const onReduceClick = () => {
    emit('onreducestate');
  }

  const onPrintClick = () => {
    emit('onprintstate');
  }

  // views actions
  const saveNewView = () => {
    if (!viewName.trim()) return;
    const newView = { name: viewName, columnVisibility: [...columnVisibility] };
    const updatedViews: any = [...savedViews, newView];
    setSavedViews(updatedViews);
    localStorage.setItem(`savedViews_${nodeID}`, JSON.stringify(updatedViews));
    setViewName('');
  }

  const loadView = () => {
    const view: any = savedViews.find(view => view.name === selectedView);
    if (!view) return;
    setColumnVisibility(view.columnVisibility);
  };

  const deleteView = () => {
    const updatedViews = savedViews.filter(view => view.name !== selectedView);
    setSavedViews(updatedViews);
    localStorage.setItem(`savedViews_${nodeID}`, JSON.stringify(updatedViews));
  }

  const updateView = () => {
    const updatedViews = savedViews.map(view => {
      if (view.name === selectedView) {
        return { ...view, columnVisibility: [...columnVisibility] };
      }
      return view;
    });
    setSavedViews(updatedViews);
    localStorage.setItem(`savedViews_${nodeID}`, JSON.stringify(updatedViews));
  }

  return (
    <div ref={connect} style={style} className={cn(className, classNames)}>
      <div className="flex flex-col gap-2 h-full">
        {/* AGGrid header actions */}
        <div className="flex gap-2 items-center cursor-pointer flex-wrap">
          {/* actions section */}
          <div className=" flex flex-col gap-2 mr-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800">
            <span className="font-semibold">Actions:</span>
            <div className="flex gap-2">
              <button className='inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800' onClick={onNewClick}>New</button>
              <button className='inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800' onClick={onAllClick}>All</button>
              <button className='inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800' onClick={onMinusClick}>Minus</button>
              <button className='inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800' onClick={onReduceClick}>Reduce</button>
              <button className='inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800' onClick={onPrintClick}>Print</button>
            </div>
          </div>
          {/* columns customizer button */}
          <div className="flex flex-col gap-2 mr-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800">
            <span className="font-semibold">View:</span>
            <div className="flex gap-2">
              <button
                className="inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800"
                onClick={() => setShowPropertiesDialog(true)}
              >
                Customize columns
              </button>
              <button
                className="inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800"
                onClick={resetColumnview}
              >
                Reset default view
              </button>
            </div>
          </div>
          {/* new view section */}
          <div className="flex flex-col gap-2 mr-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800">
            <span className="font-semibold">Save view:</span>
            <div className="flex gap-2">
              <input type="text" placeholder="View name" className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-800" value={viewName} onChange={(e: any) => { setViewName(e.target.value) }} />
              <button className='inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800' onClick={saveNewView}>Save new</button>
            </div>
          </div>
          {/* saved views section */}
          <div className="flex flex-col gap-2 mr-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800">
            <span className="font-semibold">Saved views:</span>
            <div className="flex gap-2">
              <select className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-800" onChange={(e: any) => { setSelectedView(e.target.value) }}>
                <option value="">Select view</option>
                {savedViews.map((view, _) => (
                  <option value={view.name}>{view.name}</option>
                ))}
              </select>
              <button className='inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800' onClick={loadView}>Load</button>
              <button className='inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800' onClick={updateView}>Overwrite</button>
              <button className='inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800' onClick={deleteView}>Delete</button>

            </div>
          </div>
        </div>
        {/* columns customizer dialog */}
        {showPropertiesDialog && (
          <div
            className="customizer-dialog fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-[1000]"
            onClick={() => setShowPropertiesDialog(false)}
          >
            <div
              className="bg-white rounded-lg overflow-y-auto shadow-[0_2px_16px_rgba(0,0,0,0.2)]"
              style={{
                maxHeight: '80vh',
                minWidth: '50%'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4 bg-gray-100 p-4 bottom-px">
                <div className='flex flex-col'>
                  <h1 className="text-lg font-bold">COLUMN STATE</h1>
                  <span>Show or hide columns for this grid view</span>
                </div>
                <button
                  type="button"
                  className="rounded-md border border-gray-300 bg-gray-300 text-gray-700 p-2"
                  onClick={() => setShowPropertiesDialog(false)}           >
                  Close
                </button>
              </div>
              {columns.length === 0 ? (
                <li>No properties found.</li>
              ) : (
                columnVisibility.map((column, idx) => (
                  <div key={idx} className="w-full bg-white rounded-md shadow-sm flex items-center gap-2 px-4 py-2 mb-2 text-gray-800">
                    <input type="checkbox" checked={!column.isHidden} onChange={() => handleColumnToggle(column.field)} />
                    <span >{column?.field}</span>
                    <select name="pinningPositions" id="pinningPositions" className="ml-auto border border-gray-300 rounded-md p-1" onChange={(e) => handlePinChange(column.field, e.target.value)}
                    >
                      <option value="unpinned">Unpinned</option>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </select>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
        {datasource ? (
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
              enableClickSelection: !multiSelection,
              checkboxes: multiSelection,
            }}
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
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-lg border bg-purple-400 py-4 text-white">
            <p>Error</p>
          </div>
        )}
      </div>
    </div >
  );
};

export default AgGrid;