import { useDatasourceSub, useEnhancedNode } from '@ws-ui/webform-editor';
import cn from 'classnames';
import { FC, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ISimpleAgGridProps } from './SimpleAgGrid.config';
import { ColDef, themeQuartz } from 'ag-grid-community';
import { BsFillInfoCircleFill } from 'react-icons/bs';

const SimpleAgGrid: FC<ISimpleAgGridProps> = ({
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
  enableAddNewRow = true,
  showFooter = true,
  enableRowDrag = true,
  style,
  className,
  classNames = [],
}) => {
  const {
    connectors: { connect },
  } = useEnhancedNode();

  const colDefs: ColDef[] = useMemo(() => {
    const dataCols = columns.map((col) => ({
      field: col.title,
      editable: enableAddNewRow && col.editable !== false,
      sortable: !!col.sorting,
      width: col.width,
      flex: col.flex,
    }));
    const base: ColDef[] = [];
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
        cellRenderer: (params: any) => {
          if (!params.data?.__isInputRow) return null;
          return (
            <span
              title="Save new row"
              style={{
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
            </span>
          );
        },
      });
    }
    return base;
  }, [columns, enableAddNewRow, enableRowDrag]);

  const defaultColDef = useMemo<ColDef>(() => ({ flex: 1, minWidth: 80 }), []);

  const rowSelection = useMemo(
    () => ({
      mode: 'singleRow' as const,
      enableClickSelection: true,
      checkboxes: false,
      isRowSelectable: (node: any) => !!node.data && !node.data.__isInputRow,
    }),
    [],
  );

  const pinnedTopRowData = useMemo(() => {
    if (!enableAddNewRow) return [];
    const row: any = { __isInputRow: true };
    columns.forEach((col) => {
      row[col.title] = '';
    });
    return [row];
  }, [columns, enableAddNewRow]);

  const rowData = useMemo(
    () =>
      Array.from({ length: 10 }, () => {
        const row: any = {};
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
          <div className="flex flex-col h-full" style={{ overflow: 'hidden' }}>
            <div style={{ flex: 1, minHeight: 0 }}>
              <AgGridReact
                rowData={rowData}
                pinnedTopRowData={pinnedTopRowData}
                columnDefs={colDefs}
                defaultColDef={defaultColDef}
                rowDragManaged={enableRowDrag}
                rowSelection={rowSelection}
                suppressCellFocus={true}
                theme={theme}
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

export default SimpleAgGrid;
