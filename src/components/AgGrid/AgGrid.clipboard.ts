import { GridApi } from 'ag-grid-community';

export type GridCopyMode = 'cells' | 'rows';

/** Full tri-state for toolbar / keyboard copy (including disabled). */
export type GridCopyModeSetting = 'cells' | 'rows' | 'none';

const copyModeStorageKey = (nodeId: string) => `qodly-aggrid:copyMode:${nodeId}`;

/**
 * Per-grid copy mode so users keep “select + Ctrl+C” after the first visit.
 * Falls back to `rows` when multi-select is on (desktop-like), else `cells`.
 */
export function getInitialGridCopyMode(
  nodeId: string | undefined,
  multiSelection: boolean,
): GridCopyModeSetting {
  if (typeof localStorage === 'undefined' || !nodeId) {
    return multiSelection ? 'rows' : 'cells';
  }
  try {
    const raw = localStorage.getItem(copyModeStorageKey(nodeId));
    if (raw === 'cells' || raw === 'rows' || raw === 'none') return raw;
  } catch {
    // ignore
  }
  return multiSelection ? 'rows' : 'cells';
}

export function persistGridCopyMode(nodeId: string | undefined, mode: GridCopyModeSetting): void {
  if (typeof localStorage === 'undefined' || !nodeId) return;
  try {
    localStorage.setItem(copyModeStorageKey(nodeId), mode);
  } catch {
    // ignore
  }
}
export type TManualSelectedCell = {
  rowIndex: number;
  colId: string;
  headerName: string;
  value: any;
};

type CopyShortcutEvent = {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
};

export const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!target || !(target instanceof HTMLElement)) return false;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target.isContentEditable
  );
};

export const isCopyShortcut = (event: CopyShortcutEvent): boolean => {
  return (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'c';
};

const stringifyClipboardValue = (value: any): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value);
  } catch (_) {
    return String(value);
  }
};

const getValueByDottedPath = (obj: any, path: string): any => {
  if (!obj || !path) return '';
  // Prefer exact match when backend flattens keys containing dots.
  if (typeof obj === 'object' && obj !== null && path in obj) return obj[path];
  if (!path.includes('.')) return '';

  const parts = path.split('.').filter(Boolean);
  let current: any = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return '';
    if (typeof current !== 'object') return '';
    if (!(part in current)) return '';
    current = current[part];
  }
  return current;
};

const getColumnCellValue = (rowData: any, column: any): any => {
  if (!rowData || !column) return '';
  const colId = column.getColId?.();
  const field = column.getColDef?.()?.field;
  if (colId && colId in rowData) return rowData[colId];
  if (field && field in rowData) return rowData[field];
  if (typeof colId === 'string') {
    const viaColIdPath = getValueByDottedPath(rowData, colId);
    if (viaColIdPath !== '') return viaColIdPath;
  }
  if (typeof field === 'string') {
    const viaFieldPath = getValueByDottedPath(rowData, field);
    if (viaFieldPath !== '') return viaFieldPath;
  }
  return '';
};

const getHeaderText = (column: any): string => {
  const colDef = column.getColDef?.();
  return String(colDef?.headerName ?? colDef?.field ?? column.getColId?.() ?? '');
};

const getCopyColumns = (api: GridApi): any[] => {
  return api
    .getAllDisplayedColumns()
    .filter((column: any) => !!column.getColDef?.()?.field);
};

/** First displayed column that has a `field` (excludes row #, selection, etc.) — use for focus so copy sees a real cell. */
export const getFirstDataColumnForCopy = (api: GridApi): any | undefined => {
  const cols = getCopyColumns(api);
  return cols[0];
};

export const buildSelectedRowsClipboardText = (api: GridApi): string => {
  const selectedNodes = [...api.getSelectedNodes()].filter((node: any) => !!node?.data);
  if (!selectedNodes.length) return '';

  const columns = getCopyColumns(api);
  if (!columns.length) return '';

  selectedNodes.sort((a: any, b: any) => (a.rowIndex ?? 0) - (b.rowIndex ?? 0));

  const headers = columns.map(getHeaderText).join('\t');
  const rows = selectedNodes
    .map((node: any) =>
      columns
        .map((column: any) => stringifyClipboardValue(getColumnCellValue(node.data, column)))
        .join('\t'),
    )
    .join('\n');

  return [headers, rows].filter(Boolean).join('\n');
};

