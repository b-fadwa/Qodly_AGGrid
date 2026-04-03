import { selectResolver, useDatasourceSub, useEnhancedEditor, useEnhancedNode, useI18n, useLocalization } from '@ws-ui/webform-editor';
import cn from 'classnames';
import { FC, useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { IAgGridProps } from './AgGrid.config';
import { ColDef, themeQuartz } from 'ag-grid-community';
import { BsFillInfoCircleFill } from 'react-icons/bs';
import { Element } from '@ws-ui/craftjs-core';
import { useState } from 'react';
import { FaTableColumns } from "react-icons/fa6";
import { FaClockRotateLeft } from "react-icons/fa6";
import { GoTrash } from "react-icons/go";
import { IoMdClose } from "react-icons/io";
import { FaSortAmountDown } from "react-icons/fa";

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
  showToolbarActions = true,
  showToolbarView = true,
  showToolbarSorting = true,
  showToolbarSaveView = true,
  showToolbarSavedViews = true,
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
  const [showSortingDialog, setShowSortingDialog] = useState(false);
  const [sortRules, setSortRules] = useState<{ field: string; sort: 'asc' | 'desc' }[]>([]);
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

  const sortableColumns = useMemo(
    () =>
      columns
        .filter((col) => col.dataType !== 'image' && col.dataType !== 'object' && col.sorting)
        .map((col) => col.title),
    [columns],
  );

  const openSortingDialog = () => {
    if (sortableColumns.length === 0) {
      setSortRules([]);
    } else if (sortRules.length === 0) {
      setSortRules([{ field: sortableColumns[0], sort: 'asc' }]);
    }
    setShowSortingDialog(true);
  };

  const addSortRule = () => {
    if (sortableColumns.length === 0) return;
    const nextField = sortableColumns.find((field) => !sortRules.some((rule) => rule.field === field))
      || sortableColumns[0];
    setSortRules((prev) => [...prev, { field: nextField, sort: 'asc' }]);
  };

  const showAnyToolbarSection =
    showToolbarActions ||
    showToolbarView ||
    showToolbarSorting ||
    showToolbarSaveView ||
    showToolbarSavedViews;

  return (
    <div ref={connect} style={style} className={cn(className, classNames)}>
      {datasource ? (
        columns.length > 0 ? (
          <div className="flex flex-col gap-2 h-full ">
            {/* AGGrid header actions */}
            {showColumnActions && (
              <>
                {showAnyToolbarSection && (
                  <div className="grid-header flex items-start justify-between flex-wrap gap-4" style={{ boxShadow: "0px 1px 3px 0px rgba(0, 0, 0, 0.1)" }}>
                    {showToolbarActions && (
                      <div className="actions-section flex flex-col gap-2  rounded-lg  bg-white px-4 ">
                        <span className="actions-title " style={{ color: "#717182", fontWeight: 500, fontSize: "11px" }}>{translation("Actions")}</span>
                        <div className='flex flex-row gap-2'>
                          <div className="flex gap-2">
                            <Element
                              id="agGridActions"
                              is={resolver.StyleBox}
                              canvas
                            ></Element>
                          </div>
                          {showToolbarSorting && (
                            <div className="sorting-section flex flex-col gap-2 mr-4  bg-white px-4 py-2">
                              <button
                                className="header-button inline-flex gap-2 items-center rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-800"
                                onClick={openSortingDialog}
                                style={{
                                  height: "31px",
                                  borderRadius: "6px",
                                  borderColor: "#0000001A",
                                  color: "#44444C",
                                }}
                                disabled={sortableColumns.length === 0}
                              >
                                <FaSortAmountDown />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {showToolbarView && (
                      <div className="customizer-section flex flex-col gap-2  rounded-lg  bg-white py-2 text-sm text-gray-800">
                        <span className="customizer-title "
                          style={{ color: "#717182", fontWeight: 500, fontSize: "11px" }}
                        >{translation("View")}</span>
                        <div className="flex gap-2">
                          <button
                            className="header-button-customize-view inline-flex items-center justify-center border"
                            style={{
                              width: "31px",
                              height: "31px",
                              borderRadius: "6px",
                              borderColor: "#0000001A",
                              color: "#44444C"
                            }}
                            onClick={() => setShowPropertiesDialog(true)}
                          >
                            <FaTableColumns size={14} />
                          </button>
                          <button
                            className="header-button-reload-view inline-flex items-center justify-center border"
                            style={{
                              width: "31px",
                              height: "31px",
                              borderRadius: "6px",
                              borderColor: "#0000001A",
                              color: "#44444C"
                            }}
                          >
                            <FaClockRotateLeft size={14} />
                          </button>
                        </div>
                      </div>
                    )}

                    {showToolbarSaveView && (
                      < div className="view-management flex flex-row ">
                        <div className="view-section flex flex-col gap-2 rounded-lg bg-white px-4 py-2">
                          <span className="view-title" style={{ color: "#717182", fontWeight: 500, fontSize: "11px" }}>{translation("Save view")}</span>
                          <div className="flex gap-2">
                            <input type="text" placeholder={translation("View name")} className="view-input border px-4 py-2 text-sm" style={{
                              height: "31px",
                              borderRadius: "6px",
                              borderColor: "#0000001A",
                              color: "#44444C",
                            }} />
                            <button className='header-button inline-flex gap-2 items-center  border  bg-white px-4 py-2 text-sm font-medium '
                              style={{
                                height: "31px",
                                borderRadius: "6px",
                                borderColor: "#0000001A",
                                color: "#44444C",
                              }}
                            >{translation("Save new")}</button>
                          </div>
                        </div>
                        {showToolbarSavedViews && (
                          <div className="views-section  flex flex-col gap-2 rounded-lg bg-white px-4 py-2">
                            <span className="views-title" style={{ color: "#717182", fontWeight: 500, fontSize: "11px" }}>{translation("Saved views")}</span>
                            <div className="flex gap-2">
                              <select className="rounded-lg border px-4 py-2 text-sm "
                                style={{
                                  height: "31px",
                                  borderRadius: "6px",
                                  borderColor: "#0000001A",
                                  color: "#44444C",
                                }}
                              >
                                <option value="">{translation("Select view")}</option>
                              </select>
                              <button className='header-button inline-flex gap-2 items-center border  bg-white px-4 py-2 text-sm font-medium'
                                style={{
                                  height: "31px",
                                  borderRadius: "6px",
                                  borderColor: "#0000001A",
                                  color: "#44444C",
                                }}                        >
                                {translation("Load")}</button>
                              <button className='header-button inline-flex gap-2 items-center border bg-white px-4 py-2 text-sm font-medium '
                                style={{
                                  height: "31px",
                                  borderRadius: "6px",
                                  borderColor: "#0000001A",
                                  color: "#44444C",
                                }}
                              >{translation("Overwrite")}</button>
                              <button
                                className="header-button-trash inline-flex items-center justify-center border"
                                style={{
                                  width: "31px",
                                  height: "31px",
                                  borderRadius: "6px",
                                  color: "#EC7B80",
                                  borderColor: "#EC7B80",
                                  backgroundColor: "#EC7B8033",
                                }}>
                                <GoTrash size={14} /></button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {/* columns customizer dialog */}
                {showToolbarView && showPropertiesDialog && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div
                      className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-xl"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-start justify-between gap-3  px-5 py-4 rounded-t-xl" >
                        <div>
                          <h1 className="text-sm tracking-wide" style={{ color: "#0A0A0A", fontSize: "21px", fontWeight: 500 }}>{translation("COLUMN STATE")}</h1>
                          <span className='mt-1 block text-sm ' style={{ color: "#6B7280", fontSize: "16px" }}>{translation("Show or hide columns for this grid view")}</span>
                        </div>
                        <button
                          className=" inline-flex items-center justify-center"
                          style={{
                            color: "#0A0A0A"
                          }}
                          onClick={() => setShowPropertiesDialog(false)}           >
                          <IoMdClose />
                        </button>
                      </div>
                      <div className="px-5 py-4">
                        <div className="sticky top-0 z-10 bg-white pb-3">
                          <div className="flex flex-row gap-2 md:flex-row md:items-center">
                            <input
                              className="min-w-0 flex-1 rounded-md border  px-2 py-1 text-sm outline-none focus:border-slate-500" style={{ height: "31px", borderColor: "#0000001A", borderRadius: "6px" }}
                              placeholder="Search field..."
                            />

                            <label className="inline-flex items-center gap-2 whitespace-nowrap text-sm" style={{ color: "#717182", fontSize: "12px", fontWeight: 500 }}>
                              <input
                                type="checkbox"
                                style={{ height: "12px", width: "12px", backgroundColor: "#2b5797", borderRadius: "4px" }}
                              />
                              <span>{translation("Visible only")}</span>
                            </label>
                            <button
                              type="button"
                              className="rounded-md border  bg-white px-3 py-2 items-center flex disabled:cursor-not-allowed disabled:opacity-50"
                              style={{ borderColor: "rgba(0, 0, 0, 0.1)", color: "#0A0A0A", height: "31px", fontSize: "12px", fontWeight: 500 }}
                            >
                              {translation("Select all")}
                            </button>
                            <button
                              type="button"
                              className="rounded-md border px-3 py-2 flex items-center disabled:cursor-not-allowed disabled:opacity-50"
                              style={{ borderColor: "#6B8AD4", color: "#6B8AD4", height: "31px", fontSize: "12px", fontWeight: 500 }}
                            >
                              {translation("Clear all")}
                            </button>
                          </div>
                        </div>
                      </div>
                      {/* <div className="mb-3 flex items-center justify-between text-xs text-slate-600">
                        <div>
                          {translation("Visible:")}
                        </div>
                        <div>{translation("Showing:")} </div>
                      </div> */}
                      <div className="max-h-96 space-y-1 overflow-y-auto rounded-lg border p-2 mr-5 ml-5 mb-2" style={{ backgroundColor: "#FAFAFA", borderColor: "#D1D5DC", borderRadius: "10px" }}>
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
                                    style={{ height: "12px", width: "12px", backgroundColor: "#2b5797", borderRadius: "4px" }}
                                    checked={isVisible}
                                  />
                                  <span
                                    className={`truncate ${isVisible ? "text-gray-700" : "text-slate-400"
                                      }`}
                                  >
                                    {column.field}
                                  </span>
                                </label>

                                <select
                                  value={column.pinned || "unpinned"}
                                  className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                                  style={{ height: "31px" }}
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
                {showToolbarSorting && showSortingDialog && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => setShowSortingDialog(false)}
                  >
                    <div
                      className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl"
                    >
                      <div className="flex items-start justify-between gap-3 border-b border-slate-200  px-5 py-4 rounded-t-xl">
                        <div>
                          <span className="text-sm tracking-wide" style={{ color: "#0A0A0A", fontSize: "21px", fontWeight: 500 }}>
                            {translation('ADVANCED SORTING')}
                          </span>
                          <span className="mt-1 block text-sm" style={{ color: "#4A5565", fontSize: '14px' }}>
                            {translation(
                              'Choose one or multiple columns and define sort direction for each level',
                            )}
                          </span>
                        </div>
                        <button
                          className=" inline-flex items-center justify-center"
                          style={{
                            color: "#6A7282"
                          }}
                          onClick={() => setShowSortingDialog(false)}
                        >
                          <IoMdClose />
                        </button>
                      </div>
                      <div className="">
                        {sortableColumns.length === 0 ? (
                          <div className=" bg-slate-50 px-3 py-2 " style={{ color: "#4A5565", fontSize: '14px' }}>
                            {translation('No sortable columns are enabled in grid properties')}
                          </div>
                        ) : (
                          <>
                            <div className="px-3 py-2 mb-4 " >
                              <div className="space-y-2 max-h-80 overflow-y-auto">
                                <div
                                  className="flex items-center justify-between gap-2 px-2 py-2"
                                >
                                  <span className="w-14" style={{ color: "#364153", fontSize: "14px" }}>
                                    {translation('Level')}
                                  </span>
                                  <select
                                    className="w-28 rounded-md" style={{ backgroundColor: "#F3F3F5", borderRadius: "8px", height: "36px", width: "256px", fontSize: "14px" }}
                                  >
                                    <option >{translation('Column name')}</option>
                                  </select>
                                  <select
                                    className="w-28 rounded-md" style={{ backgroundColor: "#F3F3F5", borderRadius: "8px", height: "36px", width: "128px", fontSize: "14px" }}
                                  >
                                    <option value="asc">{translation('Asc')}</option>
                                    <option value="desc">{translation('Desc')}</option>
                                  </select>
                                  <button
                                    type="button"
                                    className=" border bg-white px-2 py-1"
                                    style={{ height: "32px", borderColor: "#0000001A", borderRadius: "8px", fontSize: "12px" }}
                                  >
                                    {translation('Remove')}
                                  </button>
                                </div>
                              </div>
                              <div className="mt-3 flex items-center justify-between pb-4">
                                <button
                                  type="button"
                                  style={{
                                    height: "31px",
                                    borderRadius: "8px",
                                    borderColor: "#0000001A",
                                    color: "#44444C",
                                    fontSize: "12px",
                                    fontWeight: 500
                                  }}
                                  onClick={addSortRule}
                                  className="rounded-md border px-3 py-2 flex items-center justify-center"
                                  disabled={sortableColumns.length === 0}
                                >
                                  {translation('Add level')}
                                </button>
                              </div>
                            </div>
                            <div className="flex justify-end align-end items-center gap-2 w-full p-4 " style={{ borderTop: "1px solid #E5E7EB" }}>
                              <button
                                type="button"
                                className="rounded-md border px-3 py-2 flex items-center justify-center "
                                style={{
                                  height: "31px",
                                  borderRadius: "6px",
                                  borderColor: "#0000001A",
                                  color: "#44444C",
                                  fontSize: "12px"
                                }}
                              >
                                {translation('Clear')}
                              </button>
                              <button
                                type="button"
                                className="rounded-md border  px-3 py-2 text-sm text-white flex text-center items-center justify-center"
                                style={{
                                  background: "#2B5797",
                                  height: "31px",
                                  fontSize: "12px"
                                }}
                              >
                                {translation('Apply sorting')}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>

            )}
            <div className="records-count text-sm  flex justify-end gap-2  mt-2 mb-2 pr-4 " ><span style={{ color: "#0A0A0A", fontSize: "12px", fontWeight: 400 }}>0</span> <span style={{ color: "#717182", fontSize: "12px", fontWeight: 400 }}>{translation("records")}</span></div>
            <div className='px-4 h-full'>
              <AgGridReact
                rowData={rowData}
                columnDefs={colDefs}
                defaultColDef={defaultColDef}
                theme={theme}
                className={cn({ 'pointer-events-none opacity-40  ': disabled })}
              />
            </div>
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
