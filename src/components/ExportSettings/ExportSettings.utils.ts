import { extractPrintColumns } from '../PrintSettings/PrintSettings.utils';
import { resolveSimpleColumnTitle } from '../SimpleAgGrid/simpleAgGridColumns';
import type { ExportResolvedColumnState, ExportSettingsColumn } from './ExportSettings.types';
import {
  ExportExtension,
  ExportFormatValue,
  exportColumnId,
} from './ExportSettings.types';

export { extractPrintColumns as extractExportColumns };

const EXPORT_EXTENSIONS: ExportExtension[] = ['CSV', 'TXT', 'XML'];

type ExportSettingsI18n = { keys?: Record<string, Record<string, unknown>> } | null | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function resolveExportColumnState(
  columns: ExportSettingsColumn[],
  value: ExportFormatValue,
  i18n?: ExportSettingsI18n,
  lang?: string,
): ExportResolvedColumnState[] {
  const columnById = new Map<string, ExportSettingsColumn>();
  columns.forEach((column, index) => {
    columnById.set(exportColumnId(column, index), column);
  });

  return value.columnState
    .map((state) => {
      const column = columnById.get(state.colId);
      if (!column) return null;
      const index = columns.indexOf(column);
      const id = exportColumnId(column, index >= 0 ? index : 0);
      const title =
        resolveSimpleColumnTitle(column.title, i18n, lang) ||
        column.source ||
        id;
      return {
        id,
        source: column.source || id,
        title,
        dataType: column.dataType ?? 'string',
        format: column.format ?? '',
        hidden: state.hidden,
      };
    })
    .filter((item): item is ExportResolvedColumnState => Boolean(item));
}

export function buildExportEventPayload(
  columns: ExportSettingsColumn[],
  value: ExportFormatValue,
  i18n?: ExportSettingsI18n,
  lang?: string,
): ExportFormatValue & { columnState: ExportResolvedColumnState[] } {
  return {
    ...value,
    columnState: resolveExportColumnState(columns, value, i18n, lang),
  };
}

export function normalizeExportFormat(
  candidate: unknown,
  columns: ExportSettingsColumn[],
): ExportFormatValue {
  const raw: Record<string, unknown> = isRecord(candidate) ? candidate : {};
  const configuredIds = columns.map(exportColumnId);
  const configuredSet = new Set(configuredIds);
  const incomingState = Array.isArray(raw.columnState) ? raw.columnState : [];
  const seen = new Set<string>();
  const columnState = incomingState
    .map((item) => {
      const record = isRecord(item) ? item : {};
      return { colId: String(record.colId ?? ''), hidden: Boolean(record.hidden) };
    })
    .filter((item) => {
      if (!item.colId || !configuredSet.has(item.colId) || seen.has(item.colId)) return false;
      seen.add(item.colId);
      return true;
    });
  configuredIds.forEach((colId) => {
    if (!seen.has(colId)) {
      const column = columns[configuredIds.indexOf(colId)];
      columnState.push({ colId, hidden: Boolean(column?.hidden) });
    }
  });

  const extension = String(raw.exportExtension ?? '').toUpperCase();
  const exportExtension = EXPORT_EXTENSIONS.includes(extension as ExportExtension)
    ? (extension as ExportExtension)
    : 'TXT';

  return {
    columnState,
    exportHeaderNames: raw.exportHeaderNames !== false,
    exportUppercase: Boolean(raw.exportUppercase),
    exportExtension,
  };
}
