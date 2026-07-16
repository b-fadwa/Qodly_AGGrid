import {
  EntityActions,
  entitySubject,
  formatValue,
  useDataLoader,
  useDsChangeHandler,
  useEnhancedNode,
  useI18n,
  useLocalization,
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
import { createPortal } from 'react-dom';
import { MdCheck } from 'react-icons/md';
import { AgGridReact } from 'ag-grid-react';
import {
  CellClickedEvent,
  CellDoubleClickedEvent,
  CellValueChangedEvent,
  ColDef,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  IGetRowsParams,
  IHeaderParams,
  IRowNode,
  RowClassParams,
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

interface CellOptionMenuState {
  colId: string;
  rowNode: IRowNode;
  currentValue: any;
  options: { value: any; label: string }[];
  top: number;
  left: number;
  minWidth: number;
}

/** Treats the option's raw value itself as an i18n key — same lookup shape as `AgGrid.build.tsx`'s `translation`. */
const translateOptionValue = (
  value: any,
  i18n: { keys?: Record<string, Record<string, unknown>> } | null | undefined,
  lang: string | undefined,
): string => {
  const key = String(value);
  const entry = i18n?.keys?.[key] as Record<string, unknown> | undefined;
  const translated = (lang ? entry?.[lang] : undefined) ?? entry?.default;
  return translated !== undefined && translated !== null ? String(translated) : key;
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

const ROW_NUMBER_COL_ID = '__qodlyRowNumber';

const RowNumberCell: FC<ICellRendererParams> = (params) => (
  <span style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
    {params.value ?? ''}
  </span>
);

// -- Boolean checkbox cell renderer --
// Always interactive; only the grid-level `disabled` prop (via context) locks it.
const BoolCheckboxCell = (params: any) => {
  const { value, node, colDef, context } = params;
  const gridDisabled = !!context?.gridDisabled;

  return (
    <div className="flex items-center justify-center h-full">
      <input
        type="checkbox"
        checked={!!value}
        disabled={gridDisabled}
        onChange={(e) => {
          if (!gridDisabled) {
            // node.setDataValue goes through AG Grid's value pipeline and triggers onCellValueChanged
            node.setDataValue(colDef.field, e.target.checked);
          }
        }}
        style={{ width: 14, height: 14, cursor: gridDisabled ? 'default' : 'pointer' }}
      />
    </div>
  );
};

// -- Clickable column header --
const ClickableHeader = (
  params: IHeaderParams & { onHeaderClick?: (info: { column: string; ctrlKey: boolean }) => void },
) => {
  const { displayName, column, onHeaderClick } = params;
  return (
    <div
      className="flex items-center h-full w-full select-none"
      style={{ cursor: 'pointer' }}
      onClick={(e) => {
        onHeaderClick?.({
          column: (column as any)?.getColDef()?.field ?? '',
          ctrlKey: e.ctrlKey || e.metaKey,
        });
      }}
    >
      {displayName}
    </div>
  );
};

const QtyEntryGrid: FC<IQtyEntryGridProps> = ({
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
  enableCopySelectedValue = false,
  enableCopySelectedRow = false,
  showRowNumbers = false,
  className,
  classNames = [],
}) => {
  const { connect, emit } = useRenderer({
    autoBindEvents: !disabled,
    omittedEvents: [],
  });

  const {
    sources: { datasource: ds, currentElement },
    actions: { getDatasource },
  } = useSources({ acceptIteratorSel: true });

  const { id: nodeID } = useEnhancedNode();
  const { i18n } = useI18n();
  const { selected: lang } = useLocalization();
  const { fetchIndex, fetchPage } = useDataLoader({ source: ds });
  const gridRef = useRef<AgGridReact>(null);

  const columnsRef = useRef<IQtyEntryColumn[]>(columns);
  columnsRef.current = columns;
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;
  const dsRef = useRef(ds);
  dsRef.current = ds;
  // Keep emit in a ref so stable callbacks (empty dep arrays) always call the latest emit
  const emitRef = useRef(emit);
  emitRef.current = emit;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isGridActiveRef = useRef(false);
  const lastSelectedRowIndexRef = useRef<number | null>(null);

  const [rowData, setRowData] = useState<any[]>([]);
  const [selected, setSelected] = useState(-1);
  const [scrollIndex, setScrollIndex] = useState(0);
  const [, setCount] = useState(0);
  const isSelectingRef = useRef(false);
  const hasEntitySel = !!(ds as any)?.entitysel;

  const [cellOptionMenu, setCellOptionMenu] = useState<CellOptionMenuState | null>(null);
  const cellOptionMenuRef = useRef<HTMLDivElement | null>(null);
  const isRowCopyEnabled = enableCopySelectedValue || enableCopySelectedRow;

  const getDatasourceRef = useRef(getDatasource);
  getDatasourceRef.current = getDatasource;

  // Preloaded once per distinct (colId, optionsSource) pair and kept in sync via `changed` —
  // the picker then opens instantly instead of awaiting a fetch on every click.
  const [optionsListsByColumn, setOptionsListsByColumn] = useState<Map<string, any[]>>(new Map());
  const optionsListsByColumnRef = useRef(optionsListsByColumn);
  optionsListsByColumnRef.current = optionsListsByColumn;

  const optionsSourcesKey = useMemo(
    () =>
      columns
        .map(
          (c) =>
            `${c.title}::${typeof c.optionsSource === 'string' ? c.optionsSource.trim() : ''}`,
        )
        .join('|'),
    [columns],
  );

  useEffect(() => {
    const sourceByColId = new Map<string, string>();
    columnsRef.current.forEach((col) => {
      const src = typeof col.optionsSource === 'string' ? col.optionsSource.trim() : '';
      if (src) sourceByColId.set(col.title, src);
    });

    if (sourceByColId.size === 0) {
      setOptionsListsByColumn(new Map());
      return;
    }

    let cancelled = false;
    const resolvedDatasources: any[] = [];

    const loadAll = async () => {
      const next = new Map<string, any[]>();
      await Promise.all(
        Array.from(sourceByColId.entries()).map(async ([colId, src]) => {
          const optionsDs = getDatasourceRef.current(src) as any;
          try {
            const raw = await optionsDs?.getValue?.();
            next.set(colId, Array.isArray(raw) ? raw : []);
          } catch {
            next.set(colId, []);
          }
        }),
      );
      if (!cancelled) setOptionsListsByColumn(next);
    };

    void loadAll();

    sourceByColId.forEach((src) => {
      const optionsDs = getDatasourceRef.current(src) as any;
      if (optionsDs?.addListener) {
        optionsDs.addListener('changed', loadAll);
        resolvedDatasources.push(optionsDs);
      }
    });

    return () => {
      cancelled = true;
      resolvedDatasources.forEach((optionsDs) => optionsDs.removeListener?.('changed', loadAll));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- gated on `optionsSourcesKey`, not `columns`, to avoid refetching on unrelated column edits
  }, [optionsSourcesKey]);

  // Stable header-click handler — uses refs so colDefs memo never has to re-run because of it
  const handleHeaderClick = useCallback(
    ({ column, ctrlKey }: { column: string; ctrlKey: boolean }) => {
      const cols = columnsRef.current;
      const col = cols.find((c) => c.title === column);
      emitRef.current(ctrlKey ? 'onheaderctrlclick' : 'onheaderclick', {
        column: col?.source ?? column,
      });
    },
    [],
  );

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
        const isBool = col.dataType === 'bool' || col.format === 'checkbox';
        const hasOptionMenu = col.enableCellOptionMenu === true;

        const def: ColDef = {
          field: col.title,
          source: col.source,
          hide: !!col.hidden,
          // Bool columns handle their own value changes via node.setDataValue in the checkbox renderer;
          // setting editable:false prevents AG Grid from opening a text editor on click.
          editable: isBool ? false : !disabled && col.editable === true,
          headerClass: [
            col.editable === true ? 'editable-cell' : '',
            hasOptionMenu ? 'option-list-cell' : '',
          ]
            .filter(Boolean)
            .join(' '),
          cellClass: hasOptionMenu ? 'option-list-cell' : undefined,
          sortable: !!col.sorting,
          width: col.width,
          flex: col.flex,
          // Clickable header on every column
          headerComponent: ClickableHeader,
          headerComponentParams: { onHeaderClick: handleHeaderClick },
        } as ColDef;

        if (isBool) {
          // Interactive checkbox renderer — no cellRendererParams needed
          def.cellRenderer = BoolCheckboxCell;
        } else {
          def.cellRendererParams = {
            format: col.format ?? '',
            dataType: col.dataType ?? 'string',
          };

          if (col.dataType === 'duration') {
            def.valueFormatter = (params: ValueFormatterParams) =>
              formatDurationForEdit(params.value, col.format);
            def.cellEditorParams = { useFormatter: true };
            def.valueParser = (params: ValueParserParams) =>
              parseDurationInput(params.newValue, params.oldValue);
          }
        }

        return def;
      }),
    [columns, disabled, handleHeaderClick],
  );

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

  const gridColumnDefs = useMemo(
    () => (showRowNumbers ? [rowNumberColDef, ...colDefs] : colDefs),
    [showRowNumbers, rowNumberColDef, colDefs],
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

  const getRowClass = useCallback(
    (params: RowClassParams) => {
      if (!rowCssField || !params.data) return '';
      const displayed = findValueBySource(params.data, rowCssField, columnsRef.current);
      const value = displayed.found ? displayed.value : params.data.__entity?.[rowCssField];
      if (value === undefined || value === null || value === '') return '';
      const sanitized = String(value)
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .toLowerCase();
      return `qty-entry-row-${sanitized}`;
    },
    [rowCssField],
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

  // -- Click cell option list — non-editable columns only, so it never fights the text editor --

  const maybeOpenCellOptionMenu = useCallback(
    (event: CellClickedEvent, col: IQtyEntryColumn | undefined) => {
      const nativeEvent = event.event as MouseEvent | null;
      const data = event.data;
      if (disabled || !nativeEvent || !event.node || !data) return;
      if (!col || col.enableCellOptionMenu === false) return;
      // Editable columns keep their normal text-edit behavior; the picker only
      // takes over cells that AG Grid wouldn't otherwise let you type into.
      if (col.editable === true) return;
      if (col.dataType === 'bool' || col.format === 'checkbox') return;

      const optionsSrc = typeof col.optionsSource === 'string' ? col.optionsSource.trim() : '';
      if (!optionsSrc) return;

      const colId = event.colDef.field;
      if (!colId) return;

      const valueMap = new Map<string, any>();

      // Dynamic domain (e.g. site/module codes) you don't own — preloaded and kept in sync via
      // the `optionsListsByColumn` effect, so the picker opens instantly with no fetch delay.
      // Strictly this list — nothing merged in from loaded rows or the cell's current value.
      const preloadedValues = optionsListsByColumnRef.current.get(colId) ?? [];
      preloadedValues.forEach((value: any) => {
        if (value === undefined || value === null || value === '') return;
        const key = String(value);
        if (!valueMap.has(key)) valueMap.set(key, value);
      });
      if (valueMap.size === 0) return;

      const currentValue = data[colId];

      const options = Array.from(valueMap.values())
        .map((value) => ({ value, label: translateOptionValue(value, i18n, lang) }))
        .sort((a, b) => a.label.localeCompare(b.label));

      const cellEl = (nativeEvent.target as HTMLElement | null)?.closest(
        '.ag-cell',
      ) as HTMLElement | null;
      const rect = cellEl?.getBoundingClientRect();

      setCellOptionMenu({
        colId,
        rowNode: event.node,
        currentValue,
        options,
        top: rect ? rect.bottom : nativeEvent.clientY,
        left: rect ? rect.left : nativeEvent.clientX,
        minWidth: rect ? rect.width : 160,
      });
    },
    [disabled, i18n, lang],
  );

  const handleSelectCellOption = useCallback((menu: CellOptionMenuState, value: any) => {
    menu.rowNode.setDataValue(menu.colId, value);
    setCellOptionMenu(null);
  }, []);

  useEffect(() => {
    if (!cellOptionMenu) return;
    const close = () => setCellOptionMenu(null);
    const onMouseDown = (e: MouseEvent) => {
      if (cellOptionMenuRef.current?.contains(e.target as Node)) return;
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [cellOptionMenu]);

  const onCellClicked = useCallback(
    (event: CellClickedEvent) => {
      const nativeEvent = event.event as MouseEvent | undefined;
      const ctrlKey = nativeEvent?.ctrlKey || nativeEvent?.metaKey;
      const cols = columnsRef.current;
      const col = cols.find((c) => c.title === event.colDef.field);
      const rowIndex = event.node?.rowIndex ?? (event.data as any)?.__rowIndex ?? -1;
      const payload = buildPayloadFromRow(event.data);

      emit(ctrlKey ? 'oncellctrlclick' : 'oncellclick', {
        column: col?.source ?? event.colDef.field,
        value: event.value,
        rowIndex,
        rowData: payload,
        entity: (event.data as any)?.__entity,
      });

      maybeOpenCellOptionMenu(event, col);
    },
    [emit, buildPayloadFromRow, maybeOpenCellOptionMenu],
  );

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

      // getRowClass isn't re-evaluated on data change alone, so force a redraw
      // when the edited column is the one driving the row's CSS class.
      if (rowCssField && col?.source === rowCssField && event.node) {
        gridRef.current?.api.redrawRows({ rowNodes: [event.node] });
      }
    },
    [emit, buildPayloadFromRow, rowCssField],
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
          columnDefs={gridColumnDefs}
          defaultColDef={defaultColDef}
          rowModelType={hasEntitySel ? 'infinite' : undefined}
          suppressCellFocus={true}
          onGridReady={onGridReady}
          onCellClicked={onCellClicked}
          onCellValueChanged={onCellValueChanged}
          onCellDoubleClicked={onCellDoubleClicked}
          onRowClicked={onRowClicked}
          onRowDoubleClicked={onRowDoubleClicked}
          rowSelection={rowSelection}
          singleClickEdit={true}
          stopEditingWhenCellsLoseFocus={true}
          getRowClass={getRowClass}
          context={{ gridDisabled: disabled }}
          theme={theme}
          className={cn({ 'pointer-events-none opacity-40': disabled })}
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center rounded-lg border bg-purple-400 py-4 text-white">
          <p>Error: No datasource</p>
        </div>
      )}
      {cellOptionMenu && typeof document !== 'undefined'
        ? createPortal(
          <div
            ref={cellOptionMenuRef}
            style={{
              position: 'fixed',
              top: cellOptionMenu.top,
              left: cellOptionMenu.left,
              minWidth: cellOptionMenu.minWidth,
              zIndex: 20050,
              background: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: 4,
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              padding: '4px 0',
              maxHeight: 260,
              overflowY: 'auto',
            }}
          >
            {cellOptionMenu.options.map((opt) => (
              <div
                key={String(opt.value)}
                onClick={() => handleSelectCellOption(cellOptionMenu, opt.label)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  cursor: 'pointer',
                  fontSize: 13,
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f4ff')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ width: 14, display: 'inline-flex', flexShrink: 0 }}>
                  {opt.label === String(cellOptionMenu.currentValue) ? <MdCheck /> : null}
                </span>
                <span>{opt.label}</span>
              </div>
            ))}
          </div>,
          document.body,
        )
        : null}
    </div>
  );
};

function findValueBySource(
  data: any,
  sourceField: string,
  columns: IQtyEntryColumn[],
): { found: boolean; value: any } {
  const col = columns.find((c) => c.source === sourceField);
  return col ? { found: true, value: data[col.title] } : { found: false, value: undefined };
}

export default QtyEntryGrid;
