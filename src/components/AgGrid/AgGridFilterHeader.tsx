import type { CustomHeaderProps } from 'ag-grid-react';
import {
  forwardRef,
  type MouseEvent as ReactMouseEvent,
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
};

const AgGridFilterHeader = forwardRef<{ refresh: () => boolean }, AgGridFilterHeaderParams>(
  function AgGridFilterHeader(props, ref) {
    const { column, displayName, enableSorting, filterable = false, translation, onOpenFilter } = props;
    const filterBtnRef = useRef<HTMLButtonElement>(null);
    const [sortState, setSortState] = useState<string | null>(() => column.getSort() ?? null);
    const [sortIndex, setSortIndex] = useState<number | null>(() => {
      const raw = (column as any)?.getSortIndex?.();
      return typeof raw === 'number' && raw >= 0 ? raw : null;
    });
    const [filterActive, setFilterActive] = useState<boolean>(() => column.isFilterActive());

    useEffect(() => {
      const sync = () => {
        setSortState(column.getSort() ?? null);
        const raw = (column as any)?.getSortIndex?.();
        setSortIndex(typeof raw === 'number' && raw >= 0 ? raw : null);
        setFilterActive(column.isFilterActive());
      };
      sync();
      column.addEventListener('sortChanged', sync);
      column.addEventListener('filterChanged', sync);
      return () => {
        column.removeEventListener('sortChanged', sync);
        column.removeEventListener('filterChanged', sync);
      };
    }, [column]);

    useImperativeHandle(
      ref,
      () => ({
        refresh: () => {
          setSortState(column.getSort() ?? null);
          const raw = (column as any)?.getSortIndex?.();
          setSortIndex(typeof raw === 'number' && raw >= 0 ? raw : null);
          setFilterActive(column.isFilterActive());
          return true;
        },
      }),
      [column],
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
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1 bg-transparent text-left"
          onClick={toggleSort}
          title={String(displayName ?? '')}
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

        {filterable ? (
          <button
            ref={filterBtnRef}
            type="button"
            className="flex h-5 w-5 items-center justify-center rounded border border-transparent bg-transparent text-[#6B7280] hover:border-[#D1D5DB] hover:bg-[#F9FAFB]"
            title={translation('Filter')}
            aria-label={translation('Filter')}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!filterBtnRef.current) return;
              onOpenFilter({ colId: column.getColId(), anchorEl: filterBtnRef.current });
            }}
          >
            <FaFilter size={11} color={filterActive ? '#2B5797' : undefined} />
          </button>
        ) : null}
      </div>
    );
  },
);

export default AgGridFilterHeader;
