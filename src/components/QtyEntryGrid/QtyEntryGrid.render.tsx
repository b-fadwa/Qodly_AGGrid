import {
  EntityActions,
  entitySubject,
  formatValue,
  useDataLoader,
  useDsChangeHandler,
  useEnhancedNode,
  useRenderer,
  useSources,
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
import {
  CellDoubleClickedEvent,
  CellValueChangedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  IGetRowsParams,
  RowDoubleClickedEvent,
  ValueFormatterParams,
  ValueParserParams,
  themeQuartz,
} from 'ag-grid-community';
import get from 'lodash/get';
import { parseDuration } from '@ws-ui/formatter';
import CustomCell from '../AgGrid/CustomCell';
import {
  buildSelectedRowsClipboardText,
  isCopyShortcut,
  isEditableTarget,
  writeTextToClipboard,
} from '../AgGrid/AgGrid.clipboard';
import { IQtyEntryGridProps, IQtyEntryColumn } from './QtyEntryGrid.config';

// Matches "H:mm", "HH:mm" or "HH:mm:ss" (optionally negative).

const DURATION_INPUT_RE = /^-?\d{1,3}:[0-5]?\d(?::[0-5]?\d)?$/;

const parseDurationInput = (input: unknown, fallback: unknown): unknown => {
  if (input == null || input === '') return null;

  if (typeof input === 'number') {
    return Number.isFinite(input) ? input : fallback;
  }

  if (input instanceof Date) {
    return input.getTime();
  }

  if (typeof input !== 'string') {
    return fallback;
  }

  const value = input.trim();

  if (!value) return null;

  if (DURATION_INPUT_RE.test(value)) {
    return parseDuration(value);
  }

  const milliseconds = Number(value);

  return Number.isFinite(milliseconds) ? milliseconds : fallback;
};

const stringifyClipboardValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const buildRowClipboardText = (api: GridApi, rowIndex: number): string => {
  const rowNode = api.getDisplayedRowAtIndex(rowIndex);
  if (!rowNode?.data) return '';

  const columns = api
    .getAllDisplayedColumns()
    .filter((column: any) => !!column.getColDef?.()?.field);
  if (!columns.length) return '';

  const headers = columns
    .map((column: any) =>
      String(
        column.getColDef?.()?.headerName ??
          column.getColDef?.()?.field ??
          column.getColId?.() ??
          '',
      ),
    )
    .join('\t');
  const values = columns
    .map((column: any) => {
      const field = column.getColDef?.()?.field;
      return stringifyClipboardValue(field ? rowNode.data[field] : '');
    })
    .join('\t');

  return [headers, values].filter(Boolean).join('\n');
};

const formatDurationForEdit = (value: unknown, format?: string): string => {
  if (value == null || value === '') return '';
  if (format) return String(formatValue(value as any, 'duration', format));
  if (typeof value === 'string') return value;
  return String(value);
};

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
  enableCopySelectedValue = false,
  enableCopySelectedRow = false,
  className,
  classNames = [],
}) => {
  const { connect, emit } = useRenderer({
    autoBindEvents: !disabled,
    omittedEvents: [],
  });

  const {
    sources: { datasource: ds, currentElement },
  } = useSources({ acceptIteratorSel: true });

  const { id: nodeID } = useEnhancedNode();
  const { fetchIndex, fetchPage } = useDataLoader({ source: ds });
  const gridRef = useRef<AgGridReact>(null);

  const columnsRef = useRef<IQtyEntryColumn[]>(columns);
  columnsRef.current = columns;
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;
  const dsRef = useRef(ds);
  dsRef.current = ds;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isGridActiveRef = useRef(false);
  const lastSelectedRowIndexRef = useRef<number | null>(null);

  const [rowData, setRowData] = useState<any[]>([]);
  const [selected, setSelected] = useState(-1);
  const [scrollIndex, setScrollIndex] = useState(0);
  const [, setCount] = useState(0);
  const isSelectingRef = useRef(false);
  const hasEntitySel = !!(ds as any)?.entitysel;
  const isRowCopyEnabled = enableCopySelectedValue || enableCopySelectedRow;

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
      if (isSelectingRef.current) return;
      if (hasEntitySel) {
        gridRef.current?.api?.refreshInfiniteCache();
      } else {
        await loadScalarData();
      }
    };
    ds.addListener?.('changed', handler);
    return () => ds.removeListener?.('changed', handler);
  }, [ds, hasEntitySel, loadScalarData]);

  const onGridReady = useCallback(
    (params: GridReadyEvent) => {
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
                : typeof dsLengthRaw === 'number' &&
                    Number.isFinite(dsLengthRaw) &&
                    dsLengthRaw >= 0
                  ? dsLengthRaw
                  : undefined;
            const rows = (Array.isArray(entities) ? entities : []).map(
              (data: any, index: number) => {
                const row: any = { __entity: data, __rowIndex: rowParams.startRow + index };
                cols.forEach((col) => {
                  const source = typeof col?.source === 'string' ? col.source.trim() : '';
                  row[col.title] = source ? get(data, source) : undefined;
                });
                return row;
              },
            );
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
    },
    [hasEntitySel],
  );

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
      if (hasEntitySel) {
        gridRef.current?.api?.refreshInfiniteCache();
      } else {
        await loadScalarData();
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

  const colDefs: ColDef[] = useMemo(
    () =>
      columns.map((col) => {
        const def: ColDef = {
          field: col.title,
          source: col.source,
          hide: !!col.hidden,
          editable: !disabled && col.editable === true,
          headerClass: col.editable === true ? 'editable-cell' : '',
          sortable: !!col.sorting,
          width: col.width,
          flex: col.flex,
          cellRendererParams: {
            format: col.format ?? '',
            dataType: col.dataType ?? 'string',
          },
        } as ColDef;

        if (col.dataType === 'duration') {
          def.valueFormatter = (params: ValueFormatterParams) =>
            formatDurationForEdit(params.value, col.format);
          def.cellEditorParams = { useFormatter: true };
          def.valueParser = (params: ValueParserParams) =>
            parseDurationInput(params.newValue, params.oldValue);
        }

        return def;
      }),
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

  const buildPayloadFromRow = useCallback((data: any) => {
    const cols = columnsRef.current;
    const payload: Record<string, any> = {};
    cols.forEach((c) => {
      const fromDisplayedRow = data?.[c.title];
      const fromEntity = get(data?.__entity, c.source);
      payload[c.source] = fromDisplayedRow !== undefined ? fromDisplayedRow : fromEntity;
    });
    return payload;
  }, []);

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent) => {
      const cols = columnsRef.current;
      const col = cols.find((c) => c.title === event.colDef.field);
      const rowIndex = event.node?.rowIndex ?? event.data?.__rowIndex ?? -1;
      const payload = buildPayloadFromRow(event.data);

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
    [emit, buildPayloadFromRow],
  );

  const onCellDoubleClicked = useCallback(
    (event: CellDoubleClickedEvent) => {
      const cols = columnsRef.current;
      const col = cols.find((c) => c.title === event.colDef.field);
      const rowIndex = event.node?.rowIndex ?? (event.data as any)?.__rowIndex ?? -1;
      const payload = buildPayloadFromRow(event.data);

      emit('oncelldblclick', {
        column: col?.source ?? event.colDef.field,
        value: event.value,
        rowIndex,
        rowData: payload,
        entity: (event.data as any)?.__entity,
      });
    },
    [emit, buildPayloadFromRow],
  );

  const copySelectedRow = useCallback(
    (event: KeyboardEvent | ReactKeyboardEvent<HTMLDivElement>) => {
      if (!isRowCopyEnabled || disabled || isEditableTarget(event.target)) return;
      const keyboardEvent = 'nativeEvent' in event ? event.nativeEvent : event;
      if (!isCopyShortcut(keyboardEvent)) return;

      const api = gridRef.current?.api;
      if (!api) return;

      const text =
        buildSelectedRowsClipboardText(api) ||
        (typeof lastSelectedRowIndexRef.current === 'number'
          ? buildRowClipboardText(api, lastSelectedRowIndexRef.current)
          : '');
      if (!text) return;

      event.preventDefault();
      event.stopPropagation();
      void writeTextToClipboard(text);
    },
    [disabled, enableCopySelectedRow, enableCopySelectedValue, isRowCopyEnabled],
  );

  const handleCopySelectedRow = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      copySelectedRow(event);
    },
    [copySelectedRow],
  );

  useEffect(() => {
    if (!isRowCopyEnabled || disabled) return;

    const onDocumentMouseDown = (event: MouseEvent) => {
      isGridActiveRef.current = !!containerRef.current?.contains(event.target as Node);
    };

    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (!isGridActiveRef.current) return;
      copySelectedRow(event);
    };

    document.addEventListener('mousedown', onDocumentMouseDown, true);
    document.addEventListener('keydown', onDocumentKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onDocumentMouseDown, true);
      document.removeEventListener('keydown', onDocumentKeyDown, true);
    };
  }, [copySelectedRow, disabled, isRowCopyEnabled]);

  const onRowClicked = useCallback(
    async (event: any) => {
      if (!event.data) return;
      const rowIndex = event.rowIndex ?? event.data?.__rowIndex;
      if (typeof rowIndex !== 'number') return;
      lastSelectedRowIndexRef.current = rowIndex;
      event.node?.setSelected(true, false);
      if (!dsRef.current) return;
      isSelectingRef.current = true;
      try {
        await updateCurrentDsValue({ index: rowIndex });
      } finally {
        isSelectingRef.current = false;
      }
    },
    [updateCurrentDsValue],
  );

  const onRowDoubleClicked = useCallback(
    async (event: RowDoubleClickedEvent) => {
      const rowIndex = event.node?.rowIndex ?? (event.data as any)?.__rowIndex ?? -1;
      const payload = buildPayloadFromRow(event.data);
      if (rowIndex >= 0) {
        lastSelectedRowIndexRef.current = rowIndex;
        event.node?.setSelected(true, false);
      }

      emit('onrowdblclick', {
        rowIndex,
        rowData: payload,
        entity: (event.data as any)?.__entity,
      });

      if (dsRef.current && event.data) {
        if (rowIndex < 0) return;
        isSelectingRef.current = true;
        try {
          await updateCurrentDsValue({
            index: rowIndex,
            forceUpdate: true,
          });
        } finally {
          isSelectingRef.current = false;
        }
      }
    },
    [emit, buildPayloadFromRow, updateCurrentDsValue],
  );

  const rowSelection = useMemo(
    () => ({
      mode: 'singleRow' as const,
      enableClickSelection: true,
      checkboxes: false,
    }),
    [],
  );

  return (
    <div
      ref={(element) => {
        containerRef.current = element;
        connect(element);
      }}
      style={resolvedStyle}
      className={cn(className, classNames)}
      tabIndex={isRowCopyEnabled && !disabled ? 0 : undefined}
      onKeyDown={handleCopySelectedRow}
      onFocus={() => {
        if (isRowCopyEnabled && !disabled) {
          isGridActiveRef.current = true;
        }
      }}
      onBlur={() => {
        window.setTimeout(() => {
          if (!containerRef.current?.contains(document.activeElement)) {
            isGridActiveRef.current = false;
          }
        }, 0);
      }}
      onMouseDown={() => {
        if (isRowCopyEnabled && !disabled) {
          isGridActiveRef.current = true;
          containerRef.current?.focus();
        }
      }}
    >
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
          onRowClicked={onRowClicked}
          onRowDoubleClicked={onRowDoubleClicked}
          rowSelection={rowSelection}
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
