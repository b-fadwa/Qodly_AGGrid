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
import { FC, useCallback, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { IAgGridProps } from './AgGrid.config';
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  IGetRowsParams,
  SortModelItem,
  StateUpdatedEvent,
  themeQuartz,
} from 'ag-grid-community';
import isEqual from 'lodash/isEqual';
import cloneDeep from 'lodash/cloneDeep';
import CustomCell from './CustomCell';
import { format } from 'date-fns';

const AgGrid: FC<IAgGridProps> = ({
  datasource,
  columns,
  state = '',
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

  const { fetchIndex } = useDataLoader({
    source: ds,
  });

  const { fetchIndex: fetchIndexClone } = useDataLoader({
    source: searchDs,
  });

  const path = useWebformPath();
  const stateDS = window.DataSource.getSource(state, path);

  const [selected, setSelected] = useState(-1);
  const [scrollIndex, setScrollIndex] = useState(0);
  const [_count, setCount] = useState(0);
  const colDefs: ColDef[] = useMemo(
    () =>
      columns.map((col) => ({
        field: col.title,
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
      })),
    [],
  );

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
    rangeSelectionBorderColor: 'transparent',
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
      // TODO: fix scroll to selected row after refresh
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
    if (!ds) return;
    await updateCurrentDsValue({
      index: event.rowIndex,
    });
    emit('onrowclick');
  }, []);

  const onRowDoubleClicked = useCallback(async (event: any) => {
    if (!ds) return;
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

  const onStateUpdated = useCallback((params: StateUpdatedEvent) => {
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

  const fetchData = useCallback(async (fetchIndex: any, params: IGetRowsParams) => {
    const entities = await fetchIndex(params.startRow);
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

          const result = await fetchData(fetchIndexClone, rowParams);
          entities = result.entities;
          rowData = result.rowData;
          length = searchDs.entitysel._private.selLength;
        } else {
          await applySorting(rowParams, columns, ds);

          const result = await fetchData(fetchIndex, rowParams);
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

  return (
    <div ref={connect} style={style} className={cn(className, classNames)}>
      {datasource ? (
        <AgGridReact
          ref={gridRef}
          columnDefs={colDefs}
          defaultColDef={defaultColDef}
          onRowClicked={onRowClicked}
          onRowDoubleClicked={onRowDoubleClicked}
          onGridReady={onGridReady}
          rowModelType="infinite"
          rowSelection={{ mode: 'singleRow', enableClickSelection: true, checkboxes: false }}
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
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center rounded-lg border bg-purple-400 py-4 text-white">
          <p>Error</p>
        </div>
      )}
    </div>
  );
};

export default AgGrid;
