import {
  useDataLoader,
  useRenderer,
  useSources,
  useDsChangeHandler,
  entitySubject,
  EntityActions,
  useEnhancedNode,
  useI18n,
  useLocalization,
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
import get from 'lodash/get';
import { resolveSimpleColumnTitle, simpleAgGridRowField } from './simpleAgGridColumns';

/** Match `AgGrid.render` infinite row paging (see `cacheBlockSize` there). */
const CACHE_BLOCK_SIZE = 100;

const ROW_NUMBER_COL_ID = '__qodlyRowNumber';

const RowNumberCell: FC<ICellRendererParams> = (params) => (
  <span style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
    {params.value ?? ''}
  </span>
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
  const { i18n } = useI18n();
  const { selected: lang } = useLocalization();
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

  // Client-side: row drag and/or column sorting. Otherwise infinite paging.
  const useClientSideModel = enableRowDrag || columns.some((c) => c.sorting);

  const [clientRowData, setClientRowData] = useState<any[] | null>(null);
  const clientLoadKey = useMemo(() => {
    const colsKey = (columns || [])
      .map((c) => `${simpleAgGridRowField(c)}::${c?.source ?? ''}`)
      .join('|');
    return `${datasource ?? ''}__${colsKey}`;
  }, [datasource, columns]);

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
      row[simpleAgGridRowField(col)] = '';
    });
    return row;
  }, []);

  const [pinnedTopRowData, setPinnedTopRowData] = useState<any[]>(() => {
    if (!enableAddNewRow) return [];
    const row: any = { __isInputRow: true, __isNew: true };
    columns.forEach((col) => {
      row[simpleAgGridRowField(col)] = '';
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

  useEffect(() => {
    resetInputRow();
  }, [enableAddNewRow, resetInputRow]);

  const buildRowFromEntity = useCallback(
    (data: any, globalIndex: number, cols: ISimpleColumn[]) => {
      const row: any = { __entity: data, __rowIndex: globalIndex };
      cols.forEach((col) => {
        const source = typeof col?.source === 'string' ? col.source.trim() : '';
        row[simpleAgGridRowField(col)] = source ? get(data, source) : undefined;
      });
      return row;
    },
    [],
  );

  const fetchEntitiesPage = useCallback(async (start: number, count: number): Promise<any[]> => {
    const src = dsRef.current as any;
    if (!src) return [];
    if (typeof src.getCollection === 'function') {
      const filterAttrs =
        (typeof src.filterAttributesText === 'string' && src.filterAttributesText) ||
        src._private?.filterAttributes ||
        '';
      const chunk = await src.getCollection(start, count, filterAttrs);
      return Array.isArray(chunk) ? chunk : [];
    }
    const page = await fetchPageRef.current(start, count);
    return Array.isArray(page) ? page : [];
  }, []);

  const loadAllClientRows = useCallback(async (): Promise<any[]> => {
    const currentDs = dsRef.current as any;
    if (!currentDs) return [];

    const cols = columnsRef.current;
    const all: any[] = [];
    let start = 0;
    let selLengthRaw = currentDs.entitysel?._private?.selLength;
    let total =
      typeof selLengthRaw === 'number' && Number.isFinite(selLengthRaw) && selLengthRaw >= 0
        ? selLengthRaw
        : null;
    if (total === 0) total = null;

    while (true) {
      const remaining = total != null ? Math.max(0, total - start) : CACHE_BLOCK_SIZE;
      if (total != null && remaining === 0) break;
      const count = total != null ? Math.min(CACHE_BLOCK_SIZE, remaining) : CACHE_BLOCK_SIZE;
      const entities = await fetchEntitiesPage(start, count);
      if (entities.length === 0) break;
      all.push(...entities.map((e: any, idx: number) => buildRowFromEntity(e, start + idx, cols)));
      start += entities.length;
      if (entities.length < count) break;
      if (total == null) {
        selLengthRaw = currentDs.entitysel?._private?.selLength;
        if (typeof selLengthRaw === 'number' && Number.isFinite(selLengthRaw) && selLengthRaw > 0) {
          total = selLengthRaw;
        }
      }
    }

    return all;
  }, [buildRowFromEntity, fetchEntitiesPage]);

  useEffect(() => {
    let cancelled = false;

    if (!useClientSideModel) {
      setClientRowData(null);
      return;
    }

    const load = async () => {
      const rows = await loadAllClientRows();
      if (!cancelled) setClientRowData(rows);
    };

    void load();

    if (!ds) {
      return () => {
        cancelled = true;
      };
    }

    const onChanged = () => {
      void load();
    };
    ds.addListener?.('changed', onChanged);
    return () => {
      cancelled = true;
      ds.removeListener?.('changed', onChanged);
    };
  }, [useClientSideModel, ds, clientLoadKey, loadAllClientRows]);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    if (useClientSideModel) return;
    params.api.setGridOption('datasource', {
      getRows: async (rowParams: IGetRowsParams) => {
        const currentDs = dsRef.current;
        if (!currentDs) {
          rowParams.successCallback([], 0);
          return;
        }
        const count = rowParams.endRow - rowParams.startRow;
        if (count <= 0) {
          rowParams.successCallback([], 0);
          return;
        }
        try {
          const entities = await fetchEntitiesPage(rowParams.startRow, count);
          const cols = columnsRef.current;
          const selLength = (currentDs as any).entitysel?._private?.selLength;
          const rows = entities.map((data: any, index: number) =>
            buildRowFromEntity(data, rowParams.startRow + index, cols),
          );
          const total =
            typeof selLength === 'number' && Number.isFinite(selLength) && selLength >= 0
              ? selLength
              : undefined;
          const lastRow =
            total != null
              ? total
              : Array.isArray(entities) && entities.length < count
                ? rowParams.startRow + entities.length
                : undefined;
          rowParams.successCallback(rows, lastRow as any);
        } catch {
          rowParams.failCallback();
        }
      },
    });
  }, [useClientSideModel, buildRowFromEntity, fetchEntitiesPage]);

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
      if (useClientSideModel) {
        setClientRowData(await loadAllClientRows());
      } else {
        gridRef.current?.api?.refreshInfiniteCache();
      }
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
        payload[c.source] = data?.[simpleAgGridRowField(c)];
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
    const dataCols = columns.map((col) => {
      const field = simpleAgGridRowField(col);
      return {
        field,
        headerName: resolveSimpleColumnTitle(col.title, i18n, lang),
        context: { source: col.source },
        hide: !!col.hidden,
        editable: (params: any) =>
          enableAddNewRow && col.editable !== false && !!params.data?.__isInputRow,
        headerClass: col.editable !== false ? 'editable-cell' : '',
        sortable: !!col.sorting,
        width: col.width,
        flex: col.flex,
        cellRendererParams: {
          format: col.format ?? '',
          dataType: col.dataType ?? 'string',
        },
      };
    });
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
  }, [columns, enableAddNewRow, enableRowDrag, i18n, lang, rowNumberColDef, showRowNumbers]);

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
      const col = cols.find((c) => simpleAgGridRowField(c) === event.colDef.field);
      const isInputRow = !!event.data?.__isInputRow;
      const rowIndex = event.node?.rowIndex ?? -1;

      const payload: Record<string, any> = {};
      cols.forEach((c) => {
        payload[c.source] = event.data?.[simpleAgGridRowField(c)];
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
        // Unmanaged row drag: reorder local rowData so the grid reflects the drop.
        setClientRowData((rows) => {
          if (!rows?.length || !event.node?.data) return rows;
          const from = rows.indexOf(event.node.data);
          if (from < 0) return rows;
          let to = toIndex;
          if (enableAddNewRowRef.current) {
            to = Math.max(0, to - 1);
          }
          to = Math.min(Math.max(0, to), rows.length - 1);
          if (from === to) return rows;
          const next = [...rows];
          const [moved] = next.splice(from, 1);
          next.splice(to, 0, moved);
          return next;
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
        payload[c.source] = event.data?.[simpleAgGridRowField(c)];
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
              key={useClientSideModel ? 'client' : 'infinite'}
              ref={gridRef}
              rowModelType={useClientSideModel ? 'clientSide' : 'infinite'}
              rowData={useClientSideModel ? (clientRowData ?? []) : undefined}
              cacheBlockSize={useClientSideModel ? undefined : CACHE_BLOCK_SIZE}
              maxBlocksInCache={useClientSideModel ? undefined : 10}
              cacheOverflowSize={useClientSideModel ? undefined : 2}
              maxConcurrentDatasourceRequests={useClientSideModel ? undefined : 1}
              rowBuffer={useClientSideModel ? undefined : 0}
              onGridReady={onGridReady}
              pinnedTopRowData={enableAddNewRow ? pinnedTopRowData : []}
              columnDefs={colDefs}
              defaultColDef={defaultColDef}
              rowDragManaged={false}
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
  return col ? data[simpleAgGridRowField(col)] : undefined;
}

export default SimpleAgGrid;
