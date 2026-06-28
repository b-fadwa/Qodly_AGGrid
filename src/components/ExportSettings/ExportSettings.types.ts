export interface ExportSettingsColumn {
  id: string;
  title: unknown;
  source: string;
  dataType?: string;
  format?: string;
  hidden?: boolean;
}

export interface ExportColumnState {
  colId: string;
  hidden: boolean;
}

export interface ExportResolvedColumnState {
  id: string;
  source: string;
  title: string;
  dataType: string;
  format: string;
  hidden: boolean;
}

export type ExportExtension = 'CSV' | 'TXT' | 'XML';

export interface ExportFormatValue {
  columnState: ExportColumnState[];
  exportHeaderNames: boolean;
  exportUppercase: boolean;
  exportExtension: ExportExtension;
}

export interface SavedExportFormat {
  name: string;
  title?: string;
  id?: string | number;
  isDefault?: boolean;
  format: ExportFormatValue;
}

export const DEFAULT_EXPORT_FORMAT: ExportFormatValue = {
  columnState: [],
  exportHeaderNames: true,
  exportUppercase: false,
  exportExtension: 'TXT',
};

export function exportColumnId(column: ExportSettingsColumn, index: number): string {
  const source = typeof column.source === 'string' ? column.source.trim() : '';
  return source || column.id || `column-${index}`;
}

export function savedExportFormatKey(record: SavedExportFormat): string {
  return String(record.id ?? record.name ?? record.title ?? '');
}
