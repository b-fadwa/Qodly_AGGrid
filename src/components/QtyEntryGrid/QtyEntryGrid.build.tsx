import { useDatasourceSub, useEnhancedNode } from '@ws-ui/webform-editor';
import cn from 'classnames';
import { FC, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, themeQuartz } from 'ag-grid-community';
import { BsFillInfoCircleFill } from 'react-icons/bs';
import { IQtyEntryGridProps } from './QtyEntryGrid.config';

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
  disabled,
  style,
  className,
  classNames = [],
}) => {
  const {
    connectors: { connect },
  } = useEnhancedNode();

  const colDefs: ColDef[] = useMemo(
    () =>
      columns.map((col) => ({
        field: col.title,
        hide: !!col.hidden,
        editable: col.editable !== false,
        sortable: !!col.sorting,
        width: col.width,
        flex: col.flex,
      })),
    [columns],
  );

  const defaultColDef = useMemo<ColDef>(() => ({ flex: 1, minWidth: 80, cellDataType: false }), []);

  const rowData = useMemo(
    () =>
      Array.from({ length: 8 }, (_, idx) => {
        const row: any = { __rowIndex: idx };
        columns.forEach((col) => {
          row[col.title] = col.source;
        });
        return row;
      }),
    [columns],
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
  });

  useDatasourceSub();

  return (
    <div ref={connect} style={style} className={cn(className, classNames)}>
      {datasource ? (
        columns.length > 0 ? (
          <AgGridReact
            rowData={rowData}
            columnDefs={colDefs}
            defaultColDef={defaultColDef}
            suppressCellFocus={true}
            singleClickEdit={true}
            stopEditingWhenCellsLoseFocus={true}
            theme={theme}
            className={cn({ 'pointer-events-none opacity-40': disabled })}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-lg border bg-purple-400 py-4 text-white">
            <BsFillInfoCircleFill className="mb-1 h-8 w-8" />
            <p>Please add columns</p>
          </div>
        )
      ) : (
        <div className="flex h-full flex-col items-center justify-center rounded-lg border bg-purple-400 py-4 text-white">
          <BsFillInfoCircleFill className="mb-1 h-8 w-8" />
          <p>Please attach a datasource</p>
        </div>
      )}
    </div>
  );
};

export default QtyEntryGrid;

