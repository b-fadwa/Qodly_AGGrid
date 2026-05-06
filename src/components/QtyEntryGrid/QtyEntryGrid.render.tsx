import { useDataLoader, useRenderer, useSources } from '@ws-ui/webform-editor';
import cn from 'classnames';
import { CSSProperties, FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
  CellDoubleClickedEvent,
  CellValueChangedEvent,
  ColDef,
  GridReadyEvent,
  IGetRowsParams,
  RowDoubleClickedEvent,
  themeQuartz,
} from 'ag-grid-community';
import get from 'lodash/get';
import CustomCell from '../AgGrid/CustomCell';
import { IQtyEntryGridProps, IQtyEntryColumn } from './QtyEntryGrid.config';

const QtyEntryGrid: FC<IQtyEntryGridProps> = ({
  datasource,
  columns,
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
  className,
  classNames = [],
}) => {
  const { connect, emit } = useRenderer({
    autoBindEvents: !disabled,
    omittedEvents: [],
  });

  const {
    sources: { datasource: ds },
  } = useSources({ acceptIteratorSel: true });

  const { fetchPage } = useDataLoader({ source: ds });
  const gridRef = useRef<AgGridReact>(null);

  const columnsRef = useRef<IQtyEntryColumn[]>(columns);
  columnsRef.current = columns;
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;
  const dsRef = useRef(ds);
  dsRef.current = ds;

  const [rowData, setRowData] = useState<any[]>([]);
  const hasEntitySel = !!(ds as any)?.entitysel;

  const loadScalarData = useCallback(async () => {
    const currentDs = dsRef.current;
    if (!currentDs) return;
    try {
      const cols = columnsRef.current;
      const raw = await (currentDs as any).getValue?.();
      const arr = Array.isArray(raw) ? raw : [];
      const rows = arr.map((data: any, index: number) => {
        const row: any = { __entity: data, __rowIndex: index };
        cols.forEach((col) => {
          const source = typeof col?.source === 'string' ? col.source.trim() : '';
          row[col.title] = source ? get(data, source) : undefined;
        });
        return row;
      });
      setRowData(rows);
    } catch {
      setRowData([]);
    }
  }, []);

  useEffect(() => {
    if (!hasEntitySel) void loadScalarData();
  }, [hasEntitySel, loadScalarData]);

  useEffect(() => {
    if (!ds) return;
    if (!hasEntitySel) void loadScalarData();
    const handler = async () => {
      if (hasEntitySel) {
        gridRef.current?.api?.refreshInfiniteCache();
      } else {
        await loadScalarData();
      }
    };
    ds.addListener?.('changed', handler);
    return () => ds.removeListener?.('changed', handler);
  }, [ds, hasEntitySel, loadScalarData]);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    if (!hasEntitySel) return;
    params.api.setGridOption('datasource', {
      getRows: async (rowParams: IGetRowsParams) => {
        const currentDs = dsRef.current;
        if (!currentDs || !(currentDs as any).entitysel) {
          rowParams.successCallback([], 0);
          return;
        }
        const count = rowParams.endRow - rowParams.startRow;
        if (count <= 0) {
          rowParams.successCallback([], 0);
          return;
        }
        try {
          const entities = await fetchPageRef.current(rowParams.startRow, count);
          const cols = columnsRef.current;
          const selLengthRaw = (currentDs as any).entitysel?._private?.selLength;
          const dsLengthRaw = (currentDs as any)?.length;
          const total =
            typeof selLengthRaw === 'number' && Number.isFinite(selLengthRaw) && selLengthRaw >= 0
              ? selLengthRaw
              : typeof dsLengthRaw === 'number' && Number.isFinite(dsLengthRaw) && dsLengthRaw >= 0
                ? dsLengthRaw
                : undefined;
          const rows = (Array.isArray(entities) ? entities : []).map((data: any, index: number) => {
            const row: any = { __entity: data, __rowIndex: rowParams.startRow + index };
            cols.forEach((col) => {
              const source = typeof col?.source === 'string' ? col.source.trim() : '';
              row[col.title] = source ? get(data, source) : undefined;
            });
            return row;
          });
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
  }, [hasEntitySel]);

  const colDefs: ColDef[] = useMemo(
    () =>
      columns.map((col) => ({
        field: col.title,
        source: col.source,
        hide: !!col.hidden,
        editable: !disabled && col.editable === true,
        sortable: !!col.sorting,
        width: col.width,
        flex: col.flex,
        cellRendererParams: {
          format: col.format ?? '',
          dataType: col.dataType ?? 'string',
        },
      })),
    [columns, disabled],
  );

  const defaultColDef = useMemo<ColDef>(
    () => ({
      flex: 1,
      minWidth: 80,
      cellDataType: false,
      cellRenderer: CustomCell,
    }),
    [],
  );

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

  const resolvedStyle = useMemo<CSSProperties>(() => {
    const s = { ...style };
    if (!s.height) s.height = '600px';
    return s;
  }, [style]);

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent) => {
      const cols = columnsRef.current;
      const col = cols.find((c) => c.title === event.colDef.field);
      const rowIndex = event.node?.rowIndex ?? event.data?.__rowIndex ?? -1;

      const payload: Record<string, any> = {};
      cols.forEach((c) => {
        payload[c.source] = event.data?.[c.title];
      });

      emit('oncellvaluechanged', {
        column: col?.source ?? event.colDef.field,
        value: event.newValue,
        oldValue: event.oldValue,
        rowIndex,
        rowData: payload,
        entity: event.data?.__entity,
      });

      // Keep React state in sync in case grid mutates row objects in-place.
      setRowData((prev) => prev.map((r, i) => (i === rowIndex ? { ...event.data } : r)));
    },
    [emit],
  );

  const onCellDoubleClicked = useCallback(
    (event: CellDoubleClickedEvent) => {
      const cols = columnsRef.current;
      const col = cols.find((c) => c.title === event.colDef.field);
      const rowIndex = event.node?.rowIndex ?? (event.data as any)?.__rowIndex ?? -1;

      const payload: Record<string, any> = {};
      cols.forEach((c) => {
        payload[c.source] = (event.data as any)?.[c.title];
      });

      emit('oncelldblclick', {
        column: col?.source ?? event.colDef.field,
        value: event.value,
        rowIndex,
        rowData: payload,
        entity: (event.data as any)?.__entity,
      });
    },
    [emit],
  );

  const onRowDoubleClicked = useCallback(
    (event: RowDoubleClickedEvent) => {
      const cols = columnsRef.current;
      const rowIndex = event.node?.rowIndex ?? (event.data as any)?.__rowIndex ?? -1;

      const payload: Record<string, any> = {};
      cols.forEach((c) => {
        payload[c.source] = (event.data as any)?.[c.title];
      });

      emit('onrowdblclick', {
        rowIndex,
        rowData: payload,
        entity: (event.data as any)?.__entity,
      });
    },
    [emit],
  );

  return (
    <div ref={connect} style={resolvedStyle} className={cn(className, classNames)}>
      {ds || datasource ? (
        <AgGridReact
          key={hasEntitySel ? 'qty-entry-entitysel' : 'qty-entry-scalar'}
          ref={gridRef}
          rowData={hasEntitySel ? undefined : rowData}
          columnDefs={colDefs}
          defaultColDef={defaultColDef}
          rowModelType={hasEntitySel ? 'infinite' : undefined}
          suppressCellFocus={true}
          onGridReady={onGridReady}
          onCellValueChanged={onCellValueChanged}
          onCellDoubleClicked={onCellDoubleClicked}
          onRowDoubleClicked={onRowDoubleClicked}
          singleClickEdit={true}
          stopEditingWhenCellsLoseFocus={true}
          theme={theme}
          className={cn({ 'pointer-events-none opacity-40': disabled })}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center rounded-lg border bg-purple-400 py-4 text-white">
          <p>Error: No datasource</p>
        </div>
      )}
    </div>
  );
};

export default QtyEntryGrid;

