import type { SavedExportFormat } from '../ExportSettings/ExportSettings.types';
import { savedExportFormatKey } from '../ExportSettings/ExportSettings.types';
import type { SavedPrintFormat } from '../PrintSettings/PrintSettings.types';
import { savedPrintFormatKey } from '../PrintSettings/PrintSettings.types';

export type { SavedExportFormat, SavedPrintFormat };
export { savedExportFormatKey, savedPrintFormatKey };

/**
 * Shared identity for every "saved" record (view / filter / sort / sequence).
 * `name` is required (used as the lookup key in the UI); `id` / `title` are
 * optional mirrors for backend compatibility (4D server responses typically
 * carry `id` and sometimes `title` instead of `name`).
 */
export interface SavedRecordBase {
  name: string;
  title?: string;
  id?: string | number;
  isDefault?: boolean;
}

export interface SavedView extends SavedRecordBase {
  /** Id of a saved filter record associated with this view. `linkedFilterId` (preferred) wins over `linkedFilter`. */
  linkedFilterId?: string | number;
  linkedFilter?: string | number;
}
export interface SavedFilter extends SavedRecordBase {
  /** Id of a saved sort record applied automatically when this filter loads. `linkedSortId` (preferred) wins over `linkedSort`. */
  linkedSortId?: string | number;
  linkedSort?: string | number;
}
export interface SavedSort extends SavedRecordBase {}

export type SequenceFilterMode = 'intersection' | 'reunion' | 'exclusion';

export interface SequenceFilterStep {
  filterId: string | number;
  mode?: SequenceFilterMode;
}

export interface SequenceProgrammingPayload {
  viewId?: string | number;
  filters: SequenceFilterStep[];
  sortId?: string | number;
  output: {
    mode?: 'display' | 'export' | 'list' | 'table' | 'predefinedDocuments';
    /** Selected `SavedExportFormat` key — option 2 (Export). */
    exportFormatId?: string | number;
    /** Selected `SavedPrintFormat` key — options 3 & 4 (List / Table representation), shared. */
    printFormatId?: string | number;
    /** Selected predefined-document key — option 5. */
    referenceDocumentId?: string | number;
  };
  transposition: {
    mode?: 'none' | 'nTo1' | 'oneToN';
    selectionId?: string | number;
    selectionKey?: string | number;
    selectionLabel?: string;
    selectionLink?: string;
    chainedSequenceId?: string | number;
    runSearchesOnResultSelection?: boolean;
    predefinedDocumentId?: string | number;
  };
}

export interface SavedSequence extends SavedRecordBase {
  sequence: SequenceProgrammingPayload;
}

export type SequenceTranspositionOption = {
  key?: string;
  id?: string | number;
  tableId?: string | number;
  targetId?: string | number;
  name?: string;
  label?: string;
  link?: string;
  children?: SequenceTranspositionOption[];
  [key: string]: unknown;
};

