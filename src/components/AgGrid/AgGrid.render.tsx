import {
  useDataLoader,
  useRenderer,
  useSources,
  useDsChangeHandler,
  entitySubject,
  EntityActions,
  useEnhancedNode,
  useWebformPath,
  useEnhancedEditor,
  useI18n,
  useLocalization,
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
import { IAgGridProps, IColumn } from './AgGrid.config';
import {
  buildFocusedCellClipboardText,
  buildManualSelectedCellsClipboardText,
  buildSelectedCellRangesClipboardText,
  buildSelectedRowsClipboardText,
  getFirstDataColumnForCopy,
  isEditableTarget,
  isCopyShortcut,
  type TManualSelectedCell,
  getInitialGridCopyMode,
  persistGridCopyMode,
  type GridCopyModeSetting,
  writeTextToClipboard,
} from './AgGrid.clipboard';
import {
  getAdvancedRulesFromFilterModel,
  buildFilterQueries,
  stripAdvancedRulesFromFilterModel,
  withAdvancedRulesOnFilterModel,
  extractRefDatasetKeyFromSource,
  getColumnFilterParams,
  getColumnFilterType,
  isBooleanLikeColumn,
  refOptionI18nCompositeKey,
} from './AgGrid.filtering';
import { QodlyRefSelectFilter } from './AgGridRefSelectFilter';
import {
  ColDef,
  FilterChangedEvent,
  GridApi,
  GridReadyEvent,
  ICellRendererParams,
  IGetRowsParams,
  SortModelItem,
  StateUpdatedEvent,
  ModuleRegistry,
  ColumnHoverModule,
  CellStyleModule,
  RowStyleModule,
  RenderApiModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
  RowClassParams,
  themeQuartz,
} from 'ag-grid-community';
import isEqual from 'lodash/isEqual';
import cloneDeep from 'lodash/cloneDeep';
import CustomCell from './CustomCell';
import AgGridSelectionHeader from './AgGridSelectionHeader';
import {
  AgGridCalculsStatistique,
  type CalculsStatistiqueResultDatasource,
} from './AgGridCalculsStatistique';
import { StatisticCalculations } from './StatisticCalculations';
import { Element } from '@ws-ui/craftjs-core';
import { selectResolver } from '@ws-ui/webform-editor';
import { get } from 'lodash';
import set from 'lodash/set';
import { FaTableColumns, FaCopy } from 'react-icons/fa6';
import { FaClockRotateLeft } from 'react-icons/fa6';
import { IoMdClose } from 'react-icons/io';
import { FaSortAmountDown, FaFilter } from 'react-icons/fa';
import {
  ROW_NUMBER_COL_ID,
  agGridColumnField,
  buildSortModelFromColumnState,
  isHiddenIdColumn,
  normalizeAgGridFilterModel,
  normalizeSortModel,
  withoutSyntheticRowColumnState,
} from './state/gridState';
import { useViewsManager } from './state/views';
import { useFiltersManager } from './state/filters';
import { useSortsManager } from './state/sorts';
import { SortingDialog } from './dialogs/SortingDialog';
import { FilterDialog } from './dialogs/FilterDialog';
import { ViewDialog } from './dialogs/ViewDialog';
import AgGridFilterHeader from './AgGridFilterHeader';
import { HeaderFilterPopup } from './dialogs/HeaderFilterPopup';

ModuleRegistry.registerModules([
  ColumnHoverModule,
  CellStyleModule,
  RowStyleModule,
  RenderApiModule,
  TextFilterModule,
  NumberFilterModule,
  DateFilterModule,
]);

const RowNumberCell: FC<ICellRendererParams> = (params) => (
  <span style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
    {params.value ?? ''}
  </span>
);

const IconPopover: FC<{ label: string; children: any }> = ({ label, children }) => {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const updatePos = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({
      top: rect.bottom + 6,
      left: rect.left + rect.width / 2,
    });
  }, []);

  const show = useCallback(() => {
    updatePos();
    setOpen(true);
  }, [updatePos]);

  useEffect(() => {
    if (!open) return;
    const onViewportChange = () => updatePos();
    window.addEventListener('scroll', onViewportChange, true);
    window.addEventListener('resize', onViewportChange);
    return () => {
      window.removeEventListener('scroll', onViewportChange, true);
      window.removeEventListener('resize', onViewportChange);
    };
  }, [open, updatePos]);

  return (
    <div
      ref={anchorRef}
      className="inline-flex"
      onMouseEnter={show}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={show}
      onBlurCapture={() => setOpen(false)}
    >
      {children}
      {open ? (
        <div
          className="pointer-events-none fixed z-[100002] -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1"
          style={{
            top: `${pos.top}px`,
            left: `${pos.left}px`,
            fontSize: '12px',
            fontWeight: 400,
            background: '#FFFFFF',
            boxShadow: 'rgba(0, 0, 0, 0.1) 0px -4px 12px 0px',
            borderColor: '#0000001A',
            color: '#44444C',
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};

type QuickShortcutMenuItem = {
  id: string;
  label: string;
};

const QuickShortcutMenu: FC<{
  menuLabel: string;
  buttonText: string;
  sections: Array<{
    id: string;
    label: string;
    emptyLabel: string;
    items: QuickShortcutMenuItem[];
    onSelect: (itemId: string) => void;
  }>;
}> = ({ menuLabel, buttonText, sections }) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const mainPanelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [submenuSide, setSubmenuSide] = useState<'right' | 'left'>('right');
  const [submenuTop, setSubmenuTop] = useState<number>(0);

  useEffect(() => {
    if (!open) return;

    const onOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('mousedown', onOutsideClick);
    window.addEventListener('keydown', onEscape);

    return () => {
      window.removeEventListener('mousedown', onOutsideClick);
      window.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  const activeSection = activeSectionId
    ? (sections.find((section) => section.id === activeSectionId) ?? null)
    : null;

  const openSectionAtTrigger = useCallback((sectionId: string, triggerEl: HTMLElement) => {
    const panelRect = mainPanelRef.current?.getBoundingClientRect();
    const triggerRect = triggerEl.getBoundingClientRect();
    setActiveSectionId(sectionId);
    if (!panelRect) return;
    setSubmenuTop(Math.max(0, triggerRect.top - panelRect.top));
  }, []);

  useEffect(() => {
    if (!open || !activeSection) return;
    const mainRect = mainPanelRef.current?.getBoundingClientRect();
    if (!mainRect) return;

    const viewportWidth = window.innerWidth;
    const submenuWidth = 280;
    const panelGap = 8;
    const hasRoomOnRight = mainRect.right + panelGap + submenuWidth <= viewportWidth - 8;
    const hasRoomOnLeft = mainRect.left - panelGap - submenuWidth >= 8;

    if (hasRoomOnRight || !hasRoomOnLeft) {
      setSubmenuSide('right');
    } else {
      setSubmenuSide('left');
    }
  }, [open, activeSection]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        className="header-button-reload-view inline-flex items-center justify-center rounded-lg border px-2"
        style={{
          minWidth: '64px',
          height: '31px',
          borderRadius: '8px',
          borderColor: '#0000001A',
          color: '#44444C',
          fontSize: '12px',
          fontWeight: 500,
        }}
        onClick={() =>
          setOpen((prev) => {
            const next = !prev;
            if (next) {
              setActiveSectionId(null);
              setSubmenuTop(0);
            }
            return next;
          })
        }
        aria-label={menuLabel}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {buttonText}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-1">
          <div className="relative">
            <div
              ref={mainPanelRef}
              className="min-w-[200px] rounded-lg border bg-white p-2 shadow-lg"
              style={{ borderColor: '#0000001A' }}
            >
              {sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-[#F5F6FA]"
                  style={{
                    color: '#44444C',
                    fontSize: '12px',
                    backgroundColor: activeSectionId === section.id ? '#F3F4F6' : 'transparent',
                  }}
                  onClick={(event) => openSectionAtTrigger(section.id, event.currentTarget)}
                  onMouseEnter={(event) => openSectionAtTrigger(section.id, event.currentTarget)}
                >
                  <span>
                    {section.label} {'   >'}
                  </span>
                </button>
              ))}
            </div>
            {activeSection && (
              <div
                className={`absolute w-max rounded-lg border bg-white p-2 shadow-lg ${
                  submenuSide === 'right' ? 'left-full ml-2' : 'right-full mr-2'
                }`}
                style={{ borderColor: '#0000001A', top: `${submenuTop}px` }}
              >
                {activeSection.items.length === 0 ? (
                  <div className="px-2 py-1.5" style={{ color: '#9CA3AF', fontSize: '12px' }}>
                    {activeSection.emptyLabel}
                  </div>
                ) : (
                  activeSection.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      className="flex w-full items-center rounded-md px-2 py-1.5 text-left hover:bg-[#F5F6FA]"
                      style={{ color: '#44444C', fontSize: '12px' }}
                      onClick={() => {
                        activeSection.onSelect(item.id);
                        setOpen(false);
                        setActiveSectionId(null);
                      }}
                    >
                      {item.label}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function findAgGridRowCssValue(data: any, field: string, cols: IColumn[]): any {
  if (data[field] !== undefined && data[field] !== null) {
    return data[field];
  }
  const bySource = cols.find((c) => c.source === field);
  if (bySource) {
    const stable = agGridColumnField(bySource);
    const v = data[stable];
    if (v !== undefined && v !== null) return v;
    if (data[bySource.title] !== undefined && data[bySource.title] !== null) {
      return data[bySource.title];
    }
  }
  const byTitle = cols.find((c) => c.title === field);
  if (byTitle) {
    const stable = agGridColumnField(byTitle);
    const v = data[stable];
    if (v !== undefined && v !== null) return v;
    return data[byTitle.title];
  }
  return undefined;
}

type CopyMode = GridCopyModeSetting;

const AgGrid: FC<IAgGridProps> = ({
  datasource,
  columns,
  view = '',
  views = '',
  filter = '',
  filters = '',
  sort = '',
  sorts = '',
  dateFinancial = false,
  filterInactiveRecords = false,
  calculStatistiqueResult = '',
  currentSelection = '',
  spacing,
  accentColor,
  backgroundColor,
  textColor,
  fontSize,
  borderColor,
  wrapperBorderRadius,
  oddRowBackgroundColor,
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
  enableCellFocus,
  enableColumnHover,
  multiSelection,
  rowCssField,
  style,
  disabled = false,
  showColumnActions,
  showToolbarActions = true,
  showToolbarView = true,
  showToolbarSorting = true,
  showToolbarFiltering = true,
  showToolbarStatistics = true,
  showToolbarSaveView = true,
  showToolbarSavedViews = true,
  className,
  classNames = [],
  showCopyActions,
  showRecordCount = true,
  showRowNumbers = false,
}) => {
  const { connect, emit } = useRenderer({
    autoBindEvents: !disabled,
    omittedEvents: [
      'onrowclick',
      'onrowdblclick',
      'onheaderclick',
      'oncellclick',
      'oncelldblclick',
      'oncellkeydown',
      'oncellmouseover',
      'oncellmouseout',
      'oncellmousedown',
      'onsaveview',
      'onloadview',
      'onupdateview',
      'ondeleteview',
      'onsavefilter',
      'onloadfilter',
      'onupdatefilter',
      'ondeletefilter',
      'onsavesort',
      'onloadsort',
      'onupdatesort',
      'ondeletesort',
      'oncalculstatistique',
    ],
  });
  const { resolver } = useEnhancedEditor(selectResolver);
  const {
    sources: { datasource: ds, currentElement },
  } = useSources({ acceptIteratorSel: true });
  /** `onGridReady` uses `[]` deps — read datasource via ref so `getRows` always sees the current iterator / entitysel after backend swaps the selection. */
  const dsRef = useRef(ds);
  dsRef.current = ds;
  const { id: nodeID } = useEnhancedNode();
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  /** Skip `refreshInfiniteCache` from `useDsChangeHandler` while `getRows` runs emit + page fetch. */
  const suppressDsChangeRefreshRef = useRef(false);
  /**
   * Last fingerprints successfully synced via `onfilter` / `onsort`. Dedupes infinite-cache blocks.
   * Filter fingerprint excludes sort so sort-only changes do not fire `onfilter`.
   * Cleared when the bound datasource identity (`ds.id`) changes.
   */
  const lastEmittedOnFilterPayloadRef = useRef<unknown>(null);
  const lastEmittedOnSortPayloadRef = useRef<unknown>(null);
  /** When false, `getRows` loads pages but does not emit `onfilter`/`onsort` (initial render). Set true after baseline fingerprints sync. */
  const allowServerFilterSortEmitRef = useRef(false);

  const emitRef = useRef(emit);
  emitRef.current = emit;
  /** Skip persisting to `state` while we apply datasource → grid (avoids echo with external updates). */
  const applyingExternalStateRef = useRef(false);
  const gridRef = useRef<AgGridReact>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const dateFinancialEnabledRef = useRef<boolean>(false);
  const filterInactiveRecordsEnabledRef = useRef<boolean>(false);
  const [dateFinancialFilterEnabled, setDateFinancialFilterEnabled] = useState(false);
  const [filterInactiveRecordsEnabled, setFilterInactiveRecordsEnabled] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = entry.contentRect.height;
        if (h > 0) setContainerHeight(h);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { i18n } = useI18n();
  const { selected: lang } = useLocalization();

  //add key aggrid_
  const translation = (key: string): string => {
    const formattedKey = key.replace(/\s+/g, '_');
    return get(
      i18n,
      `keys.aggrid_${formattedKey}.${lang}`,
      get(i18n, `keys.aggrid_${formattedKey}.default`, key),
    );
  };

  const { fetchIndex } = useDataLoader({
    source: ds,
  });

  /**
   * Do not use `useDataLoader().fetchPage` for grid rows: that helper reads an internal datasource
   * snapshot from the loader hook mount. After `onfilter`/`onsort` the server replaces `entitysel`
   * on the **live** iterator — load slices via `dsRef.current.getCollection`.
   */
  const fetchGridPageFromSource = useCallback(async (startRow: number, pageSize: number) => {
    const src = dsRef.current as any;
    if (src == null || typeof src.getCollection !== 'function') return [];
    const filterAttrs =
      (typeof src.filterAttributesText === 'string' && src.filterAttributesText) ||
      src._private?.filterAttributes ||
      '';
    const chunk = await src.getCollection(startRow, pageSize, filterAttrs);
    return Array.isArray(chunk) ? chunk : [];
  }, []);

  const fetchGridPageFromSourceRef = useRef(fetchGridPageFromSource);
  fetchGridPageFromSourceRef.current = fetchGridPageFromSource;

  /** New iterator binding → forget sync state until baseline runs again. */
  useEffect(() => {
    allowServerFilterSortEmitRef.current = false;
    lastEmittedOnFilterPayloadRef.current = null;
    lastEmittedOnSortPayloadRef.current = null;
  }, [ds?.id]);

  const path = useWebformPath();
  const viewDs = useMemo(
    () => (view ? window.DataSource.getSource(view, path) : null),
    [view, path],
  );
  const viewsDs = useMemo(
    () => (views ? window.DataSource.getSource(views, path) : null),
    [views, path],
  );
  const filterDs = useMemo(
    () => (filter ? window.DataSource.getSource(filter, path) : null),
    [filter, path],
  );
  const filtersDs = useMemo(
    () => (filters ? window.DataSource.getSource(filters, path) : null),
    [filters, path],
  );
  const sortDs = useMemo(
    () => (sort ? window.DataSource.getSource(sort, path) : null),
    [sort, path],
  );
  const sortsDs = useMemo(
    () => (sorts ? window.DataSource.getSource(sorts, path) : null),
    [sorts, path],
  );
  const calculStatistiqueResultDS = useMemo(() => {
    const id = calculStatistiqueResult?.trim();
    if (!id) return null;
    return window.DataSource.getSource(id, path);
  }, [calculStatistiqueResult, path]);
  const currentSelectionDS = window.DataSource.getSource(currentSelection, path);

  const [selected, setSelected] = useState(-1);
  const [scrollIndex, setScrollIndex] = useState(0);
  const [, setCount] = useState(0);
  /** Row total for the current grid query (main ds or filtered clone), from getRows `length`. */
  const [displayedRecordCount, setDisplayedRecordCount] = useState(0);
  /** Select-all only when this fetch returned every row (rowData.length >= total length from server). */
  const [showSelectAllHeaderCheckbox, setShowSelectAllHeaderCheckbox] = useState(false);

  const selectionColumnDef = useMemo(
    () =>
      multiSelection
        ? {
            headerComponent: AgGridSelectionHeader,
            headerComponentParams: {
              ariaLabelSelectAll: translation('Select all rows'),
              showSelectAllCheckbox: showSelectAllHeaderCheckbox,
            },
            suppressHeaderMenuButton: true,
            width: 48,
            minWidth: 48,
            maxWidth: 56,
            flex: 0,
            pinned: 'left' as const,
            lockPinned: true,
            lockPosition: 'left' as const,
            suppressMovable: true,
            resizable: false,
          }
        : undefined,
    [multiSelection, i18n, lang, showSelectAllHeaderCheckbox],
  );

  const [copyMode, setCopyMode] = useState<CopyMode>(() =>
    getInitialGridCopyMode(nodeID, multiSelection),
  );
  const [showCopyModeDialog, setShowCopyModeDialog] = useState(false);

  const applyUserCopyMode = useCallback(
    (next: CopyMode) => {
      setCopyMode(next);
      persistGridCopyMode(nodeID, next);
      if (currentSelectionDS && showCopyActions && next === 'cells') {
        void currentSelectionDS.setValue(null, []);
      }
      setShowCopyModeDialog(false);
    },
    [nodeID, currentSelectionDS, showCopyActions],
  );

  const [manualSelectedCells, setManualSelectedCells] = useState<TManualSelectedCell[]>([]);
  const [cellRangeSelectionActive, setCellRangeSelectionActive] = useState(false);
  const [isCellSelectionAvailable, setIsCellSelectionAvailable] = useState(false);
  const [showPropertiesDialog, setShowPropertiesDialog] = useState(false);
  const [showSortingDialog, setShowSortingDialog] = useState(false);
  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [liveFilterModel, setLiveFilterModel] = useState<any>({});
  const liveFilterModelRef = useRef<any>({});
  const [sortDialogInitialModel, setSortDialogInitialModel] = useState<SortModelItem[]>([]);
  const [headerFilterPopupState, setHeaderFilterPopupState] = useState<{
    colId: string;
    anchorRect: DOMRect;
  } | null>(null);

  // view management (toolbar UI state)
  const [viewName, setViewName] = useState<string>('');
  const [selectedView, setSelectedView] = useState<string>('');
  const [isViewDefault, setIsViewDefault] = useState<boolean>(false);
  // Currently selected saved filter / sort (toolbar + dialogs).
  const [selectedFilterName, setSelectedFilterName] = useState<string>('');
  const [selectedSortName, setSelectedSortName] = useState<string>('');

  const commitLiveFilterModel = useCallback((nextModel: any) => {
    const normalized = nextModel ?? {};
    liveFilterModelRef.current = normalized;
    setLiveFilterModel(normalized);
  }, []);

  const persistFilterDsNow = useCallback(
    (filterModel: any) => {
      if (!filterDs) return;
      filterDs.setValue(null, {
        filterModel: normalizeAgGridFilterModel(filterModel) ?? {},
        dateFinancialFilterEnabled: dateFinancialEnabledRef.current,
        filterInactiveRecords: filterInactiveRecordsEnabledRef.current,
      });
    },
    [filterDs],
  );

  // Bootstrap tracking for saved defaults (views / sorts): once a live value or a
  // default has been applied for that kind, we leave the grid alone.
  const [gridReady, setGridReady] = useState(false);
  const viewDefaultTriedRef = useRef(false);
  /** Live `sort` datasource applied a non-empty sort during bootstrap (or linked sort) — do not override with a named default. */
  const skipAutoSortDefaultRef = useRef(false);
  /** Last named default sort we applied (record name); cleared when list has no default. */
  const sortDefaultAppliedKeyRef = useRef<string>('');
  const linkedSortAppliedFromFilterRef = useRef(false);

  // columns dialog
  const [propertySearch, setPropertySearch] = useState('');
  const [showVisibleOnly, setShowVisibleOnly] = useState(false);

  const manualSelectedCellKeySet = useMemo(
    () => new Set(manualSelectedCells.map((cell) => `${cell.rowIndex}::${cell.colId}`)),
    [manualSelectedCells],
  );

  useEffect(() => {
    let cancelled = false;
    const registerEnterpriseCellSelection = async () => {
      try {
        const enterpriseModuleName = 'ag-grid-' + 'enterprise';
        const enterprise: any = await import(/* @vite-ignore */ enterpriseModuleName);
        const cellSelectionModule = enterprise?.CellSelectionModule;
        if (cellSelectionModule) {
          ModuleRegistry.registerModules([cellSelectionModule]);
          if (!cancelled) setIsCellSelectionAvailable(true);
        }
      } catch (_) {
        if (!cancelled) setIsCellSelectionAvailable(false);
      }
    };

    registerEnterpriseCellSelection();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!multiSelection) setShowSelectAllHeaderCheckbox(false);
  }, [multiSelection]);

  useEffect(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    const id = requestAnimationFrame(() => {
      api.refreshHeader();
    });
    return () => cancelAnimationFrame(id);
  }, [showSelectAllHeaderCheckbox]);

  useEffect(() => {
    if (copyMode !== 'cells' || !showCopyActions) {
      setManualSelectedCells([]);
      setCellRangeSelectionActive(false);
    }
  }, [copyMode, showCopyActions]);

  useEffect(() => {
    if (!isCellSelectionAvailable) {
      setCellRangeSelectionActive(false);
    }
  }, [isCellSelectionAvailable]);

  useEffect(() => {
    if (!showCopyActions) {
      setManualSelectedCells([]);
      setCellRangeSelectionActive(false);
      if (isCellSelectionAvailable) {
        (gridRef.current?.api as any)?.clearCellSelection?.();
      }
      gridRef.current?.api?.refreshCells({ force: true });
    }
  }, [showCopyActions, isCellSelectionAvailable]);

  useEffect(() => {
    if (copyMode !== 'cells' || isCellSelectionAvailable || !showCopyActions) return;
    gridRef.current?.api?.refreshCells({ force: true });
  }, [copyMode, isCellSelectionAvailable, manualSelectedCells, showCopyActions]);

  /** After copy mode changes, restore grid cell focus so Ctrl+C works without re-clicking (dialog steals focus; row # col has no `field`). */
  useEffect(() => {
    if (!showCopyActions || copyMode === 'none') return;
    const api = gridRef.current?.api;
    if (!api) return;
    const t = window.setTimeout(() => {
      const selected = api.getSelectedNodes().filter((n: any) => n?.data);
      if (!selected.length) return;
      const rowIndex = selected[selected.length - 1]?.rowIndex;
      if (typeof rowIndex !== 'number') return;
      const col = getFirstDataColumnForCopy(api);
      if (!col) return;
      // Rows mode uses selection for TSV; single-row has no multi checkbox flow. Cells mode needs a focused data cell.
      if (copyMode === 'rows' && !multiSelection) return;
      api.setFocusedCell(rowIndex, col);
    }, 0);
    return () => clearTimeout(t);
  }, [copyMode, showCopyActions, multiSelection, isCellSelectionAvailable]);

  // Multi-select only: if "Selected Selection" is cleared externally, clear grid checkboxes.
  // In single-row mode, `currentSelection` may be emptied on row click; must not deselectAll or the highlight is lost.
  // In Cells copy mode, we intentionally clear `currentSelection` but keep grid row selection for context.
  useEffect(() => {
    if (!currentSelectionDS) return;

    const listener = async (/* event */) => {
      if (!multiSelection) return;
      const value = await currentSelectionDS.getValue();
      if (Array.isArray(value) && value.length === 0) {
        if (showCopyActions && copyMode === 'cells') return;
        gridRef.current?.api?.deselectAll();
      }
    };
    listener();
    currentSelectionDS.addListener('changed', listener);
    return () => {
      currentSelectionDS.removeListener('changed', listener);
    };
  }, [currentSelectionDS, multiSelection, copyMode, showCopyActions]);

  //very initial state of columns
  const initialColumnVisibility = useMemo(
    () =>
      columns.map((col) => ({
        field: agGridColumnField(col),
        isHidden: col.hidden || false, // use col.hidden directly from properties
        pinned: null as 'left' | 'right' | null,
        // Optional header label override that can be persisted in `columnState`.
        i18n: col.title,
        // Tracking width/flex here lets manual column resizes survive
        // colDef rebuilds. AG Grid resets a column's width whenever the
        // colDef passes a different `width` value, so without this the
        // resize would be reverted on the next render that touches
        // `columnVisibility` (e.g. our own viewDs change listener).
        width: col.width as number | null,
        flex: col.flex as number | null,
      })),
    [columns],
  );

  const [columnVisibility, setColumnVisibility] = useState<any[]>(initialColumnVisibility);
  const [initialColumnState, setInitialColumnState] = useState<any>(null); // Store the initial AG Grid column state

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

  const agGridFilterComponents = useMemo(
    () => ({ qodlyRefSelectFilter: QodlyRefSelectFilter }),
    [],
  );

  const isColumnFilterActive = useCallback((colId: string): boolean => {
    const model = liveFilterModelRef.current ?? {};
    if (model != null && Object.prototype.hasOwnProperty.call(model, colId)) return true;
    const advancedRules = getAdvancedRulesFromFilterModel(model);
    return advancedRules.some((rule) => rule.field === colId);
  }, []);

  const colDefs: ColDef[] = useMemo(() => {
    return (
      columns
        // Feature 3: internal id columns are completely hidden from the table.
        // The underlying row data still carries the value (it's needed for CSS
        // expressions, selection bookkeeping, etc.) — we just don't render a
        // colDef for it so users can't see / move / resize / sort / filter it.
        .filter((col) => !isHiddenIdColumn(col))
        .map((col) => {
          const stableField = agGridColumnField(col);
          const colState = (columnVisibility.find((c) => c.field === stableField) ?? {
            isHidden: false,
            pinned: null,
            i18n: col.title,
            width: col.width,
            flex: col.flex,
          }) as {
            isHidden: boolean;
            pinned: 'left' | 'right' | null;
            i18n?: string | null;
            width?: number | null;
            flex?: number | null;
          };
          const isBooleanColumn = isBooleanLikeColumn(col);
          const refKey = extractRefDatasetKeyFromSource(col.source);
          const isRefSource = refKey != null;
          return {
            field: stableField,
            headerName: (colState.i18n ?? col.title) as any,
            headerComponent: AgGridFilterHeader,
            headerComponentParams: {
              translation,
              // Ref-backed columns (`*_R_*`) use a custom AG Grid filter component; they are still filterable.
              filterable: !!getColumnFilterType(col, isBooleanColumn),
              isColumnFilterActive,
              onOpenFilter: ({ colId, anchorEl }: { colId: string; anchorEl: HTMLElement }) => {
                const api = gridRef.current?.api as any;
                if (!api || api.isDestroyed?.()) return;
                // For ref-backed columns, open AG Grid's native column menu so the custom select filter renders.
                if (isRefSource && typeof api.showColumnMenuAfterButtonClick === 'function') {
                  const column = api.getColumn?.(colId);
                  if (column) {
                    api.showColumnMenuAfterButtonClick(column, anchorEl);
                    return;
                  }
                }
                setHeaderFilterPopupState({
                  colId,
                  anchorRect: anchorEl.getBoundingClientRect(),
                });
              },
            },
            context: { source: col.source },
            hide: colState.isHidden,
            pinned: colState.pinned,
            cellRendererParams: {
              format: col.format,
              dataType: col.dataType,
            },
            cellStyle: (params: any) => {
              if (isCellSelectionAvailable) return undefined;
              const resetStyle = {
                border: '',
                boxSizing: '',
                backgroundColor: '',
              };
              if (!showCopyActions || copyMode !== 'cells') return resetStyle;
              const rowIndex = params?.node?.rowIndex;
              if (typeof rowIndex !== 'number') return resetStyle;
              const key = `${rowIndex}::${params.column.getColId()}`;
              if (!manualSelectedCellKeySet.has(key)) return resetStyle;
              return {
                border: '2px dashed #1d4ed8',
                boxSizing: 'border-box',
                backgroundColor: 'rgba(29, 78, 216, 0.08)',
              };
            },
            lockPosition: col.locked,
            sortable: col.dataType !== 'image' && col.dataType !== 'object' && col.sorting,
            resizable: col.sizing,
            // Prefer the persisted width/flex (kept in sync via `onColumnResized`),
            // falling back to the column's design-time value. This is what makes
            // manual resize "stick" across colDef rebuilds — without it AG Grid
            // resets the column to `col.width` every time the colDef identity
            // changes.
            //
            // The `flex` handling is subtle: AG Grid CLEARS `flex` to `null` on
            // the column state the moment the user drags a flex-sized column,
            // because flex sizing and a manual width are mutually exclusive. We
            // must distinguish that "explicitly cleared" null from a missing
            // value (`undefined`). Using `??` would collapse both into "fall
            // back to col.flex (= 1)" and AG Grid would re-flex the column on
            // the next render, snapping it back to its computed width and
            // making the resize appear to "not stick".
            width: colState.width ?? col.width,
            flex: colState.flex === null ? undefined : (colState.flex ?? col.flex),
            filter: isRefSource
              ? 'qodlyRefSelectFilter'
              : getColumnFilterType(col, isBooleanColumn),
            suppressHeaderMenuButton: true,
            suppressHeaderFilterButton: true,
            filterParams: isRefSource
              ? {
                  refDatasetKey: refKey,
                  allowedValues: (col as any)?.refValues,
                  maxOptions: 256,
                  placeholderLabel: translation('Choose one'),
                  applyButtonLabel: translation('Apply'),
                  resolveOptionLabel: (index: number) => {
                    const composite = refOptionI18nCompositeKey(refKey, index);
                    const fromLang = lang ? get(i18n, `keys.${composite}.${lang}`) : undefined;
                    return String(fromLang ?? get(i18n, `keys.${composite}.default`, '') ?? '');
                  },
                }
              : getColumnFilterParams(col, isBooleanColumn),
          };
        })
    );
  }, [
    columns,
    columnVisibility,
    copyMode,
    i18n,
    isCellSelectionAvailable,
    lang,
    manualSelectedCellKeySet,
    showCopyActions,
    translation,
    isColumnFilterActive,
  ]);

  const gridColumnDefs = useMemo(
    () => (showRowNumbers ? [rowNumberColDef, ...colDefs] : colDefs),
    [showRowNumbers, rowNumberColDef, colDefs],
  );

  const defaultColDef = useMemo<ColDef>(() => {
    return {
      minWidth: 100,
      sortingOrder: ['asc', 'desc'],
      cellRenderer: CustomCell,
    };
  }, []);

  const sortableColumns = useMemo(
    () =>
      columns
        .filter(
          (col) =>
            col.dataType !== 'image' &&
            col.dataType !== 'object' &&
            col.sorting &&
            !isHiddenIdColumn(col),
        )
        .map((col) => ({
          colId: agGridColumnField(col),
          label: col.title,
        })),
    [columns],
  );

  const statisticsColumns = useMemo(
    () => StatisticCalculations.fromAgGridColumns(columns),
    [columns],
  );

  /** Toolbar column list: show translated `title`, while `field` stays the stable datasource key. */
  const columnLabelByStableField = useMemo(() => {
    const m = new Map<string, string>();
    columns.forEach((c) => {
      m.set(agGridColumnField(c), c.title);
    });
    return m;
  }, [columns]);
  const columnByStableField = useMemo(() => {
    const m = new Map<string, IColumn>();
    columns.forEach((c) => {
      m.set(agGridColumnField(c), c);
    });
    return m;
  }, [columns]);
  const headerPopupColumn = headerFilterPopupState
    ? (columnByStableField.get(headerFilterPopupState.colId) ?? null)
    : null;

  const sortableColIdsRef = useRef<string[]>([]);
  sortableColIdsRef.current = sortableColumns.map((c) => c.colId);

  const viewsManager = useViewsManager({
    viewDs,
    viewsDs,
    gridRef,
    columnsRef,
    emit,
    applyingExternalRef: applyingExternalStateRef,
  });

  const sortsManager = useSortsManager({
    sortDs,
    sortsDs,
    gridRef,
    columnsRef,
    sortableColIdsRef,
    emit,
    applyingExternalRef: applyingExternalStateRef,
  });

  const filtersManager = useFiltersManager({
    filterDs,
    filtersDs,
    gridRef,
    emit,
    applyingExternalRef: applyingExternalStateRef,
    dateFinancialEnabledRef,
    filterInactiveRecordsEnabledRef,
    onFilterLoaded: (record) => {
      const linkedSort = record?.linkedSort?.trim();
      if (!linkedSort) return;
      sortsManager.loadSort(linkedSort);
      setSelectedSortName(linkedSort);
      linkedSortAppliedFromFilterRef.current = true;
    },
  });

  const applyDateFinancialFilterToggle = useCallback(
    (enabled: boolean) => {
      const next = Boolean(enabled);
      dateFinancialEnabledRef.current = next;
      setDateFinancialFilterEnabled(next);
      filtersManager.persistCurrent(gridRef.current?.api?.getFilterModel() ?? {});
      gridRef.current?.api?.refreshInfiniteCache();
    },
    [filtersManager],
  );

  const applyFilterInactiveRecordsToggle = useCallback(
    (enabled: boolean) => {
      const next = Boolean(enabled);
      filterInactiveRecordsEnabledRef.current = next;
      setFilterInactiveRecordsEnabled(next);
      filtersManager.persistCurrent(gridRef.current?.api?.getFilterModel() ?? {});
      gridRef.current?.api?.refreshInfiniteCache();
    },
    [filtersManager],
  );

  /** Re-apply grid state whenever one of the 3 live datasources changes externally. */
  useEffect(() => {
    if (!viewDs) return;
    const listener = async () => {
      const api = gridRef.current?.api;
      if (!api) return;
      const data = await viewDs.getValue();
      applyingExternalStateRef.current = true;
      try {
        const applied = viewsManager.applyPersistedValue(api, data);
        if (applied && Array.isArray(data?.columnState)) {
          setColumnVisibility((prev) => {
            const next = withoutSyntheticRowColumnState(data.columnState).map((col: any) => {
              const previous = prev.find((p) => p.field === col.colId);
              return {
                field: col.colId,
                isHidden: col.hide || false,
                pinned: col.pinned || null,
                i18n: col.i18n ?? previous?.i18n ?? null,
                // Preserve the user's manual resize: if the persisted state
                // doesn't carry an explicit width/flex (older saved views),
                // fall back to whatever we already have in memory.
                width: col.width ?? previous?.width ?? null,
                flex: col.flex ?? previous?.flex ?? null,
              };
            });
            return next;
          });
        }
      } finally {
        setTimeout(() => {
          applyingExternalStateRef.current = false;
        }, 0);
      }
    };
    viewDs.addListener('changed', listener);
    return () => {
      viewDs.removeListener('changed', listener);
    };
  }, [viewDs, viewsManager]);

  useEffect(() => {
    if (!filterDs) return;
    const listener = async () => {
      const api = gridRef.current?.api;
      if (!api) return;
      const data = await filterDs.getValue();
      applyingExternalStateRef.current = true;
      try {
        // `applyPersistedValue` calls `setFilterModel` → `filterChanged` →
        // `onFilterChanged` already triggers `refreshInfiniteCache`; an
        // explicit refresh here would double-fire `getRows`.
        filtersManager.applyPersistedValue(api, data);
        // Keep the advanced-filter state (`liveFilterModelRef`) in sync with
        // external datasource changes. Without this, clearing the filter DS
        // can leave stale advanced rules that still get applied in `getRows`.
        const nextLive =
          data && typeof data === 'object' && 'filterModel' in (data as any)
            ? ((data as any).filterModel ?? {})
            : {};
        commitLiveFilterModel(nextLive);
        setDateFinancialFilterEnabled(Boolean(dateFinancialEnabledRef.current));
        setFilterInactiveRecordsEnabled(Boolean(filterInactiveRecordsEnabledRef.current));
      } finally {
        setTimeout(() => {
          applyingExternalStateRef.current = false;
        }, 0);
      }
    };
    filterDs.addListener('changed', listener);
    return () => {
      filterDs.removeListener('changed', listener);
    };
  }, [filterDs, filtersManager]);

  useEffect(() => {
    if (!sortDs) return;
    const listener = async () => {
      const api = gridRef.current?.api;
      if (!api) return;
      const data = await sortDs.getValue();
      applyingExternalStateRef.current = true;
      try {
        sortsManager.applyPersistedValue(api, data);
      } finally {
        setTimeout(() => {
          applyingExternalStateRef.current = false;
        }, 0);
      }
    };
    void listener();
    sortDs.addListener('changed', listener);
    return () => {
      sortDs.removeListener('changed', listener);
    };
  }, [sortDs, sortsManager]);

  const theme = themeQuartz.withParams({
    spacing,
    accentColor,
    backgroundColor,
    textColor,
    fontSize,
    oddRowBackgroundColor,
    borderColor,
    rowBorder,
    columnBorder,
    wrapperBorderRadius,
    headerBackgroundColor,
    headerTextColor,
    headerColumnBorder,
    headerVerticalPaddingScale,
    headerFontSize,
    headerFontWeight,
    cellHorizontalPaddingScale,
    rowVerticalPaddingScale,
    iconSize,
    foregroundColor: textColor,
    borderRadius: wrapperBorderRadius,
    rangeSelectionBorderColor: !enableCellFocus ? 'transparent' : undefined,
  });

  const getRowClass = useCallback(
    (params: RowClassParams) => {
      if (!rowCssField || !params.data) return '';
      const value =
        params.data.__entity?.[rowCssField] ??
        findAgGridRowCssValue(params.data, rowCssField, columns);
      if (value === undefined || value === null || value === '') return '';
      const sanitized = String(value)
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .toLowerCase();
      return `aggrid-row-${sanitized}`;
    },
    [rowCssField, columns],
  );

  const { updateCurrentDsValue } = useDsChangeHandler({
    source: ds,
    currentDs: currentElement,
    selected,
    setSelected,
    scrollIndex: scrollIndex,
    setScrollIndex,
    setCount,
    fetchIndex,

    onDsChange: ({ length, selected }) => {
      if (!gridRef.current) return;
      setManualSelectedCells([]);
      gridRef.current.api.deselectAll();
      if (!suppressDsChangeRefreshRef.current) {
        gridRef.current.api.refreshInfiniteCache();
      }
      if (multiSelection && gridRef.current.api.getSelectedNodes().length > 0) {
        gridRef.current.api.deselectAll();
      }
      if (selected >= 0) {
        updateCurrentDsValue({
          index: selected < length ? selected : 0,
          forceUpdate: true,
        });
      }
    },
    onCurrentDsChange: (selected) => {
      if (!gridRef.current) return;
      const rowNode = gridRef.current.api?.getRowNode(selected.toString());
      gridRef.current.api?.ensureIndexVisible(selected);
      rowNode?.setSelected(true);
      entitySubject.next({
        action: EntityActions.UPDATE,
        payload: {
          nodeID,
          rowIndex: selected,
        },
      });
    },
  });

  const focusRowForCopy = useCallback(
    (api: GridApi | undefined, rowIndex: number) => {
      if (!api || !showCopyActions || copyMode !== 'rows' || rowIndex < 0) return;
      const col = getFirstDataColumnForCopy(api);
      if (!col) return;
      api.setFocusedCell(rowIndex, col);
    },
    [copyMode, showCopyActions],
  );

  const onRowClicked = useCallback(
    async (event: any) => {
      if (!ds) return;
      if (multiSelection) {
        event.node?.setSelected(true, false);
        focusRowForCopy(event.api ?? gridRef.current?.api, event.rowIndex);
        emit('onrowclick');
        return;
      }
      if (currentSelectionDS) {
        await currentSelectionDS.setValue(null, []);
      }
      await updateCurrentDsValue({
        index: event.rowIndex,
      });
      focusRowForCopy(event.api ?? gridRef.current?.api, event.rowIndex);
      emit('onrowclick');
    },
    [ds, multiSelection, currentSelectionDS, updateCurrentDsValue, emit, focusRowForCopy],
  );

  const onRowDoubleClicked = useCallback(
    async (event: any) => {
      if (!ds) return;
      if (multiSelection) {
        const api = event.api ?? gridRef.current?.api;
        api?.deselectAll();
        event.node?.setSelected(true, false);
        if (currentSelectionDS) {
          await currentSelectionDS.setValue(null, event.data ? [sanitizeRow(event.data)] : []);
        }
      } else if (currentSelectionDS) {
        await currentSelectionDS.setValue(null, []);
      }
      await updateCurrentDsValue({
        index: event.rowIndex,
        forceUpdate: true,
      });
      emit('onrowdblclick');
    },
    [ds, multiSelection, currentSelectionDS, updateCurrentDsValue, emit],
  );

  const onCellClicked = useCallback(
    (event: any) => {
      if (!ds) return;

      if (showCopyActions && copyMode === 'cells' && !isCellSelectionAvailable) {
        const rowIndex = event?.node?.rowIndex;
        const colId = event?.column?.getColId?.();
        if (typeof rowIndex === 'number' && colId) {
          const headerName = String(event?.colDef?.headerName ?? colId);
          setManualSelectedCells((prev) => {
            const key = `${rowIndex}::${colId}`;
            const exists = prev.some((cell) => `${cell.rowIndex}::${cell.colId}` === key);
            if (exists) {
              return prev.filter((cell) => `${cell.rowIndex}::${cell.colId}` !== key);
            }
            return [...prev, { rowIndex, colId, headerName, value: event?.value }];
          });
        }
      }

      emit('oncellclick', {
        column: event.column.getColId(),
        value: event.value,
      });
    },
    [ds, copyMode, isCellSelectionAvailable, showCopyActions],
  );

  const onCellDoubleClicked = useCallback((event: any) => {
    if (!ds) return;
    emit('oncelldblclick', {
      column: event.column.getColId(),
      value: event.value,
    });
  }, []);

  const onHeaderClicked = useCallback((event: any) => {
    emit('onheaderclick', {
      column: event.column,
    });
  }, []);

  const onCellMouseOver = useCallback((event: any) => {
    emit('oncellmouseover', {
      column: event.column.getColId(),
      value: event.value,
    });
  }, []);

  const onCellMouseOut = useCallback((event: any) => {
    emit('oncellmouseout', {
      column: event.column.getColId(),
      value: event.value,
    });
  }, []);

  const onCellMouseDown = useCallback((event: any) => {
    emit('oncellmousedown', {
      column: event.column.getColId(),
      value: event.value,
    });
  }, []);

  const handleCopyShortcut = useCallback(
    (event: any, api: GridApi): boolean => {
      if (!isCopyShortcut(event)) return false;
      if (!showCopyActions) return false;

      if (copyMode === 'none') {
        return false;
      }

      if (copyMode === 'rows') {
        event.preventDefault?.();
        event.stopPropagation?.();
        const text = buildSelectedRowsClipboardText(api);
        if (!text) return true;
        void writeTextToClipboard(text);
        return true;
      }

      if (copyMode === 'cells') {
        event.preventDefault?.();
        event.stopPropagation?.();
        let text = '';
        if (isCellSelectionAvailable) {
          text = buildSelectedCellRangesClipboardText(api);
        }
        if (!text && manualSelectedCells.length > 0) {
          text = buildManualSelectedCellsClipboardText(manualSelectedCells, api);
        }
        if (!text) {
          text = buildFocusedCellClipboardText(api);
        }
        if (!text) return true;
        void writeTextToClipboard(text);
        return true;
      }

      return false;
    },
    [copyMode, multiSelection, isCellSelectionAvailable, manualSelectedCells, showCopyActions],
  );

  const onCellKeyDown = useCallback(
    (event: any) => {
      emit('oncellkeydown', {
        column: event.column.getColId(),
        value: event.value,
        key: event.event.key,
      });
    },
    [emit],
  );

  const onSelectionChanged = useCallback(
    async (event: any) => {
      const api = event.api;
      const selectedNodes = api.getSelectedNodes();

      if (showCopyActions && copyMode === 'rows' && selectedNodes.length > 0) {
        const rowIndex = selectedNodes[selectedNodes.length - 1]?.rowIndex;
        if (typeof rowIndex === 'number') {
          focusRowForCopy(api, rowIndex);
        }
      }

      if (multiSelection) {
        // Cells copy mode uses row checkboxes for range context only; do not drive Selected Selection.
        if (currentSelectionDS && copyMode !== 'cells') {
          const sanitized = selectedNodes.map((n: any) => sanitizeRow(n.data || {}));
          await currentSelectionDS.setValue(null, sanitized);
        }
      }
    },
    [copyMode, focusRowForCopy, multiSelection, currentSelectionDS, showCopyActions],
  );

  /** Push the current column / filter / sort state to their respective live datasources. */
  const persistGridState = useCallback(
    (columnState: any[], filterModel: any, sortModel: SortModelItem[]) => {
      viewsManager.persistCurrent(columnState);
      filtersManager.persistCurrent(filterModel);
      sortsManager.persistCurrent(sortModel);
    },
    [viewsManager, filtersManager, sortsManager],
  );

  const onStateUpdated = useCallback(
    (params: StateUpdatedEvent) => {
      if (params.sources.length === 1 && params.sources.includes('rowSelection')) return; // to avoid multiple triggers when selecting a row
      if (applyingExternalStateRef.current) return;
      if (params.type === 'stateUpdated' && !params.sources.includes('gridInitializing')) {
        const columnState = withoutSyntheticRowColumnState(params.api.getColumnState());
        const filterModel = params.api.getFilterModel();
        const sortModel = buildSortModelFromColumnState(columnState);
        persistGridState(columnState, filterModel, sortModel);
      }
    },
    [persistGridState],
  );

  /**
   * Mirror manual column resizes into `columnVisibility` so the new width is
   * carried back through `colDefs`. Without this, the next colDef rebuild
   * (e.g. after `viewDs` updates) would reset the column to its design-time
   * width because AG Grid honours an explicit `width` value passed in the
   * colDef. We only react to the final `finished: true` event so transient
   * widths during the drag are ignored.
   */
  const onColumnResized = useCallback((event: any) => {
    if (!event?.finished) return;
    const api = event.api;
    if (!api) return;
    setColumnVisibility((prev) =>
      prev.map((entry) => {
        const colState = api.getColumnState().find((s: any) => s.colId === entry.field);
        if (!colState) return entry;
        if (entry.width === colState.width && entry.flex === (colState.flex ?? null)) {
          return entry;
        }
        return {
          ...entry,
          width: colState.width ?? entry.width,
          flex: colState.flex ?? null,
        };
      }),
    );
  }, []);

  const onFilterChanged = useCallback(
    (event: FilterChangedEvent) => {
      const fromGrid = event.api.getFilterModel() ?? {};
      const prevRules = getAdvancedRulesFromFilterModel(liveFilterModelRef.current);
      const next = withAdvancedRulesOnFilterModel(fromGrid, prevRules);
      commitLiveFilterModel(next);
      filtersManager.persistCurrent(fromGrid);
    },
    [commitLiveFilterModel, filtersManager],
  );

  const applyHeaderFilterModel = useCallback(
    (nextModel: any) => {
      const api = gridRef.current?.api;
      if (!api || api.isDestroyed()) return;
      const prevLiveModel = liveFilterModelRef.current ?? {};
      const nextAg = stripAdvancedRulesFromFilterModel(nextModel ?? {});
      const currentAg = stripAdvancedRulesFromFilterModel(api.getFilterModel() ?? {});
      const agChanged = !isEqual(currentAg, nextAg);
      if (agChanged) {
        api.setFilterModel(Object.keys(nextAg).length ? nextAg : null);
        persistFilterDsNow(nextAg);
      }
      const normalizedNextLive = nextModel ?? {};
      const liveChanged = !isEqual(prevLiveModel, normalizedNextLive);
      commitLiveFilterModel(normalizedNextLive);
      if (!agChanged && liveChanged) {
        persistFilterDsNow(nextAg);
        filtersManager.persistCurrent(nextAg);
        api.refreshInfiniteCache();
      }
    },
    [commitLiveFilterModel, filtersManager, persistFilterDsNow],
  );

  const getState = useCallback(
    async (params: any) => {
      const api: GridApi = params.api;
      let applied = false;
      let viewLiveApplied = false;
      let sortLiveApplied = false;
      linkedSortAppliedFromFilterRef.current = false;

      if (viewDs) {
        try {
          const value = await viewDs.getValue();
          if (viewsManager.applyPersistedValue(api, value)) {
            applied = true;
            viewLiveApplied = true;
            if (value && Array.isArray(value.columnState)) {
              setColumnVisibility((prev) =>
                withoutSyntheticRowColumnState(value.columnState).map((col: any) => {
                  const previous = prev.find((p) => p.field === col.colId);
                  return {
                    field: col.colId,
                    isHidden: col.hide || false,
                    pinned: col.pinned || null,
                    i18n: col.i18n ?? previous?.i18n ?? null,
                    width: col.width ?? previous?.width ?? null,
                    flex: col.flex ?? previous?.flex ?? null,
                  };
                }),
              );
            }
          }
        } catch {
          /* ignore */
        }
      }

      if (filterDs) {
        try {
          const value = await filterDs.getValue();
          filtersManager.applyPersistedValue(api, value);
          const nextLive =
            value && typeof value === 'object' && 'filterModel' in (value as any)
              ? ((value as any).filterModel ?? {})
              : {};
          commitLiveFilterModel(nextLive);
          setDateFinancialFilterEnabled(Boolean(dateFinancialEnabledRef.current));
          setFilterInactiveRecordsEnabled(Boolean(filterInactiveRecordsEnabledRef.current));
        } catch {
          /* ignore */
        }
      }

      if (sortDs) {
        try {
          const value = await sortDs.getValue();
          if (sortsManager.applyPersistedValue(api, value)) {
            sortLiveApplied = true;
          }
        } catch {
          /* ignore */
        }
      }

      // Fallback: if no live value was applied for view/sort, try the
      // record flagged `isDefault` (if the list is already populated at this
      // point — otherwise the bootstrap useEffect below will retry once the
      // saved list arrives). When a default is applied, also reflect its
      // name in the corresponding dropdown selection.
      if (!viewLiveApplied) {
        const appliedName = viewsManager.tryApplyDefault();
        if (appliedName) {
          applied = true;
          viewLiveApplied = true;
          setSelectedView(appliedName);
        }
      }
      if (!sortLiveApplied) {
        if (linkedSortAppliedFromFilterRef.current) {
          sortLiveApplied = true;
        }
      }
      if (!sortLiveApplied) {
        const appliedName = sortsManager.tryApplyDefault();
        if (appliedName) {
          sortLiveApplied = true;
          sortDefaultAppliedKeyRef.current = appliedName;
          setSelectedSortName(appliedName);
        }
      }

      viewDefaultTriedRef.current = viewLiveApplied;
      skipAutoSortDefaultRef.current = sortLiveApplied;

      if (!applied) {
        const columnState = withoutSyntheticRowColumnState(api.getColumnState());
        const filterModel = api.getFilterModel() ?? {};
        const sortModel = buildSortModelFromColumnState(columnState);
        persistGridState(columnState, filterModel, sortModel);
      }

      setGridReady(true);
    },
    [viewDs, filterDs, sortDs, viewsManager, filtersManager, sortsManager, persistGridState],
  );

  // Deferred bootstrap for defaults: if the saved list DS finishes loading
  // _after_ `getState` ran (common: the `views`/`sorts` datasource
  // is populated asynchronously), fall back to the record flagged `isDefault`.
  // Each kind has its own "tried" flag so we only apply once.
  useEffect(() => {
    if (!gridReady) return;
    if (viewDefaultTriedRef.current) return;
    if (viewsManager.savedViews.length === 0) return;
    const appliedName = viewsManager.tryApplyDefault();
    if (appliedName) setSelectedView(appliedName);
    viewDefaultTriedRef.current = true;
  }, [gridReady, viewsManager.savedViews, viewsManager]);

  // Keep the "default" checkbox in sync with the record selected in the
  // `Saved views` dropdown so the user sees its current flag value.
  useEffect(() => {
    if (!selectedView) {
      setIsViewDefault(false);
      return;
    }
    const record = viewsManager.savedViews.find(
      (v) =>
        v.name === selectedView ||
        v.title === selectedView ||
        (v.id != null && String(v.id) === selectedView),
    );
    setIsViewDefault(Boolean(record?.isDefault));
  }, [selectedView, viewsManager.savedViews]);

  useEffect(() => {
    if (!gridReady) return;
    const list = sortsManager.savedSorts;
    const defaultRecord = list.find((r) => r.isDefault);
    if (!defaultRecord) {
      sortDefaultAppliedKeyRef.current = '';
      return;
    }
    const key = defaultRecord.name;
    if (sortDefaultAppliedKeyRef.current === key) return;
    if (skipAutoSortDefaultRef.current) return;

    const appliedName = sortsManager.tryApplyDefault();
    if (appliedName) {
      setSelectedSortName(appliedName);
      sortDefaultAppliedKeyRef.current = appliedName;
    }
  }, [gridReady, sortsManager.savedSorts]);

  /**
   * Translate an AG Grid `sortModel` into the tail of a 4D/Qodly `query()`
   * string (`colA desc, colB asc`). Returns an empty string when the model
   * is empty or no rule resolves to a known `source` attribute.
   */
  // sanitize values to plain JSON-safe primitives/objects to avoid circular refs
  const sanitizeValue = (v: any): any => {
    if (v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      return v;
    }
    if (v instanceof Date) return v.toISOString();

    if (Array.isArray(v)) return v.map(sanitizeValue);

    if (typeof v === 'object') {
      // Entity-like object: return key or minimal id if available
      // shallow copy of primitive props only
      const out: any = {};
      Object.keys(v).forEach((k) => {
        const val = v[k];
        if (val === null || val === undefined) out[k] = val;
        else if (['string', 'number', 'boolean'].includes(typeof val)) out[k] = val;
        else if (val instanceof Date) out[k] = val.toISOString();
      });
      return out;
    }
    return String(v);
  };

  const sanitizeRow = (row: any) => {
    const result: any = {};
    (columns || []).forEach((col: any) => {
      const key = col.source ?? col.title;
      const stable = agGridColumnField(col);
      const raw =
        get(row, stable) ??
        row?.[stable] ??
        row?.[col.title] ??
        (typeof col?.source === 'string' && col.source.trim()
          ? get(row?.__entity, col.source)
          : undefined);
      result[key] = sanitizeValue(raw);
    });
    return result;
  };

  const prevCopyModeRef = useRef<CopyMode | null>(null);
  useEffect(() => {
    if (!showCopyActions || !currentSelectionDS) {
      prevCopyModeRef.current = copyMode;
      return;
    }

    const prev = prevCopyModeRef.current;
    prevCopyModeRef.current = copyMode;

    let cancel: (() => void) | undefined;

    // Cells: always clear Selected Selection when entering this mode (defer so it wins over grid churn).
    if (copyMode === 'cells' && prev !== 'cells') {
      const t = window.setTimeout(() => {
        void currentSelectionDS.setValue(null, []);
      }, 0);
      cancel = () => clearTimeout(t);
    } else if (copyMode === 'rows' && prev !== 'rows' && multiSelection) {
      // Rows: never push [] on mode change — that was wiping Selected Selection. Only sync when grid has rows checked.
      const t = window.setTimeout(() => {
        const api = gridRef.current?.api;
        if (!api) return;
        const selectedNodes = api.getSelectedNodes().filter((n: any) => n?.data);
        if (selectedNodes.length === 0) return;
        const sanitized = selectedNodes.map((n: any) => sanitizeRow(n.data || {}));
        void currentSelectionDS.setValue(null, sanitized);
      }, 0);
      cancel = () => clearTimeout(t);
    }

    return () => cancel?.();
  }, [copyMode, showCopyActions, currentSelectionDS, multiSelection, columns]);

  const onGridKeyDownCapture = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (isEditableTarget(event.target)) return;

      const api = gridRef.current?.api;
      if (!api) return;
      handleCopyShortcut(event, api);
    },
    [handleCopyShortcut],
  );

  const syncCellRangeSelectionFromApi = useCallback(() => {
    const api = gridRef.current?.api;
    if (!api || typeof (api as any).getCellRanges !== 'function') {
      setCellRangeSelectionActive(false);
      return;
    }
    const ranges = (api as any).getCellRanges() as unknown[] | null;
    setCellRangeSelectionActive(Array.isArray(ranges) && ranges.length > 0);
  }, []);

  const onCellSelectionChanged = useCallback(() => {
    if (!showCopyActions || !isCellSelectionAvailable || copyMode !== 'cells') return;
    syncCellRangeSelectionFromApi();
  }, [copyMode, isCellSelectionAvailable, showCopyActions, syncCellRangeSelectionFromApi]);

  const clearCopyCellsSelection = useCallback(() => {
    if (isCellSelectionAvailable) {
      (gridRef.current?.api as any)?.clearCellSelection?.();
      setCellRangeSelectionActive(false);
    } else {
      setManualSelectedCells([]);
    }
  }, [isCellSelectionAvailable]);

  /** Maps AG Grid sort model to a `DataClass.query`-style `order by` clause (attribute paths + asc/desc). */
  const buildOrderByClause = useCallback((sortModel: SortModelItem[], cols: IColumn[]): string => {
    return sortModel
      .map((rule) => {
        const matchedColumn = cols.find(
          (column) => column.title === rule.colId || column.source === rule.colId,
        );
        if (!matchedColumn?.source || !rule.sort) return '';
        const src = String(matchedColumn.source).trim();
        if (!src) return '';
        return `${src} ${rule.sort}`;
      })
      .filter(Boolean)
      .join(', ');
  }, []);

  const fetchData = useCallback(async (fetchCallback: any, params: IGetRowsParams) => {
    const count = params.endRow - params.startRow;
    const cols = columnsRef.current;
    const entities = await fetchCallback(params.startRow, count);
    const rowData = entities.map((data: any) => {
      const row: any = {
        __entity: data,
      };
      cols.forEach((col) => {
        const source = typeof col?.source === 'string' ? col.source.trim() : '';
        const fieldPath = agGridColumnField(col);
        const value = source ? get(data, source) : undefined;
        if (typeof fieldPath === 'string' && fieldPath.includes('.')) {
          set(row, fieldPath, value);
        } else {
          row[fieldPath] = value;
        }
      });
      return row;
    });
    return { entities, rowData };
  }, []);

  const buildServerEmitPack = useCallback(
    (api: GridApi, rowParams: IGetRowsParams | null) => {
      const apiFm = api.getFilterModel() ?? {};
      const rowFm = rowParams?.filterModel ?? {};
      const effectiveFilterModel = withAdvancedRulesOnFilterModel(
        rowParams != null && !isEqual(rowFm, {}) ? rowFm : apiFm,
        getAdvancedRulesFromFilterModel(liveFilterModelRef.current),
      );
      const cols = columnsRef.current;

      const rawSort = buildSortModelFromColumnState(
        withoutSyntheticRowColumnState(api.getColumnState()),
      );
      const normalizedSort = normalizeSortModel(rawSort, cols, sortableColIdsRef.current);
      const orderByClause = buildOrderByClause(normalizedSort, cols);

      const filterQueries = buildFilterQueries(effectiveFilterModel, cols);
      const filterQuery = filterQueries.filter(Boolean).join(' AND ');

      const combinedQuery = [filterQuery.trim(), orderByClause ? `order by ${orderByClause}` : '']
        .filter(Boolean)
        .join(' ');

      const filterFingerprint = {
        filterModel: normalizeAgGridFilterModel(effectiveFilterModel) ?? {},
        advancedRules: getAdvancedRulesFromFilterModel(liveFilterModelRef.current),
        dateFinancial: Boolean(dateFinancial && dateFinancialEnabledRef.current),
        filterInactiveRecords: Boolean(filterInactiveRecords && filterInactiveRecordsEnabledRef.current),
        filterQuery,
      };

      const sortFingerprint = {
        sortModel: normalizedSort,
        orderBy: orderByClause,
      };

      const onFilterEmitPayload = {
        ...filterFingerprint,
        orderBy: orderByClause,
        sortModel: normalizedSort,
        combinedQuery,
      };

      const onSortEmitPayload = {
        sortModel: normalizedSort,
        orderBy: orderByClause,
      };

      return {
        filterFingerprint,
        sortFingerprint,
        onFilterEmitPayload,
        onSortEmitPayload,
      };
    },
    [buildOrderByClause, dateFinancial, filterInactiveRecords],
  );

  const buildServerEmitPackRef = useRef(buildServerEmitPack);
  buildServerEmitPackRef.current = buildServerEmitPack;

  const getSelectedRow = useCallback(async (api: GridApi) => {
    // select current element
    if (multiSelection) return;
    if (currentElement && selected === -1) {
      try {
        let index = -1;
        if (currentElement.type === 'entity') {
          const entity = (currentElement as any).getEntity();
          if (entity) {
            const pos = entity.getPos();
            const ownerSel = entity.getSelection();
            const sel = (dsRef.current as any)?.getSelection();
            if (sel && sel !== ownerSel) {
              // fixes qs#461
              sel.findEntityPosition(entity).then((posInSel: number) => {
                if (posInSel === pos) {
                  const rowNode = api.getRowNode(pos.toString());
                  api.ensureIndexVisible(pos, 'middle');
                  rowNode?.setSelected(true);
                }
              });
            } else {
              index = pos;
            }
          }
        } else if (
          currentElement.type === 'scalar' &&
          currentElement.dataType === 'object' &&
          currentElement.parentSource
        ) {
          index = (currentElement as any).getPos();
        }
        const rowNode = api.getRowNode(index.toString());
        api.ensureIndexVisible(index, 'middle');
        rowNode?.setSelected(true);
      } catch (e) {
        // proceed
      }
    }
  }, []);

  /** After bootstrap (`getState` + deferred saved defaults), baseline fingerprints so initial `getRows` never emits `onfilter`/`onsort`. */
  useEffect(() => {
    if (!gridReady) return;
    const api = gridRef.current?.api;
    if (!api || api.isDestroyed()) return;
    const { filterFingerprint, sortFingerprint } = buildServerEmitPack(api, null);
    lastEmittedOnFilterPayloadRef.current = cloneDeep(filterFingerprint);
    lastEmittedOnSortPayloadRef.current = cloneDeep(sortFingerprint);
    allowServerFilterSortEmitRef.current = true;
  }, [gridReady, ds?.id, buildServerEmitPack]);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    // save initial column state on first load
    setInitialColumnState(params.api.getColumnState());
    params.api.setGridOption('datasource', {
      getRows: async (rowParams: IGetRowsParams) => {
        const { filterFingerprint, sortFingerprint, onFilterEmitPayload, onSortEmitPayload } =
          buildServerEmitPackRef.current(params.api, rowParams);

        suppressDsChangeRefreshRef.current = true;
        try {
          if (allowServerFilterSortEmitRef.current) {
            if (!isEqual(filterFingerprint, lastEmittedOnFilterPayloadRef.current)) {
              const strippedFm = stripAdvancedRulesFromFilterModel(filterFingerprint.filterModel ?? {});
              const normalizedCols = normalizeAgGridFilterModel(strippedFm) ?? {};
              const hasColumnFilters =
                normalizedCols != null &&
                typeof normalizedCols === 'object' &&
                !Array.isArray(normalizedCols) &&
                Object.keys(normalizedCols).length > 0;
              const adv = filterFingerprint.advancedRules;
              const hasAdvancedRules = Array.isArray(adv) && adv.length > 0;
              if (hasColumnFilters || hasAdvancedRules) {
                await emitRef.current('onfilter', onFilterEmitPayload);
              }
              lastEmittedOnFilterPayloadRef.current = cloneDeep(filterFingerprint);
            }
            if (!isEqual(sortFingerprint, lastEmittedOnSortPayloadRef.current)) {
              await emitRef.current('onsort', onSortEmitPayload);
              lastEmittedOnSortPayloadRef.current = cloneDeep(sortFingerprint);
            }
          }

          const result = await fetchData(fetchGridPageFromSourceRef.current, rowParams);
          const entities = result.entities;
          const rowData = result.rowData;
          const entitySel = (dsRef.current as any)?.entitysel;
          const length = entitySel?._private?.selLength ?? 0;

          if (Array.isArray(entities)) {
            // Only evaluate on the first block: later infinite-range requests can return 0 rows and would
            // incorrectly clear the flag (e.g. rowData.length 0 while length is still the total).
            if (rowParams.startRow === 0) {
              setShowSelectAllHeaderCheckbox(
                multiSelection && length > 0 && rowData.length >= length,
              );
              setDisplayedRecordCount(length);
            }
            rowParams.successCallback(rowData, length);
          } else {
            setShowSelectAllHeaderCheckbox(false);
            rowParams.failCallback();
          }
          getSelectedRow(params.api);
        } finally {
          suppressDsChangeRefreshRef.current = false;
        }
      },
    });
    getState(params);
  }, []);

  const handleColumnToggle = (colField: string) => {
    setColumnVisibility((prev) =>
      prev.map((c) => (c.field === colField ? { ...c, isHidden: !c.isHidden } : c)),
    );
  };

  const resetColumnview = () => {
    setColumnVisibility(initialColumnVisibility);
    setSelectedView('');
    if (initialColumnState && gridRef.current?.api) {
      gridRef.current.api.applyColumnState({ state: initialColumnState, applyOrder: true });
      gridRef.current.api.setFilterModel(null);
      sortsManager.applySortModelToGrid([]);
    }
  };

  const handlePinChange = (colField: string, value: string) => {
    setColumnVisibility((prev) =>
      prev.map((col) => {
        if (col.field !== colField) return col;
        const pinnedValue = value === 'unpinned' ? null : (value as 'left' | 'right');
        return { ...col, pinned: pinnedValue };
      }),
    );
  };

  const handleLoadViewSelection = useCallback(
    (next: string) => {
      setSelectedView(next);
      if (!next) return;
      viewsManager.loadView(next);
      const api = gridRef.current?.api;
      if (!api) return;
      const currentState = withoutSyntheticRowColumnState(api.getColumnState());
      setColumnVisibility((prev) =>
        currentState.map((col: any) => {
          const previous = prev.find((p) => p.field === col.colId);
          return {
            field: col.colId,
            isHidden: col.hide || false,
            pinned: col.pinned || null,
            i18n: previous?.i18n ?? null,
            width: col.width ?? previous?.width ?? null,
            flex: col.flex ?? previous?.flex ?? null,
          };
        }),
      );
    },
    [viewsManager],
  );

  const openAdvancedSortingDialog = () => {
    const fromGrid = buildSortModelFromColumnState(gridRef.current?.api?.getColumnState());
    setSortDialogInitialModel(
      normalizeSortModel(fromGrid, columnsRef.current, sortableColIdsRef.current),
    );
    setShowSortingDialog(true);
  };

  const openAdvancedFilterDialog = () => {
    const fromGrid = gridRef.current?.api?.getFilterModel() ?? {};
    const prevRules = getAdvancedRulesFromFilterModel(liveFilterModelRef.current);
    const next = withAdvancedRulesOnFilterModel(fromGrid, prevRules);
    commitLiveFilterModel(next);
    setShowFilterDialog(true);
  };

  const normalizedColumns = useMemo(() => {
    const idFields = new Set(columns.filter(isHiddenIdColumn).map(agGridColumnField));
    return columnVisibility.filter(
      (column) =>
        column.field !== 'ag-Grid-SelectionColumn' &&
        column.field !== ROW_NUMBER_COL_ID &&
        !idFields.has(column.field),
    );
  }, [columnVisibility, columns]);

  const filteredColumns = useMemo(() => {
    const rawSearch = propertySearch.trim().toLowerCase();
    const compactSearch = rawSearch.replace(/[_\s]+/g, '');

    return [...normalizedColumns]
      .sort((a, b) => {
        const aVisible = !a.isHidden;
        const bVisible = !b.isHidden;
        if (aVisible !== bVisible) return aVisible ? -1 : 1;
        const aLabel = String(columnLabelByStableField.get(a.field) ?? a.field);
        const bLabel = String(columnLabelByStableField.get(b.field) ?? b.field);
        const labelCompare = aLabel.localeCompare(bLabel, undefined, { sensitivity: 'base' });
        if (labelCompare !== 0) return labelCompare;
        return a.field.localeCompare(b.field);
      })
      .filter((column) => {
        const isVisible = !column.isHidden;
        if (showVisibleOnly && !isVisible) return false;
        if (!rawSearch) return true;

        const displayLabel = columnLabelByStableField.get(column.field) ?? column.field;
        const field = column.field.toLowerCase();
        const label = String(displayLabel).toLowerCase();
        const compactField = field.replace(/[_\s]+/g, '');
        const compactLabel = label.replace(/[_\s]+/g, '');
        return (
          field.includes(rawSearch) ||
          compactField.includes(compactSearch) ||
          label.includes(rawSearch) ||
          compactLabel.includes(compactSearch)
        );
      });
  }, [columnLabelByStableField, normalizedColumns, propertySearch, showVisibleOnly]);

  const setFilteredColumnsVisible = (visible: boolean) => {
    filteredColumns.forEach((column) => {
      const isVisible = !column.isHidden;
      if (isVisible !== visible) {
        handleColumnToggle(column.field);
      }
    });
  };

  const resolvedStyle = useMemo<CSSProperties>(() => {
    const s = { ...style };
    if (s.height === '100%' || s.height === 'auto' || s.height === 'inherit') {
      if (containerHeight && containerHeight > 0) {
        s.height = `${containerHeight}px`;
      } else {
        s.height = '600px';
      }
    }
    return s;
  }, [style, containerHeight]);

  const showAnyToolbarSection =
    showToolbarActions ||
    showToolbarView ||
    showToolbarSorting ||
    showToolbarStatistics ||
    showToolbarSaveView ||
    showToolbarSavedViews;

  const showClearCopyCells =
    showCopyActions &&
    copyMode === 'cells' &&
    (cellRangeSelectionActive || (!isCellSelectionAvailable && manualSelectedCells.length > 0));

  const renderCopyCellsClearButton = () => {
    if (!showCopyActions || !showClearCopyCells) return null;
    return (
      <button
        type="button"
        className="rounded-md border px-2 py-1 text-xs"
        style={{
          height: '31px',
          borderColor: '#0000001A',
          color: '#44444C',
          fontSize: '12px',
          fontWeight: 500,
        }}
        onClick={clearCopyCellsSelection}
      >
        {!isCellSelectionAvailable && manualSelectedCells.length > 0
          ? `${translation('Clear')} (${manualSelectedCells.length})`
          : translation('Clear')}
      </button>
    );
  };

  return (
    <div
      ref={(el) => {
        containerRef.current = el?.parentElement as HTMLDivElement;
        connect(el);
      }}
      style={resolvedStyle}
      className={cn(className, classNames)}
    >
      {datasource ? (
        <div className="flex flex-col gap-2 h-full" onKeyDownCapture={onGridKeyDownCapture}>
          {showCopyActions && !(showColumnActions && showToolbarActions) && (
            <div className="flex items-center gap-2 px-4 pt-1">
              <IconPopover label={translation('Copy mode')}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCopyModeDialog(true);
                  }}
                  className="header-button-reload-view inline-flex items-center justify-center rounded-lg border"
                  style={{
                    width: '31px',
                    height: '31px',
                    borderRadius: '8px',
                    borderColor: '#0000001A',
                    color: '#44444C',
                  }}
                  aria-label={translation('Copy mode')}
                >
                  <FaCopy size={12} />
                </button>
              </IconPopover>
              {renderCopyCellsClearButton()}
            </div>
          )}
          {showColumnActions && (
            <>
              {showAnyToolbarSection && (
                <div
                  className="grid-header flex items-start justify-between flex-wrap gap-4 items-end"
                  style={{ boxShadow: '0px 1px 3px 0px rgba(0, 0, 0, 0.1)' }}
                >
                  {/* AGGrid header actions */}
                  {showToolbarActions && (
                    <div className="actions-section flex flex-col gap-2 rounded-lg bg-white px-4 py-2">
                      <span
                        className="actions-title"
                        style={{ color: '#717182', fontWeight: 500, fontSize: '11px' }}
                      >
                        {translation('Actions')}
                      </span>
                      <div className="flex flex-row gap-2">
                        <div className="flex gap-2">
                          <Element id="agGridActions" is={resolver.StyleBox} canvas />
                        </div>
                        <AgGridCalculsStatistique
                          translation={translation}
                          showToolbarStatistics={showToolbarStatistics}
                          statisticsColumns={statisticsColumns}
                          columnsRef={columnsRef}
                          gridRef={gridRef}
                          emit={emit}
                          calculStatistiqueResultDS={
                            calculStatistiqueResultDS as
                              | CalculsStatistiqueResultDatasource
                              | null
                              | undefined
                          }
                        />
                        {showToolbarSorting && (
                          <div className="sorting-section ">
                            <IconPopover label={translation('Advanced sorting')}>
                              <button
                                onClick={openAdvancedSortingDialog}
                                className="header-button-reload-view inline-flex items-center justify-center rounded-lg border"
                                style={{
                                  width: '31px',
                                  height: '31px',
                                  borderRadius: '8px',
                                  borderColor: '#0000001A',
                                  color: '#44444C',
                                }}
                                aria-label={translation('Advanced sorting')}
                              >
                                <FaSortAmountDown size={12} />
                              </button>
                            </IconPopover>
                          </div>
                        )}
                        {showToolbarFiltering && (
                          <div className="filtering-section flex flex-row gap-2">
                            <IconPopover label={translation('Advanced filtering')}>
                              <button
                                onClick={openAdvancedFilterDialog}
                                className="header-button-reload-view inline-flex items-center justify-center rounded-lg border"
                                style={{
                                  width: '31px',
                                  height: '31px',
                                  borderRadius: '8px',
                                  borderColor: '#0000001A',
                                  color: '#44444C',
                                }}
                                aria-label={translation('Advanced filtering')}
                              >
                                <FaFilter size={12} />
                              </button>
                            </IconPopover>
                            <IconPopover label={translation('Customize columns')}>
                              <button
                                className="header-button-customize-view inline-flex items-center justify-center rounded-lg border"
                                style={{
                                  width: '31px',
                                  height: '31px',
                                  borderRadius: '8px',
                                  borderColor: '#0000001A',
                                  color: '#44444C',
                                }}
                                onClick={() => setShowPropertiesDialog(true)}
                                aria-label={translation('Customize columns')}
                              >
                                <FaTableColumns size={14} />
                              </button>
                            </IconPopover>
                          </div>
                        )}
                        {showCopyActions && (
                          <div className="copy-mode-section flex items-center gap-2">
                            <IconPopover label={translation('Copy mode')}>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowCopyModeDialog(true);
                                }}
                                className="header-button-reload-view inline-flex items-center justify-center rounded-lg border"
                                style={{
                                  width: '31px',
                                  height: '31px',
                                  borderRadius: '8px',
                                  borderColor: '#0000001A',
                                  color: '#44444C',
                                }}
                                aria-label={translation('Copy mode')}
                              >
                                <FaCopy size={12} />
                              </button>
                            </IconPopover>
                            {renderCopyCellsClearButton()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="flex flex-row gap-2 flex-wrap">
                    {showToolbarView && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* columns customizer button */}
                        <div className="customizer-section flex flex-col gap-2 rounded-lg bg-white px-4 py-2">
                          <div className="flex gap-2">
                            <QuickShortcutMenu
                              menuLabel={translation('Open quick shortcuts')}
                              buttonText={translation('Shortcuts')}
                              sections={[
                                {
                                  id: 'views',
                                  label: translation('Views'),
                                  emptyLabel: translation('No saved views'),
                                  items: (showToolbarView ? viewsManager.savedViews : []).map(
                                    (view) => {
                                      const key = String(view.name ?? view.title ?? view.id ?? '');
                                      return { id: key, label: key };
                                    },
                                  ),
                                  onSelect: (itemId) => handleLoadViewSelection(itemId),
                                },
                                {
                                  id: 'filters',
                                  label: translation('Filters'),
                                  emptyLabel: translation('No saved filters'),
                                  items: (showToolbarFiltering
                                    ? filtersManager.savedFilters
                                    : []
                                  ).map((filterRecord) => {
                                    const key = String(
                                      filterRecord.name ??
                                        filterRecord.title ??
                                        filterRecord.id ??
                                        '',
                                    );
                                    return { id: key, label: key };
                                  }),
                                  onSelect: (itemId) => {
                                    setSelectedFilterName(itemId);
                                    filtersManager.loadFilter(itemId);
                                    setDateFinancialFilterEnabled(
                                      Boolean(dateFinancialEnabledRef.current),
                                    );
                                    setFilterInactiveRecordsEnabled(
                                      Boolean(filterInactiveRecordsEnabledRef.current),
                                    );
                                  },
                                },
                                {
                                  id: 'sorts',
                                  label: translation('Sorts'),
                                  emptyLabel: translation('No saved sorts'),
                                  items: (showToolbarSorting ? sortsManager.savedSorts : []).map(
                                    (sort) => {
                                      const key = String(sort.name ?? sort.title ?? sort.id ?? '');
                                      return { id: key, label: key };
                                    },
                                  ),
                                  onSelect: (itemId) => {
                                    setSelectedSortName(itemId);
                                    sortsManager.loadSort(itemId);
                                  },
                                },
                              ]}
                            />
                            <IconPopover label={translation('Reset')}>
                              <button
                                className="header-button-reload-view inline-flex items-center justify-center rounded-lg border"
                                style={{
                                  width: '31px',
                                  height: '31px',
                                  borderRadius: '8px',
                                  borderColor: '#0000001A',
                                  color: '#44444C',
                                }}
                                onClick={() => resetColumnview()}
                                aria-label={translation('Reset')}
                              >
                                <FaClockRotateLeft size={14} />
                              </button>
                            </IconPopover>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* columns customizer dialog */}
                  {showToolbarView && (
                    <ViewDialog
                      open={showPropertiesDialog}
                      onClose={() => setShowPropertiesDialog(false)}
                      translation={translation}
                      showToolbarSaveView={showToolbarSaveView}
                      showToolbarSavedViews={showToolbarSavedViews}
                      viewName={viewName}
                      setViewName={setViewName}
                      selectedView={selectedView}
                      onLoadView={handleLoadViewSelection}
                      isViewDefault={isViewDefault}
                      setIsViewDefault={setIsViewDefault}
                      viewsManager={viewsManager}
                      propertySearch={propertySearch}
                      setPropertySearch={setPropertySearch}
                      showVisibleOnly={showVisibleOnly}
                      setShowVisibleOnly={setShowVisibleOnly}
                      filteredColumns={filteredColumns}
                      setFilteredColumnsVisible={setFilteredColumnsVisible}
                      handleColumnToggle={handleColumnToggle}
                      handlePinChange={handlePinChange}
                      columnLabelByStableField={columnLabelByStableField}
                    />
                  )}
                  {showToolbarSorting && (
                    <SortingDialog
                      open={showSortingDialog}
                      onClose={() => setShowSortingDialog(false)}
                      translation={translation}
                      columns={columns}
                      sortableColumns={sortableColumns}
                      initialSortModel={sortDialogInitialModel}
                      onApply={(model) => {
                        sortsManager.applySortModelToGrid(model);
                      }}
                      onClear={() => {
                        sortsManager.applySortModelToGrid([]);
                      }}
                      savedSorts={sortsManager.savedSorts}
                      saveSort={sortsManager.saveSort}
                      updateSort={sortsManager.updateSort}
                      deleteSort={sortsManager.deleteSort}
                      selectedSort={selectedSortName}
                      setSelectedSort={setSelectedSortName}
                    />
                  )}
                  {showToolbarFiltering && (
                    <FilterDialog
                      open={showFilterDialog}
                      onClose={() => setShowFilterDialog(false)}
                      translation={translation}
                      i18n={i18n}
                      lang={lang}
                      columns={columns}
                      showDateFinancialToggle={Boolean(dateFinancial)}
                      dateFinancialFilterEnabled={dateFinancialFilterEnabled}
                      onDateFinancialFilterEnabledChange={applyDateFinancialFilterToggle}
                      showFilterInactiveRecordsToggle={Boolean(filterInactiveRecords)}
                      filterInactiveRecordsEnabled={filterInactiveRecordsEnabled}
                      onFilterInactiveRecordsEnabledChange={applyFilterInactiveRecordsToggle}
                      filterModel={liveFilterModel}
                      setFilterModel={(next) => {
                        const api = gridRef.current?.api;
                        if (!api || api.isDestroyed()) return;
                        const prevLiveModel = liveFilterModelRef.current ?? {};
                        const nextAg = stripAdvancedRulesFromFilterModel(next ?? {});
                        const currentAg = stripAdvancedRulesFromFilterModel(
                          api.getFilterModel() ?? {},
                        );
                        const agChanged = !isEqual(currentAg, nextAg);
                        if (agChanged) {
                          api.setFilterModel(Object.keys(nextAg).length ? nextAg : null);
                          persistFilterDsNow(nextAg);
                        }
                        const normalizedNextLive = next ?? {};
                        const liveChanged = !isEqual(prevLiveModel, normalizedNextLive);
                        commitLiveFilterModel(normalizedNextLive);
                        if (!agChanged && liveChanged) {
                          persistFilterDsNow(nextAg);
                          filtersManager.persistCurrent(nextAg);
                          api.refreshInfiniteCache();
                        }
                      }}
                      savedFilters={filtersManager.savedFilters}
                      savedSorts={sortsManager.savedSorts}
                      saveFilter={filtersManager.saveFilter}
                      loadFilter={(key) => {
                        filtersManager.loadFilter(key);
                        setDateFinancialFilterEnabled(Boolean(dateFinancialEnabledRef.current));
                        setFilterInactiveRecordsEnabled(
                          Boolean(filterInactiveRecordsEnabledRef.current),
                        );
                      }}
                      updateFilter={filtersManager.updateFilter}
                      deleteFilter={filtersManager.deleteFilter}
                      selectedFilter={selectedFilterName}
                      setSelectedFilter={setSelectedFilterName}
                    />
                  )}
                </div>
              )}
            </>
          )}
          {showCopyActions && showCopyModeDialog && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
              onClick={() => setShowCopyModeDialog(false)}
            >
              <div
                className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 rounded-t-xl border-b border-slate-200 px-5 py-4">
                  <div>
                    <span
                      className="tracking-wide"
                      style={{ color: '#0A0A0A', fontSize: '16px', fontWeight: 500 }}
                    >
                      {translation('Copy mode')}
                    </span>
                    <span
                      className="mt-1 block text-sm"
                      style={{ color: '#4A5565', fontSize: '14px' }}
                    >
                      {translation('Choose how keyboard copy applies to the grid')}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center"
                    style={{ color: '#6A7282' }}
                    onClick={() => setShowCopyModeDialog(false)}
                  >
                    <IoMdClose />
                  </button>
                </div>
                <div className="px-5 py-4">
                  <div className="space-y-2">
                    {(
                      [
                        { value: 'cells' as CopyMode, title: translation('Cells') },
                        { value: 'rows' as CopyMode, title: translation('Rows') },
                        { value: 'none' as CopyMode, title: translation('Nothing') },
                      ] as const
                    ).map((opt) => {
                      const selected = copyMode === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          className="flex w-full cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors"
                          style={{
                            borderColor: selected ? '#2B5797' : '#E5E7EB',
                            backgroundColor: selected ? '#F3F3F5' : '#FFFFFF',
                          }}
                          aria-pressed={selected}
                          onClick={() => applyUserCopyMode(opt.value)}
                        >
                          <span
                            className="inline-block h-4 w-4 shrink-0 rounded-full border-2"
                            style={{
                              borderColor: selected ? '#2B5797' : '#CBD5E1',
                              backgroundColor: selected ? '#2B5797' : 'transparent',
                              boxShadow: selected ? 'inset 0 0 0 3px #F3F3F5' : undefined,
                            }}
                            aria-hidden
                          />
                          <span
                            className="min-w-0 flex-1 text-sm font-medium"
                            style={{ color: '#0A0A0A' }}
                          >
                            {opt.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
          {showRecordCount && (
            <div className="records-count text-sm  flex justify-end gap-2 mt-2 mb-2 pr-4">
              <span style={{ color: '#0A0A0A', fontSize: '12px', fontWeight: 400 }}>
                {displayedRecordCount}
              </span>{' '}
              <span style={{ color: '#717182', fontSize: '12px', fontWeight: 400 }}>
                {translation('records')}
              </span>
            </div>
          )}
          <div className="h-full">
            <HeaderFilterPopup
              open={!!headerFilterPopupState}
              anchorRect={headerFilterPopupState?.anchorRect ?? null}
              colId={headerFilterPopupState?.colId ?? null}
              column={headerPopupColumn}
              i18n={i18n}
              lang={lang}
              currentModel={liveFilterModel}
              currentEntry={
                headerFilterPopupState
                  ? (liveFilterModel?.[headerFilterPopupState.colId] ?? null)
                  : null
              }
              showDateFinancialToggle={Boolean(dateFinancial)}
              dateFinancialFilterEnabled={dateFinancialFilterEnabled}
              onDateFinancialFilterEnabledChange={applyDateFinancialFilterToggle}
              showFilterInactiveRecordsToggle={Boolean(filterInactiveRecords)}
              filterInactiveRecordsEnabled={filterInactiveRecordsEnabled}
              onFilterInactiveRecordsEnabledChange={applyFilterInactiveRecordsToggle}
              translation={translation}
              onApply={(nextModel) => {
                applyHeaderFilterModel(nextModel ?? {});
              }}
              onClose={() => setHeaderFilterPopupState(null)}
            />
            <AgGridReact
              ref={gridRef}
              columnDefs={gridColumnDefs}
              components={agGridFilterComponents}
              maintainColumnOrder
              defaultColDef={defaultColDef}
              onRowClicked={onRowClicked}
              onSelectionChanged={onSelectionChanged}
              onRowDoubleClicked={onRowDoubleClicked}
              onGridReady={onGridReady}
              onFilterChanged={onFilterChanged}
              onColumnResized={onColumnResized}
              rowModelType="infinite"
              rowSelection={{
                mode: multiSelection ? 'multiRow' : 'singleRow',
                enableClickSelection: true,
                enableSelectionWithoutKeys: multiSelection,
                checkboxes: multiSelection,
                copySelectedRows: copyMode === 'rows' && multiSelection,
                ...(multiSelection ? { headerCheckbox: false as const } : {}),
              }}
              selectionColumnDef={selectionColumnDef}
              cellSelection={copyMode === 'cells' && isCellSelectionAvailable}
              copyHeadersToClipboard={true}
              cacheBlockSize={100}
              maxBlocksInCache={10}
              cacheOverflowSize={2}
              maxConcurrentDatasourceRequests={1}
              rowBuffer={0}
              onStateUpdated={onStateUpdated}
              onCellClicked={onCellClicked}
              onCellDoubleClicked={onCellDoubleClicked}
              onColumnHeaderClicked={onHeaderClicked}
              onCellMouseDown={onCellMouseDown}
              onCellMouseOut={onCellMouseOut}
              onCellMouseOver={onCellMouseOver}
              onCellKeyDown={onCellKeyDown}
              onCellSelectionChanged={onCellSelectionChanged}
              getRowClass={getRowClass}
              theme={theme}
              className={cn({ 'pointer-events-none opacity-40': disabled })}
              columnHoverHighlight={enableColumnHover}
            />
          </div>
        </div>
      ) : (
        <div className="flex h-full flex-col items-center justify-center rounded-lg border bg-purple-400 py-4 text-white">
          <p>Error</p>
        </div>
      )}
    </div>
  );
};

export default AgGrid;
