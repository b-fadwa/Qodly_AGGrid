import { selectResolver, useDatasourceSub, useEnhancedEditor, useEnhancedNode, useI18n, useLocalization } from '@ws-ui/webform-editor';
import cn from 'classnames';
import { FC, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { IAgGridProps } from './AgGrid.config';
import { ColDef, themeQuartz } from 'ag-grid-community';
import { BsFillInfoCircleFill } from 'react-icons/bs';
import { Element } from '@ws-ui/craftjs-core';
import { useState } from 'react';

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
  const [showPropertiesDialog, setShowPropertiesDialog] = useState(false);
  const { i18n } = useI18n();
  const { selected: lang } = useLocalization();
  const translation = (key: string): string => {
    const entry = i18n?.keys?.[key]?.[lang] ?? i18n?.keys?.[key]?.default;
    return entry ?? key;
  };

  // const translation = (key: string) => get(i18n, `keys.${key}.${lang}`, get(i18n, `keys.${key}.default`, key));

  const [filteredColumns] = useState(() => [
    { field: 'column 1', isHidden: false, pinned: null },
    { field: 'column 2', isHidden: false, pinned: 'left' },
    { field: 'column 3', isHidden: true, pinned: null },
    { field: 'column 4', isHidden: false, pinned: 'right' },
  ]);


  return (
    <div ref={connect} style={style} className={cn(className, classNames)}>
      {datasource ? (
        columns.length > 0 ? (
          <div className="flex flex-col gap-2 h-full">
            {/* AGGrid header actions */}
            {showColumnActions && (
              <>
                <div className="grid-header flex gap-2 items-center cursor-pointer flex-wrap">
                  {/* actions section */}
                  <div className="actions-section flex flex-col gap-2 mr-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800">
                    <span className="actions-title font-semibold">{translation("Actions")}:</span>
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
                    <span className="customizer-title font-semibold">{translation("View")}:</span>
                    <div className="flex gap-2">
                      <button
                        className="header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-800"
                        onClick={() => setShowPropertiesDialog(true)}
                      >
                        {translation("Customize columns")}
                      </button>
                      <button
                        className="header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800"
                      >
                        {translation("Reset default view")}
                      </button>
                    </div>
                  </div>
                  {/* new view section */}
                  <div className="view-section flex flex-col gap-2 mr-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800">
                    <span className="view-title font-semibold">{translation("Save view")}:</span>
                    <div className="flex gap-2">
                      <input type="text" placeholder={translation("View name")} className="view-input rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-800" />
                      <button className='header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800'>{translation("Save new")}</button>
                    </div>
                  </div>
                  {/* saved views section */}
                  <div className="views-section flex flex-col gap-2 mr-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800">
                    <span className="views-title font-semibold">{translation("Saved views")}:</span>
                    <div className="flex gap-2">
                      <select className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-800" >
                        <option value="">{translation("Select view")}</option>
                      </select>
                      <button className='header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800' >{translation("Load")}</button>
                      <button className='header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800' >{translation("Overwrite")}</button>
                      <button className='header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800' >{translation("Delete")}</button>
                    </div>
                  </div>
                </div>
                {/* columns customizer dialog */}
                {showPropertiesDialog && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div
                      className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 rounded-t-xl">
                        <div>
                          <h1 className="text-sm font-bold uppercase tracking-wide text-slate-800">{translation("COLUMN STATE")}</h1>
                          <span className='mt-1 block text-sm text-slate-600'>{translation("Show or hide columns for this grid view")}</span>
                        </div>
                        <button
                          type="button"
                          className="header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-800"
                          onClick={() => setShowPropertiesDialog(false)}           >
                          {translation("Close")}
                        </button>
                      </div>
                      <div className="px-5 py-4">
                        <div className="sticky top-0 z-10 bg-white pb-3">
                          <div className="flex flex-row gap-2 md:flex-row md:items-center">
                            <input
                              className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-slate-500"
                              placeholder="Search field..."
                            />

                            <label className="inline-flex items-center gap-2 whitespace-nowrap text-sm text-slate-700">
                              <input
                                type="checkbox"
                              />
                              <span>{translation("Visible only")}</span>
                            </label>
                            <button
                              type="button"
                              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-800 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {translation("Select all")}
                            </button>
                            <button
                              type="button"
                              className="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-slate-700 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {translation("Clear all")}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="mb-3 flex items-center justify-between text-xs text-slate-600">
                        <div>
                          {translation("Visible:")}
                        </div>
                        <div>{translation("Showing:")} </div>
                      </div>
                      <div className="max-h-96 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2">
                        {filteredColumns.length === 0 ? (
                          <div className="px-3 py-8 text-center text-sm text-slate-500">
                            {translation("No fields match your filter.")}
                          </div>
                        ) : (
                          filteredColumns.map((column) => {
                            const isVisible = !column.isHidden;
                            return (
                              <div
                                key={column.field}
                                className="flex flex-row items-center gap-2 rounded-md px-2 py-1 hover:bg-slate-100"
                              >
                                <label className="inline-flex min-w-0 flex-1 items-center gap-2 text-sm">
                                  <input
                                    type="checkbox"
                                    checked={isVisible}
                                  />
                                  <span
                                    className={`truncate ${isVisible ? "text-slate-800" : "text-slate-400"
                                      }`}
                                  >
                                    {column.field}
                                  </span>
                                </label>

                                <select
                                  value={column.pinned || "unpinned"}
                                  className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                                >
                                  <option value="unpinned">{translation("No pin")}</option>
                                  <option value="left">{translation("Pin left")} </option>
                                  <option value="right">{translation("Pin right")}</option>
                                </select>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>

            )}
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
    </div >
  );
};

export default AgGrid;

