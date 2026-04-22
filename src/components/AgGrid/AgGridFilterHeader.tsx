import type { CustomHeaderProps } from 'ag-grid-react';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
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
    const [filterActive, setFilterActive] = useState<boolean>(() => column.isFilterActive());

    useEffect(() => {
      const sync = () => {
        setSortState(column.getSort() ?? null);
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

    const toggleSort = () => {
      if (!enableSorting) return;
      props.progressSort(false);
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
            <span className="text-[10px] leading-none text-[#4B5563]">{sortIndicator}</span>
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
