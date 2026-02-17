import { selectResolver, useDatasourceSub, useEnhancedEditor, useEnhancedNode } from '@ws-ui/webform-editor';
import cn from 'classnames';
import { FC, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { IAgGridProps } from './AgGrid.config';
import { ColDef, themeQuartz } from 'ag-grid-community';
import { BsFillInfoCircleFill } from 'react-icons/bs';
import { Element } from '@ws-ui/craftjs-core';

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
  showColumnActions,
  style,
  className,
  classNames = [],
}) => {
  const {
    connectors: { connect },
  } = useEnhancedNode();
  const { resolver } = useEnhancedEditor(selectResolver);

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
      {datasource ? (
        columns.length > 0 ? (
          <div className="flex flex-col gap-2 h-full">
            {/* AGGrid header actions */}
            {showColumnActions && (

              <div className="grid-header flex gap-2 items-center cursor-pointer flex-wrap">
                {/* actions section */}
                <div className="actions-section flex flex-col gap-2 mr-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800">
                  <Element
                    id="aggrid-actions"
                    is={resolver.Text}
                    classNames={['actions-title font-semibold']}
                    doc={[
                      {
                        type: 'paragraph',
                        children: [{ text: 'Actions' }],
                      },
                    ]}
                  />
                  <div className="flex gap-2">
                    <Element
                      id="agGridActions"
                      is={resolver.StyleBox}
                      canvas
                    ></Element>
                  </div>
                </div>
                {/* columns customizer button */}
                <div className="customizer-section flex flex-col gap-2 mr-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800">
                  <Element
                    id="aggrid-customizer-title"
                    is={resolver.Text}
                    classNames={['customizer-title font-semibold']}
                    doc={[
                      {
                        type: 'paragraph',
                        children: [{ text: 'View' }],
                      },
                    ]}
                  />
                  <div className="flex gap-2">
                    <Element
                      id="aggrid-header-button1"
                      is={resolver.Button}
                      text="Customize columns"
                      classNames={["header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 !important"]}
                    />
                    <Element
                      id="aggrid-header-button2"
                      is={resolver.Button}
                      text="Reset default view"
                      classNames={["header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 !important"]}
                    />
                  </div>
                </div>
                {/* new view section */}
                <div className="view-section flex flex-col gap-2 mr-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800">
                  <Element
                    id="aggrid-view-title"
                    is={resolver.Text}
                    classNames={['view-title font-semibold']}
                    doc={[
                      {
                        type: 'paragraph',
                        children: [{ text: 'Save view' }],
                      },
                    ]}
                  />
                  <div className="flex gap-2">
                    <input type="text" placeholder="View name" className="view-input rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-800" />
                    <Element
                      id="aggrid-header-button3"
                      is={resolver.Button}
                      text="Save new"
                      classNames={["header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 !important"]}
                    />
                  </div>
                </div>
                {/* saved views section */}
                <div className="views-section flex flex-col gap-2 mr-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800">
                  <Element
                    id="aggrid-views-title"
                    is={resolver.Text}
                    classNames={['views-title font-semibold']}
                    doc={[
                      {
                        type: 'paragraph',
                        children: [{ text: 'Saved views' }],
                      },
                    ]}
                  />
                  <div className="flex gap-2">
                    <select className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-800" >
                      <option value="">Select view</option>
                    </select>
                    <Element
                      id="aggrid-header-button4"
                      is={resolver.Button}
                      text="Load"
                      classNames={["header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 !important"]}
                    />
                    <Element
                      id="aggrid-header-button5"
                      is={resolver.Button}
                      text="Overwrite"
                      classNames={["header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 !important"]}
                    />
                    <Element
                      id="aggrid-header-button6"
                      is={resolver.Button}
                      text="Delete"
                      classNames={["header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 !important"]}
                    />
                  </div>
                </div>
              </div>)}
            <AgGridReact
              rowData={rowData}
              columnDefs={colDefs}
              defaultColDef={defaultColDef}
              theme={theme}
              className={cn({ 'pointer-events-none opacity-40': disabled })}
            />
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

export default AgGrid;
