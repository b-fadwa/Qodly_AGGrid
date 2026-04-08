import { useDataLoader, useRenderer, useSources } from '@ws-ui/webform-editor';
import cn from 'classnames';
import { CSSProperties, FC, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { CellValueChangedEvent, ColDef, themeQuartz } from 'ag-grid-community';
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

  const columnsRef = useRef<IQtyEntryColumn[]>(columns);
  columnsRef.current = columns;
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;
  const dsRef = useRef(ds);
  dsRef.current = ds;

  const [rowData, setRowData] = useState<any[]>([]);

  const loadAllData = useCallback(async () => {
    const currentDs = dsRef.current;
    if (!currentDs) return;
    try {
      // Support both:
      // - entity selection (entitysel) with paging
      // - scalar array datasource (plain JS array), e.g. [{...}, {...}]
      const entitySel = (currentDs as any).entitysel;
      const cols = columnsRef.current;

      if (entitySel?._private?.selLength !== undefined) {
        const selLength = entitySel._private?.selLength ?? 0;
        if (selLength === 0) {
          setRowData([]);
          return;
        }
        const entities = await fetchPageRef.current(0, selLength);
        const rows = entities.map((data: any, index: number) => {
          const row: any = { __entity: data, __rowIndex: index };
          cols.forEach((col) => {
            row[col.title] = data?.[col.source];
          });
          return row;
        });
        setRowData(rows);
        return;
      }

      const raw = await (currentDs as any).getValue?.();
      const arr = Array.isArray(raw) ? raw : [];
      const rows = arr.map((data: any, index: number) => {
        const row: any = { __entity: data, __rowIndex: index };
        cols.forEach((col) => {
          row[col.title] = data?.[col.source];
        });
        return row;
      });
      setRowData(rows);
    } catch {
      setRowData([]);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    if (!ds) return;
    const handler = async () => {
      await loadAllData();
    };
    ds.addListener?.('changed', handler);
    return () => ds.removeListener?.('changed', handler);
  }, [ds, loadAllData]);

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

  return (
    <div ref={connect} style={resolvedStyle} className={cn(className, classNames)}>
      {datasource ? (
        <AgGridReact
          rowData={rowData}
          columnDefs={colDefs}
          defaultColDef={defaultColDef}
          suppressCellFocus={true}
          onCellValueChanged={onCellValueChanged}
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

