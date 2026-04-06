import type { CustomHeaderProps } from 'ag-grid-react';
import type { IRowNode } from 'ag-grid-community';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';

export type AgGridSelectionHeaderParams = CustomHeaderProps & {
  ariaLabelSelectAll?: string;
  /** When false, header is empty (select-all only makes sense if all rows fit in one infinite block). */
  showSelectAllCheckbox?: boolean;
};

function isSelectableDataRow(node: IRowNode): boolean {
  if (node.rowPinned != null) return false;
  if (node.group) return false;
  if (node.data == null) return false;
  if (node.selectable === false) return false;
  return true;
}

function countSelectionState(api: AgGridSelectionHeaderParams['api']) {
  let total = 0;
  let selected = 0;
  api.forEachNode((node) => {
    if (!isSelectableDataRow(node)) return;
    total += 1;
    if (node.isSelected()) selected += 1;
  });
  return {
    total,
    selected,
    allSelected: total > 0 && selected === total,
    indeterminate: selected > 0 && selected < total,
  };
}

const AgGridSelectionHeader = forwardRef<{ refresh: () => boolean }, AgGridSelectionHeaderParams>(
  function AgGridSelectionHeader(props, ref) {
    const { api, ariaLabelSelectAll, showSelectAllCheckbox = true } = props;
    const inputRef = useRef<HTMLInputElement>(null);

    const compute = useCallback(() => countSelectionState(api), [api]);

    const [allSelected, setAllSelected] = useState(false);
    const [indeterminate, setIndeterminate] = useState(false);

    const sync = useCallback(() => {
      const next = compute();
      setAllSelected(next.allSelected);
      setIndeterminate(next.indeterminate);
    }, [compute]);

    useEffect(() => {
      if (!showSelectAllCheckbox) return;
      sync();
    }, [sync, showSelectAllCheckbox]);

    useEffect(() => {
      const el = inputRef.current;
      if (el) el.indeterminate = indeterminate;
    }, [indeterminate]);

    useEffect(() => {
      if (!showSelectAllCheckbox) return;
      const handler = () => sync();
      api.addEventListener('selectionChanged', handler);
      api.addEventListener('modelUpdated', handler);
      return () => {
        api.removeEventListener('selectionChanged', handler);
        api.removeEventListener('modelUpdated', handler);
      };
    }, [api, sync, showSelectAllCheckbox]);

    useImperativeHandle(
      ref,
      () => ({
        refresh: () => {
          if (showSelectAllCheckbox) sync();
          return true;
        },
      }),
      [showSelectAllCheckbox, sync],
    );

    const onChange = () => {
      if (allSelected) {
        api.deselectAll();
        return;
      }
      const nodes: IRowNode[] = [];
      api.forEachNode((node) => {
        if (isSelectableDataRow(node)) nodes.push(node);
      });
      if (nodes.length > 0) {
        api.setNodesSelected({ nodes, newValue: true });
      }
    };

    if (!showSelectAllCheckbox) {
      return <div className="flex h-full w-full" aria-hidden />;
    }

    return (
      <div className="flex h-full w-full items-center justify-center">
        <input
          ref={inputRef}
          type="checkbox"
          className="cursor-pointer rounded border border-gray-300 accent-[#2B5797]"
          style={{ height: 14, width: 14 }}
          checked={allSelected}
          onChange={onChange}
          aria-label={ariaLabelSelectAll ?? 'Select all rows'}
        />
      </div>
    );
  },
);

export default AgGridSelectionHeader;
