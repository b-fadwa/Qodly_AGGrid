export type PrintRepresentation = 'list' | 'table';

export interface PrintSettingsColumn {
  id: string;
  title: unknown;
  source: string;
  dataType?: string;
  format?: string;
  hidden?: boolean;
}

export interface PrintColumnState {
  colId: string;
  hidden: boolean;
}

export type SubtotalFunction =
  | 'sum'
  | 'average'
  | 'min'
  | 'max'
  | 'count'
  | 'product'
  | 'standardDeviation'
  | 'standardDeviationPopulation'
  | 'variance'
  | 'variancePopulation';

export interface PrintSubtotalRule {
  id: string;
  breakColumn: string;
  function: SubtotalFunction;
  targetColumns: string[];
}

export interface PrintFormatValue {
  representation: PrintRepresentation;
  columnState: PrintColumnState[];
  dateFormats: Record<string, string>;
  subtotals: PrintSubtotalRule[];
}

export interface SavedPrintFormat {
  name: string;
  title?: string;
  id?: string | number;
  isDefault?: boolean;
  format: PrintFormatValue;
}

export const DEFAULT_PRINT_FORMAT: PrintFormatValue = {
  representation: 'list',
  columnState: [],
  dateFormats: {},
  subtotals: [],
};

export function printColumnId(column: PrintSettingsColumn, index: number): string {
  const source = typeof column.source === 'string' ? column.source.trim() : '';
  return source || column.id || `column-${index}`;
}

export function savedPrintFormatKey(record: SavedPrintFormat): string {
  return String(record.id ?? record.name ?? record.title ?? '');
}
