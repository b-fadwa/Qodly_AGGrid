import {
  useDataLoader,
  useRenderer,
  useSources,
  useDsChangeHandler,
  entitySubject,
  EntityActions,
  useEnhancedNode,
} from '@ws-ui/webform-editor';
import cn from 'classnames';
import { CSSProperties, FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ISimpleAgGridProps, ISimpleColumn } from './SimpleAgGrid.config';
import CustomCell from '../AgGrid/CustomCell';
import {
  ColDef,
  RowDragEndEvent,
  CellValueChangedEvent,
  RowClassParams,
  themeQuartz,
  ICellRendererParams,
  GridReadyEvent,
  IGetRowsParams,
} from 'ag-grid-community';

/** Match `AgGrid.render` infinite row paging (see `cacheBlockSize` there). */
const CACHE_BLOCK_SIZE = 100;

const ROW_NUMBER_COL_ID = '__qodlyRowNumber';

const RowNumberCell: FC<ICellRendererParams> = (params) => (
  <span style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>{params.value ?? ''}</span>
);
const SaveActionRenderer: FC<any> = (params: any) => {
  if (!params.data?.__isInputRow) return null;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (params.context?.onSaveRow) {
          params.context.onSaveRow(params.data);
        }
      }}
      title="Save new row"
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        color: '#4caf50',
        fontSize: '18px',
      }}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
        <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" />
      </svg>
    </button>
  );
};

