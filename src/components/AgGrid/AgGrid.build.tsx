import { useDatasourceSub, useEnhancedNode } from '@ws-ui/webform-editor';
import cn from 'classnames';
import { FC, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { IAgGridProps } from './AgGrid.config';
import { ColDef, themeQuartz } from 'ag-grid-community';
import { BsFillInfoCircleFill } from 'react-icons/bs';

const AgGrid: FC<IAgGridProps> = ({
  datasource,
  columns,
  spacing,
  accentColor,
  backgroundColor,
  textColor,
  fontSize,
  oddRowBackgroundColor,
  borderColor,
  wrapperBorderRadius,
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
  disabled,
  style,
  className,
  classNames = [],
}) => {
  const {
    connectors: { connect },
  } = useEnhancedNode();

  const colDefs: ColDef[] = columns.map((col) => ({ field: col.title }));
  const defaultColDef = useMemo<ColDef>(() => {
    return {
      flex: 1,
      minWidth: 100,
    };
  }, []);
  const rowData: any[] = Array.from({ length: 20 }, () => {
    const row: any = {};
    columns.forEach((col) => {
      row[col.title] = col.source;
    });
    return row;
  });

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
    oddRowBackgroundColor,
    headerBackgroundColor,
    headerTextColor,
    headerColumnBorder,
    headerVerticalPaddingScale,
    headerFontSize,
    headerFontWeight,
    cellHorizontalPaddingScale,
    rowVerticalPaddingScale,
    iconSize,
    rangeSelectionBorderColor: 'transparent',
  });

  useDatasourceSub();

  return (
    <div ref={connect} style={style} className={cn(className, classNames)}>
      <div className="flex flex-col gap-2 h-full">
        {/* AGGrid header actions */}
        <div className="grid-header flex gap-2 items-center cursor-pointer flex-wrap">
          {/* actions section */}
          <div className="actions-section flex flex-col gap-2 mr-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800">
            <span className="actions-title font-semibold">Actions:</span>
            <div className="flex gap-2">
              <button className='header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800' >New</button>
              <button className='header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800' >All</button>
              <button className='header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800' >Minus</button>
              <button className='header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800' >Reduce</button>
              <button className='header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800'>Print</button>
            </div>
          </div>
          {/* columns customizer button */}
          <div className="customizer-section flex flex-col gap-2 mr-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800">
            <span className="customizer-title font-semibold">View:</span>
            <div className="flex gap-2">
              <button
                className="header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800"
              >
                Customize columns
              </button>
              <button
                className="header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800"
              >
                Reset default view
              </button>
            </div>
          </div>
          {/* new view section */}
          <div className="view-section flex flex-col gap-2 mr-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800">
            <span className="view-title font-semibold">Save view:</span>
            <div className="flex gap-2">
              <input type="text" placeholder="View name" className="view-input rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-800" />
              <button className='header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800'>Save new</button>
            </div>
          </div>
          {/* saved views section */}
          <div className="views-section flex flex-col gap-2 mr-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800">
            <span className="views-title font-semibold">Saved views:</span>
            <div className="flex gap-2">
              <select className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-800" >
                <option value="">Select view</option>
              </select>
              <button className='header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800' >Load</button>
              <button className='header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800' >Overwrite</button>
              <button className='header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800' >Delete</button>

            </div>
          </div>
        </div>
        {datasource ? (
          columns.length > 0 ? (
            <AgGridReact
              rowData={rowData}
              columnDefs={colDefs}
              defaultColDef={defaultColDef}
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
    </div>
  );
};

export default AgGrid;