export type SequenceTranspositionsValue = {
  oneToN?: SequenceTranspositionOption[];
  nToOne?: SequenceTranspositionOption[];
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Stable UI/link key for a saved record. Backend ids win; names remain the fallback. */
export function savedRecordKey(item: SavedRecordBase | null | undefined): string {
  if (!item) return '';
  if (item.id != null && item.id !== '') return String(item.id);
  if (typeof item.name === 'string' && item.name.trim()) return item.name.trim();
  if (typeof item.title === 'string' && item.title.trim()) return item.title.trim();
  return '';
}

/**
 * Normalize rows from a saved-list datasource: accepts `{ name }` | `{ title }` | `{ id }`
 * and mirrors each onto `name`.
 */
export function normalizeSavedRecord<T extends SavedRecordBase>(raw: unknown): T | null {
  if (!isObjectRecord(raw)) return null;
  const nameFromName = typeof raw.name === 'string' ? raw.name.trim() : '';
  const nameFromTitle = typeof raw.title === 'string' ? raw.title.trim() : '';
  const nameFromId = raw.id != null && raw.id !== '' ? String(raw.id) : '';
  const name = nameFromName || nameFromTitle || nameFromId;
  if (!name) return null;
  return { ...raw, name } as T;
}

export function savedRecordsFromDatasourceValue<T extends SavedRecordBase>(value: unknown): T[] {
  const records = Array.isArray(value)
    ? value
    : isObjectRecord(value) && Array.isArray(value.result)
      ? value.result
      : [];
  return records
    .map((item) => normalizeSavedRecord<T>(item))
    .filter((item): item is T => item != null);
}

/** Lookup helper used by every "load by name" flow. */
export function findSavedRecord<T extends SavedRecordBase>(
  list: T[],
  key: string | number,
): T | undefined {
  const selectedKey = String(key ?? '').trim();
  if (!selectedKey) return undefined;
  return list.find(
    (item) =>
      item.name === selectedKey ||
      item.title === selectedKey ||
      savedRecordKey(item) === selectedKey ||
      (item.id != null && String(item.id) === selectedKey),
  );
}

export function sequenceRecordMatches(record: unknown, key: string | number): boolean {
  const selectedKey = String(key ?? '').trim();
  if (!selectedKey || !isObjectRecord(record)) return false;
  return (
    record.name === selectedKey ||
    record.title === selectedKey ||
    (record.id != null && String(record.id) === selectedKey)
  );
}

const sequenceIdValue = (value: unknown): string | number | undefined =>
  typeof value === 'string' || typeof value === 'number' ? value : undefined;

/** Best-effort extraction of a `SequenceProgrammingPayload` from a raw datasource record. */
export function sequencePayloadFromRecord(record: unknown): SequenceProgrammingPayload | null {
  if (!isObjectRecord(record)) return null;
  if (record.sequence && typeof record.sequence === 'object') {
    return record.sequence as SequenceProgrammingPayload;
  }
  if ('viewId' in record || 'filters' in record || 'sortId' in record || 'output' in record) {
    const output = isObjectRecord(record.output) ? record.output : {};
    const transposition = isObjectRecord(record.transposition) ? record.transposition : {};
    return {
      viewId: sequenceIdValue(record.viewId) ?? sequenceIdValue(record.linkedViewId) ?? '',
      filters: Array.isArray(record.filters)
        ? (record.filters as SequenceProgrammingPayload['filters'])
        : [],
      sortId: sequenceIdValue(record.sortId) ?? sequenceIdValue(record.linkedSortId) ?? '',
      output: {
        mode: output.mode as SequenceProgrammingPayload['output']['mode'],
        exportFormatId:
          sequenceIdValue(output.exportFormatId) ?? sequenceIdValue(record.exportFormatId) ?? '',
        printFormatId:
          sequenceIdValue(output.printFormatId) ?? sequenceIdValue(record.printFormatId) ?? '',
        referenceDocumentId:
          sequenceIdValue(output.referenceDocumentId) ??
          sequenceIdValue(record.referenceDocumentId) ??
          '',
      },
      transposition: {
        mode: (transposition.mode ??
          record.transpositionMode ??
          'none') as SequenceProgrammingPayload['transposition']['mode'],
        chainedSequenceId:
          sequenceIdValue(transposition.chainedSequenceId) ??
          sequenceIdValue(record.chainedSequenceId) ??
          '',
        runSearchesOnResultSelection: Boolean(
          transposition.runSearchesOnResultSelection ?? record.runSearchesOnResultSelection,
        ),
        predefinedDocumentId:
          sequenceIdValue(transposition.predefinedDocumentId) ??
          sequenceIdValue(record.predefinedDocumentId) ??
          '',
        selectionId:
          sequenceIdValue(transposition.selectionId) ?? sequenceIdValue(record.selectionId) ?? '',
        selectionKey:
          sequenceIdValue(transposition.selectionKey) ?? sequenceIdValue(record.selectionKey) ?? '',
        selectionLabel:
          typeof transposition.selectionLabel === 'string'
            ? transposition.selectionLabel
            : typeof record.selectionLabel === 'string'
              ? record.selectionLabel
              : '',
        selectionLink:
          typeof transposition.selectionLink === 'string'
            ? transposition.selectionLink
            : typeof record.selectionLink === 'string'
              ? record.selectionLink
              : '',
      },
    };
  }
  return null;
}

export const emptySequence = (): SequenceProgrammingPayload => ({
  viewId: '',
  filters: [],
  sortId: '',
  output: {
    mode: undefined,
    exportFormatId: '',
    printFormatId: '',
    referenceDocumentId: '',
  },
  transposition: {
    mode: 'none',
    selectionId: '',
    selectionKey: '',
    selectionLabel: '',
    selectionLink: '',
    chainedSequenceId: '',
    runSearchesOnResultSelection: false,
    predefinedDocumentId: '',
  },
});

export const sequenceFromRecord = (record: SavedSequence | null): SequenceProgrammingPayload =>
  record?.sequence
    ? {
        ...emptySequence(),
        ...record.sequence,
        filters: Array.isArray(record.sequence.filters) ? record.sequence.filters : [],
        output: { ...emptySequence().output, ...(record.sequence.output ?? {}) },
        transposition: {
          ...emptySequence().transposition,
          ...(record.sequence.transposition ?? {}),
        },
      }
    : emptySequence();

export const recordLabel = (record: { name?: string; title?: string; id?: string | number }) =>
  record.name || record.title || String(record.id ?? '');