const SimpleAgGrid: FC<ISimpleAgGridProps> = ({
  datasource,
  columns,
  rowCssField,
  spacing,
  accentColor,
  backgroundColor,
  textColor,
  fontSize,
  borderColor,
  wrapperBorderRadius,
  rowBorder,
  columnBorder,
  headerBackgroundColor,
  headerTextColor,
  style,
  disabled = false,
  enableAddNewRow = true,
  showFooter = true,
  enableRowDrag = true,
  showRowNumbers = false,
  className,
  classNames = [],
}) => {
  const { connect, emit } = useRenderer({
    autoBindEvents: !disabled,
    omittedEvents: ['onsetvalue', 'onrowdnd', 'onsaverow', 'onrowdblclick'],
  });
  const {
    sources: { datasource: ds, currentElement },
  } = useSources({ acceptIteratorSel: true });
  const { id: nodeID } = useEnhancedNode();
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

  const { fetchIndex, fetchPage } = useDataLoader({ source: ds });

  const [selected, setSelected] = useState(-1);
  const [scrollIndex, setScrollIndex] = useState(0);
  const [, setCount] = useState(0);
  const isSelectingRef = useRef(false);

  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;
  const dsRef = useRef(ds);
  dsRef.current = ds;

  const enableAddNewRowRef = useRef(enableAddNewRow);
  enableAddNewRowRef.current = enableAddNewRow;

  const createEmptyInputRow = useCallback(() => {
    const cols = columnsRef.current;
    const row: any = { __isInputRow: true, __isNew: true };
    cols.forEach((col) => {
      row[col.title] = '';
    });
    return row;
  }, []);

  const [pinnedTopRowData, setPinnedTopRowData] = useState<any[]>(() => {
    if (!enableAddNewRow) return [];
    const row: any = { __isInputRow: true, __isNew: true };
    columns.forEach((col) => {
      row[col.title] = '';
    });
    return [row];
  });

  const resetInputRow = useCallback(() => {
    if (!enableAddNewRowRef.current) {
      setPinnedTopRowData([]);
      return;
    }
    setPinnedTopRowData([createEmptyInputRow()]);
  }, [createEmptyInputRow]);

  const resetInputRowRef = useRef(resetInputRow);
  resetInputRowRef.current = resetInputRow;

  useEffect(() => {
    resetInputRow();
  }, [enableAddNewRow, resetInputRow]);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    params.api.setGridOption('datasource', {
      getRows: async (rowParams: IGetRowsParams) => {
        const currentDs = dsRef.current;
        if (!currentDs) {
          rowParams.successCallback([], 0);
          return;
        }
        const selLength = (currentDs as any).entitysel?._private?.selLength ?? 0;
        if (selLength === 0) {
          resetInputRowRef.current();
          rowParams.successCallback([], 0);
          return;
        }
        const count = rowParams.endRow - rowParams.startRow;
        if (count <= 0) {
          rowParams.successCallback([], selLength);
          return;
        }
        try {
          const entities = await fetchPageRef.current(rowParams.startRow, count);
          const cols = columnsRef.current;
          const rows = entities.map((data: any, index: number) => {
            const globalIndex = rowParams.startRow + index;
            const row: any = { __entity: data, __rowIndex: globalIndex };
            cols.forEach((col) => {
              row[col.title] = data[col.source];
            });
            return row;
          });
          rowParams.successCallback(rows, selLength);
        } catch {
          rowParams.failCallback();
        }
      },
    });
  }, []);

  const { updateCurrentDsValue } = useDsChangeHandler({
    source: ds,
    currentDs: currentElement,
    selected,
    setSelected,
    scrollIndex,
    setScrollIndex,
    setCount,
    fetchIndex,
    onDsChange: async () => {
      if (isSelectingRef.current) return;
      resetInputRow();
      gridRef.current?.api?.refreshInfiniteCache();
    },
    onCurrentDsChange: (sel) => {
      if (!gridRef.current) return;
      const rowNode = gridRef.current.api?.getRowNode(sel.toString());
      gridRef.current.api?.ensureIndexVisible(sel);
      rowNode?.setSelected(true);
      entitySubject.next({
        action: EntityActions.UPDATE,
        payload: { nodeID, rowIndex: sel },
      });
    },
  });

  // -- Column definitions --

  const onSaveRow = useCallback(
    (data: any) => {
      const cols = columnsRef.current;
      const payload: Record<string, any> = {};
      cols.forEach((c) => {
        payload[c.source] = data?.[c.title];
      });
      emit('onsaverow', { rowData: payload });
      resetInputRow();
    },
    [emit, resetInputRow],
  );

  const gridContext = useMemo(() => ({ onSaveRow }), [onSaveRow]);

  const rowNumberColDef = useMemo<ColDef>(
    () => ({
      colId: ROW_NUMBER_COL_ID,
      headerName: '#',
      valueGetter: (params) => {
        if (params.data?.__isInputRow) return '';
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

  const colDefs: ColDef[] = useMemo(() => {
    const dataCols = columns.map((col) => ({
      field: col.title,
      source: col.source,
      hide: !!col.hidden,
      editable: (params: any) =>
        enableAddNewRow && col.editable !== false && !!params.data?.__isInputRow,
      sortable: !!col.sorting,
      width: col.width,
      flex: col.flex,
      cellRendererParams: {
        format: col.format ?? '',
        dataType: col.dataType ?? 'string',
      },
    }));
    const base: ColDef[] = [];
    if (showRowNumbers) {
      base.push(rowNumberColDef);
    }
    if (enableRowDrag) {
      base.push({
        headerName: '',
        field: '__drag',
        rowDrag: (params: any) => !params.data?.__isInputRow,
        width: 50,
        maxWidth: 50,
        flex: 0,
        sortable: false,
        editable: false,
      });
    }
    base.push(...dataCols);
    if (enableAddNewRow) {
      base.push({
        headerName: '',
        field: '__action',
        width: 50,
        maxWidth: 50,
        flex: 0,
        sortable: false,
        editable: false,
        cellRenderer: SaveActionRenderer,
      });
    }
    return base;
  }, [columns, enableAddNewRow, enableRowDrag, rowNumberColDef, showRowNumbers]);

  const defaultColDef = useMemo<ColDef>(
    () => ({
      flex: 1,
      minWidth: 80,
      cellDataType: false,
      cellRenderer: CustomCell,
    }),
    [],
  );

  const rowSelection = useMemo(
    () => ({
      mode: 'singleRow' as const,
      enableClickSelection: true,
      checkboxes: false,
      isRowSelectable: (node: any) => !!node.data && !node.data.__isInputRow,
    }),
    [],
  );

  // -- Theme --

  const theme = themeQuartz.withParams({
    spacing,
    accentColor,
    backgroundColor,
    textColor,
    fontSize,
    borderColor,
    wrapperBorderRadius,
    rowBorder,
    columnBorder,
    headerBackgroundColor,
    headerTextColor,
    foregroundColor: textColor,
    borderRadius: wrapperBorderRadius,
  });

  // -- Feature 3: Generic CSS via getRowClass --

  const getRowClass = useCallback(
    (params: RowClassParams) => {
      const classes: string[] = [];
      if (enableAddNewRow && params.data?.__isInputRow) {
        classes.push('simple-aggrid-input-row');
      }
      if (rowCssField && params.data) {
        const cols = columnsRef.current;
        const value =
          params.data.__entity?.[rowCssField] ?? findValueBySource(params.data, rowCssField, cols);
        if (value !== undefined && value !== null && value !== '') {
          const sanitized = String(value)
            .replace(/[^a-zA-Z0-9_-]/g, '-')
            .toLowerCase();
          classes.push(`simple-aggrid-row-${sanitized}`);
        }
      }
      return classes.join(' ');
    },
    [rowCssField, enableAddNewRow],
  );

  // -- Feature 1: Inline editing → onsetvalue --

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent) => {
      if (event.column?.getColId?.() === ROW_NUMBER_COL_ID) return;
      const cols = columnsRef.current;
      const col = cols.find((c) => c.title === event.colDef.field);
      const isInputRow = !!event.data?.__isInputRow;
      const rowIndex = event.node?.rowIndex ?? -1;

      const payload: Record<string, any> = {};
      cols.forEach((c) => {
        payload[c.source] = event.data?.[c.title];
      });

      emit('onsetvalue', {
        column: col?.source ?? event.colDef.field,
        value: event.newValue,
        oldValue: event.oldValue,
        rowIndex,
        rowData: payload,
        isNewRow: isInputRow,
      });
    },
    [emit],
  );

  // -- Feature 2: Row DnD → onrowdnd --

  const onRowDragEnd = useCallback(
    (event: RowDragEndEvent) => {
      if (!enableRowDrag) return;
      const fromIndex = event.node?.data?.__rowIndex ?? event.node?.rowIndex;
      const toIndex = event.overIndex;
      if (fromIndex !== undefined && toIndex !== undefined && fromIndex !== toIndex) {
        emit('onrowdnd', {
          fromIndex,
          toIndex,
        });
      }
    },
    [emit, enableRowDrag],
  );

  // -- Row click / double-click (same pattern as AgGrid.render) --

  const onRowClicked = useCallback(
    async (event: any) => {
      if (!dsRef.current || event.data?.__isInputRow) return;
      event.node?.setSelected(true, false);
      isSelectingRef.current = true;
      try {
        await updateCurrentDsValue({ index: event.rowIndex });
      } finally {
        isSelectingRef.current = false;
      }
    },
    [updateCurrentDsValue],
  );

  const onRowDoubleClicked = useCallback(
    async (event: any) => {
      if (!dsRef.current || !event.data || event.data.__isInputRow) return;
      event.node?.setSelected(true, false);
      isSelectingRef.current = true;
      try {
        await updateCurrentDsValue({
          index: event.rowIndex,
          forceUpdate: true,
        });
      } finally {
        isSelectingRef.current = false;
      }
      const cols = columnsRef.current;
      const payload: Record<string, any> = {};
      cols.forEach((c) => {
        payload[c.source] = event.data?.[c.title];
      });
      emit('onrowdblclick', {
        rowIndex: event.rowIndex,
        rowData: payload,
      });
    },
    [emit, updateCurrentDsValue],
  );

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
        <div className="flex flex-col h-full" style={{ overflow: 'hidden' }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <AgGridReact
              ref={gridRef}
              rowModelType="infinite"
              cacheBlockSize={CACHE_BLOCK_SIZE}
              maxBlocksInCache={10}
              cacheOverflowSize={2}
              maxConcurrentDatasourceRequests={1}
              rowBuffer={0}
              onGridReady={onGridReady}
              pinnedTopRowData={enableAddNewRow ? pinnedTopRowData : []}
              columnDefs={colDefs}
              defaultColDef={defaultColDef}
              rowDragManaged={enableRowDrag}
              onCellValueChanged={onCellValueChanged}
              onRowDragEnd={enableRowDrag ? onRowDragEnd : undefined}
              onRowClicked={onRowClicked}
              onRowDoubleClicked={onRowDoubleClicked}
              rowSelection={rowSelection}
              suppressCellFocus={true}
              getRowClass={getRowClass}
              context={gridContext}
              theme={theme}
              singleClickEdit={true}
              stopEditingWhenCellsLoseFocus={true}
              className={cn({ 'pointer-events-none opacity-40': disabled })}
            />
          </div>
          {showFooter && (
            <div
              className="simple-aggrid-footer"
              style={{
                flexShrink: 0,
                minHeight: '40px',
                borderTop: '1px solid #e0e0e0',
                backgroundColor: '#fafafa',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
              }}
            />
          )}
        </div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center rounded-lg border bg-purple-400 py-4 text-white">
          <p>Error: No datasource</p>
        </div>
      )}
    </div>
  );
};

function findValueBySource(data: any, sourceField: string, columns: ISimpleColumn[]): any {
  const col = columns.find((c) => c.source === sourceField);
  return col ? data[col.title] : undefined;
}

export default SimpleAgGrid;
