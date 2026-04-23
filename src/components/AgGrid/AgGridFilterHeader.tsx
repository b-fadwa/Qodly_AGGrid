import type { CustomHeaderProps } from 'ag-grid-react';
import {
  forwardRef,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { FaFilter } from 'react-icons/fa';

export type AgGridFilterHeaderParams = CustomHeaderProps & {
  filterable?: boolean;
  translation: (key: string) => string;
  onOpenFilter: (args: { colId: string; anchorEl: HTMLElement }) => void;
  isColumnFilterActive?: (colId: string) => boolean;
};

const HeaderPopover: React.FC<{ label: string; children: any }> = ({ label, children }) => {
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
      className="inline-flex min-w-0"
      onMouseEnter={show}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={show}
      onBlurCapture={() => setOpen(false)}
    >
      {children}
      {open && label ? (
        <div
          className="pointer-events-none fixed z-[100002] -translate-x-1/2 whitespace-nowrap rounded-md border px-2 py-1"
          style={{
            top: `${pos.top}px`,
            left: `${pos.left}px`,
            background: '#FFFFFF',
            borderColor: '#0000001A',
            boxShadow: 'rgba(0, 0, 0, 0.1) 0px -4px 12px 0px',
            fontSize: '12px',
            fontWeight: 400,
            color: '#44444C',
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};

const AgGridFilterHeader = forwardRef<{ refresh: () => boolean }, AgGridFilterHeaderParams>(
  function AgGridFilterHeader(props, ref) {
    const {
      column,
      displayName,
      enableSorting,
      filterable = false,
      translation,
      onOpenFilter,
    } = props;
    const filterBtnRef = useRef<HTMLButtonElement>(null);
    const [sortState, setSortState] = useState<string | null>(() => column.getSort() ?? null);
    const [isFilterHovered, setIsFilterHovered] = useState(false);
    const [sortIndex, setSortIndex] = useState<number | null>(() => {
      const raw = (column as any)?.getSortIndex?.();
      return typeof raw === 'number' && raw >= 0 ? raw : null;
    });
    const computeFilterActive = useCallback((): boolean => {
      // Prefer an OR-combination of all available sources. In this project,
      // header filters can be mirrored through advanced rules before AG Grid
      // fully reflects them on the column instance.
      const apiModel = props.api?.getFilterModel?.() ?? {};
      const colId = column.getColId();
      const fromApi = apiModel != null && Object.prototype.hasOwnProperty.call(apiModel, colId);
      const fromParentMirror = props.isColumnFilterActive?.(colId) ?? false;
      const fromColumn = column.isFilterActive();
      return fromApi || fromParentMirror || fromColumn;
    }, [props.api, props.isColumnFilterActive, column]);

    const [filterActive, setFilterActive] = useState<boolean>(() => computeFilterActive());

    useEffect(() => {
      const sync = () => {
        setSortState(column.getSort() ?? null);
        const raw = (column as any)?.getSortIndex?.();
        setSortIndex(typeof raw === 'number' && raw >= 0 ? raw : null);
        setFilterActive(computeFilterActive());
      };
      sync();
      column.addEventListener('sortChanged', sync);
      column.addEventListener('filterChanged', sync);
      props.api?.addEventListener?.('filterChanged', sync);
      return () => {
        column.removeEventListener('sortChanged', sync);
        column.removeEventListener('filterChanged', sync);
        props.api?.removeEventListener?.('filterChanged', sync);
      };
    }, [column, computeFilterActive, props.api]);

    useImperativeHandle(
      ref,
      () => ({
        refresh: () => {
          setSortState(column.getSort() ?? null);
          const raw = (column as any)?.getSortIndex?.();
          setSortIndex(typeof raw === 'number' && raw >= 0 ? raw : null);
          setFilterActive(computeFilterActive());
          return true;
        },
      }),
      [column, computeFilterActive],
    );

    const sortIndicator = useMemo(() => {
      if (!enableSorting) return '';
      if (sortState === 'asc') return '▲';
      if (sortState === 'desc') return '▼';
      return '';
    }, [enableSorting, sortState]);

    const toggleSort = (e: ReactMouseEvent<HTMLButtonElement>) => {
      if (!enableSorting) return;
      // Shift+click appends/removes this column in AG Grid multi-sort chain.
      props.progressSort(Boolean(e.shiftKey));
    };

    return (
      <div className="flex h-full w-full items-center justify-between gap-1 px-1">
        <HeaderPopover label={String(displayName ?? '')}>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-1 bg-transparent text-left"
            onClick={toggleSort}
          >
            <span className="truncate text-[12px] font-medium text-[#111827]">{displayName}</span>
            {sortIndicator ? (
              <span className="inline-flex items-center gap-1 text-[10px] leading-none text-[#4B5563]">
                <span>{sortIndicator}</span>
                {sortIndex !== null ? (
                  <span
                    className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full border border-[#D1D5DB] bg-white px-1 text-[9px] text-[#374151]"
                    title={translation('Sort order')}
                  >
                    {sortIndex + 1}
                  </span>
                ) : null}
              </span>
            ) : null}
          </button>
        </HeaderPopover>

        {filterable ? (
          <button
            ref={filterBtnRef}
            type="button"
            className="flex h-5 w-5 items-center justify-center rounded border"
            title={translation('Filter')}
            aria-label={translation('Filter')}
            style={{
              borderColor: filterActive
                ? 'rgba(99, 143, 207, 0.4)'
                : isFilterHovered
                  ? '#D1D5DB'
                  : 'transparent',
              backgroundColor: filterActive
                ? 'rgba(99, 143, 207, 0.15)'
                : isFilterHovered
                  ? '#F9FAFB'
                  : 'transparent',
            }}
            onMouseEnter={() => setIsFilterHovered(true)}
            onMouseLeave={() => setIsFilterHovered(false)}
            onFocus={() => setIsFilterHovered(true)}
            onBlur={() => setIsFilterHovered(false)}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!filterBtnRef.current) return;
              onOpenFilter({ colId: column.getColId(), anchorEl: filterBtnRef.current });
            }}
          >
            <FaFilter size={11} color={filterActive ? '#638FCF' : undefined} />
          </button>
        ) : null}
      </div>
    );
  },
);

export default AgGridFilterHeader;