export const buildSelectedCellRangesClipboardText = (api: GridApi): string => {
  const ranges = api.getCellRanges?.();
  if (!ranges?.length) return '';

  const texts = ranges
    .map((range: any) => {
      if (!range.startRow || !range.endRow || range.startRow.rowPinned || range.endRow.rowPinned) {
        return '';
      }
      const columnsInRange = (range.columns || []).filter((column: any) => !!column.getColDef?.()?.field);
      if (!columnsInRange.length) return '';

      const startIndex = Math.min(range.startRow.rowIndex, range.endRow.rowIndex);
      const endIndex = Math.max(range.startRow.rowIndex, range.endRow.rowIndex);
      const rows: string[] = [columnsInRange.map(getHeaderText).join('\t')];

      for (let rowIndex = startIndex; rowIndex <= endIndex; rowIndex += 1) {
        const rowNode = api.getDisplayedRowAtIndex(rowIndex);
        if (!rowNode?.data) continue;
        rows.push(
          columnsInRange
            .map((column: any) => stringifyClipboardValue(getColumnCellValue(rowNode.data, column)))
            .join('\t'),
        );
      }
      return rows.join('\n');
    })
    .filter(Boolean);

  return texts.join('\n');
};

export const buildFocusedCellClipboardText = (api: GridApi): string => {
  const focusedCell = api.getFocusedCell?.();
  if (!focusedCell || focusedCell.rowPinned) return '';

  const rowNode = api.getDisplayedRowAtIndex(focusedCell.rowIndex);
  const column: any = focusedCell.column;
  if (!rowNode?.data || !column?.getColDef?.()?.field) return '';

  const header = getHeaderText(column);
  const value = stringifyClipboardValue(getColumnCellValue(rowNode.data, column));
  return [header, value].join('\n');
};

export const buildManualSelectedCellsClipboardText = (
  cells: TManualSelectedCell[],
  api: GridApi,
): string => {
  if (!cells.length) return '';

  const selectedColSet = new Set(cells.map((cell) => cell.colId));
  const displayedColumns = api.getAllDisplayedColumns();
  const orderedColumns = displayedColumns.filter((column: any) => selectedColSet.has(column.getColId()));

  const columnsForCopy =
    orderedColumns.length > 0
      ? orderedColumns.map((column: any) => ({
        colId: column.getColId(),
        header: getHeaderText(column),
      }))
      : Array.from(
        cells.reduce((map, cell) => {
          if (!map.has(cell.colId)) map.set(cell.colId, cell.headerName || cell.colId);
          return map;
        }, new Map<string, string>()),
      ).map(([colId, header]) => ({ colId, header }));

  if (!columnsForCopy.length) return '';

  const byRow = new Map<number, Map<string, any>>();
  cells.forEach((cell) => {
    if (!byRow.has(cell.rowIndex)) byRow.set(cell.rowIndex, new Map<string, any>());
    byRow.get(cell.rowIndex)?.set(cell.colId, cell.value);
  });

  const rowIndexes = Array.from(byRow.keys()).sort((a, b) => a - b);
  const headerLine = columnsForCopy.map((column) => column.header).join('\t');
  const rowLines = rowIndexes.map((rowIndex) => {
    const rowMap = byRow.get(rowIndex);
    return columnsForCopy
      .map((column) => stringifyClipboardValue(rowMap?.get(column.colId)))
      .join('\t');
  });

  return [headerLine, ...rowLines].join('\n');
};

export const writeTextToClipboard = async (text: string): Promise<boolean> => {
  if (!text) return false;

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      // fallback below
    }
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.select();
    const isCopied = document.execCommand('copy');
    document.body.removeChild(textArea);
    return isCopied;
  } catch (_) {
    return false;
  }
};
