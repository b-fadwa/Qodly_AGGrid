import { CSSProperties, FC, useEffect, useMemo, useState } from 'react';
import { GoTrash } from 'react-icons/go';
import type {
  SavedExportFormat,
  SavedFilter,
  SavedPrintFormat,
  SavedSequence,
  SavedSort,
  SavedView,
  SequenceFilterMode,
  SequenceFilterStep,
  SequenceProgrammingPayload,
  SequenceTranspositionOption,
  SequenceTranspositionsValue,
} from './SequenceProgramming.types';
import {
  findSavedRecord,
  recordLabel,
  savedExportFormatKey,
  savedPrintFormatKey,
  savedRecordKey,
} from './SequenceProgramming.types';

type SequenceProgrammingI18n =
  | { keys?: Record<string, Record<string, unknown>> }
  | null
  | undefined;
type AgGridTranslation = (key: string) => string;

const DEFAULT_COLOR_PRIMARY = '#2B5797';
const DEFAULT_COLOR_DANGER = '#EC7B80';
const DEFAULT_COLOR_ACCENT = '#6B8AD4';
const COLOR_PRIMARY_HOVER_DARKEN_PERCENT = 18;
const COLOR_WASH_PERCENT = 20;

// color-mix() resolves any valid CSS color — hex, rgb(a), named, or a var() reference —
// natively in the browser, so it works even when a color prop is itself a theme variable.
function washColor(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

function darkenColor(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${100 - percent}%, black)`;
}

function pickI18nString(
  entry: Record<string, unknown> | undefined,
  lang?: string,
): string | undefined {
  if (!entry) return undefined;
  const localized = lang ? entry[lang] : undefined;
  if (typeof localized === 'string' && localized.trim()) return localized;
  const fallback = entry.default;
  return typeof fallback === 'string' && fallback.trim() ? fallback : undefined;
}

function translateAgGridKey(
  i18n: SequenceProgrammingI18n,
  lang: string | undefined,
  key: string,
): string {
  const formattedKey = key.replace(/\s+/g, '_');
  return pickI18nString(i18n?.keys?.[`aggrid_${formattedKey}`], lang) ?? key;
}

function translateAgGridAlias(
  translation: AgGridTranslation,
  key: string,
  fallback?: string,
): string {
  const translated = translation(key);
  return translated === key && fallback ? fallback : translated;
}

interface SequenceProgrammingPanelProps {
  savedViews: SavedView[];
  savedFilters: SavedFilter[];
  savedSorts: SavedSort[];
  savedSequences: SavedSequence[];
  transpositions: SequenceTranspositionsValue | null;
  exportFormats: SavedExportFormat[];
  printFormats: SavedPrintFormat[];
  predefinedDocuments: SequenceTranspositionOption[];
  chainedSequences: SavedSequence[];
  value: SequenceProgrammingPayload;
  colorPrimary?: string;
  colorDanger?: string;
  colorAccent?: string;
  colorDangerWash?: string;
  disabled?: boolean;
  i18n?: SequenceProgrammingI18n;
  lang?: string;
  style?: CSSProperties;
  className?: string;
  onChange: (value: SequenceProgrammingPayload) => void;
  onSaveSequence: (name: string, value: SequenceProgrammingPayload) => void;
  onUpdateSequence: (key: string, value: SequenceProgrammingPayload) => void;
  onDeleteSequence: (record: SavedSequence) => void;
  onLoadSequence: (record: SavedSequence) => void;
  onApply: (value: SequenceProgrammingPayload) => void;
  onAutomatisationTraitement: () => void;
  onShare: (record: SavedSequence) => void;
  onTranspositionSelect: (option: SequenceTranspositionOption, mode: 'oneToN' | 'nTo1') => void;
  onCancel: () => void;
}

const filterModeOptions: Array<{ value: SequenceFilterMode; label: string }> = [
  { value: 'intersection', label: 'Intersect with previous selection' },
  { value: 'reunion', label: 'Add to previous selection' },
  { value: 'exclusion', label: 'Subtract from previous selection' },
];

const fallbackTranspositions: SequenceTranspositionsValue = {
  oneToN: [],
  nToOne: [],
};

const optionKey = (option: SequenceTranspositionOption): string =>
  String(option.key ?? option.id ?? option.tableId ?? option.link ?? option.name ?? '');

const optionLabel = (option: SequenceTranspositionOption): string =>
  String(option.label ?? option.name ?? option.link ?? option.key ?? option.id ?? '');

const TranspositionTree: FC<{
  options: SequenceTranspositionOption[];
  selectedKey: string;
  expandedKeys: Set<string>;
  toggleExpanded: (key: string) => void;
  onSelect: (option: SequenceTranspositionOption) => void;
  emptyLabel: string;
  primaryColor: string;
  primaryWash: string;
  depth?: number;
}> = ({
  options,
  selectedKey,
  expandedKeys,
  toggleExpanded,
  onSelect,
  emptyLabel,
  primaryColor,
  primaryWash,
  depth = 0,
}) => {
  if (!Array.isArray(options) || options.length === 0) {
    if (depth > 0) return null;
    return (
      <div className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={'space-y-1'}>
      {options.map((option) => {
        const key = optionKey(option);
        const selected = selectedKey === key;
        const hasChildren = Array.isArray(option.children) && option.children.length > 0;
        const expanded = expandedKeys.has(key);
        return (
          <div key={key || optionLabel(option)}>
            <div
              className="flex w-full items-center gap-2 rounded-md px-2 py-0.5 hover:bg-slate-50"
              style={{
                paddingLeft: `${8 + depth * 16}px`,
                background: selected ? primaryWash : undefined,
                color: selected ? primaryColor : '#334155',
                fontSize: '12px',
                fontWeight: selected ? 600 : 500,
              }}
              title={option.link}
            >
              <button
                type="button"
                className="inline-flex items-center justify-center text-slate-400"
                style={{ width: '14px', height: '18px' }}
                disabled={!hasChildren}
                onClick={(event) => {
                  event.stopPropagation();
                  if (hasChildren) toggleExpanded(key);
                }}
                aria-label={expanded ? 'Collapse' : 'Expand'}
              >
                {hasChildren ? (expanded ? '▾' : '▸') : ''}
              </button>
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left"
                onClick={() => onSelect(option)}
              >
                {optionLabel(option)}
              </button>
              {option.link ? (
                <span className="hidden max-w-[180px] truncate text-slate-400 sm:inline">
                  {option.link}
                </span>
              ) : null}
            </div>
            {hasChildren && expanded ? (
              <TranspositionTree
                options={option.children ?? []}
                selectedKey={selectedKey}
                expandedKeys={expandedKeys}
                toggleExpanded={toggleExpanded}
                onSelect={onSelect}
                emptyLabel={emptyLabel}
                primaryColor={primaryColor}
                primaryWash={primaryWash}
                depth={depth + 1}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

const SequenceProgrammingPanel: FC<SequenceProgrammingPanelProps> = ({
  savedViews,
  savedFilters,
  savedSorts,
  savedSequences,
  transpositions,
  exportFormats,
  printFormats,
  predefinedDocuments,
  chainedSequences,
  value,
  colorPrimary,
  colorDanger,
  colorAccent,
  colorDangerWash,
  disabled = false,
  i18n,
  lang,
  style,
  className,
  onChange,
  onSaveSequence,
  onUpdateSequence,
  onDeleteSequence,
  onLoadSequence,
  onApply,
  onAutomatisationTraitement,
  onShare,
  onTranspositionSelect,
  onCancel,
}) => {
  const [sequenceName, setSequenceName] = useState('');
  const [selectedSequenceKey, setSelectedSequenceKey] = useState('');
  const [expandedTranspositionKeys, setExpandedTranspositionKeys] = useState<Set<string>>(
    () => new Set(),
  );

  /**
   * Once the caller's `savedSequences` round-trips back (e.g. the backend assigns a
   * real `id` to a just-created record), re-resolve the current selection to that
   * record's canonical key so the `<select>` stays visually selected.
   */
  useEffect(() => {
    if (!selectedSequenceKey) return;
    const match = findSavedRecord(savedSequences, selectedSequenceKey);
    if (!match) return;
    const canonicalKey = savedRecordKey(match);
    if (canonicalKey && canonicalKey !== selectedSequenceKey) {
      setSelectedSequenceKey(canonicalKey);
    }
  }, [savedSequences, selectedSequenceKey]);

  const t = (key: string) => translateAgGridKey(i18n, lang, key);
  const translation = (key: string) => translateAgGridAlias(t, key, key);

  const colors = useMemo(() => {
    const primary = colorPrimary || DEFAULT_COLOR_PRIMARY;
    const danger = colorDanger || DEFAULT_COLOR_DANGER;
    const accent = colorAccent || DEFAULT_COLOR_ACCENT;
    return {
      primary,
      primaryHover: darkenColor(primary, COLOR_PRIMARY_HOVER_DARKEN_PERCENT),
      accent,
      accentWash: washColor(accent, COLOR_WASH_PERCENT),
      danger,
      dangerWash: colorDangerWash || washColor(danger, COLOR_WASH_PERCENT),
      info: primary,
    };
  }, [colorPrimary, colorDanger, colorAccent, colorDangerWash]);

  const normalizedFilters = useMemo(
    () =>
      value.filters.length > 0
        ? value.filters
        : ([{ filterId: '', mode: 'intersection' }] as SequenceFilterStep[]),
    [value.filters],
  );

  const currentTranspositionTree =
    value.transposition.mode === 'oneToN'
      ? ((transpositions ?? fallbackTranspositions).oneToN ?? [])
      : value.transposition.mode === 'nTo1'
        ? ((transpositions ?? fallbackTranspositions).nToOne ?? [])
        : [];
  const selectedOperation =
    value.transposition.mode === 'nTo1' || value.transposition.mode === 'oneToN'
      ? value.transposition.mode
      : (value.output.mode ?? '');
  const needsExportFormat = selectedOperation === 'export';
  const needsPrintFormat = selectedOperation === 'list' || selectedOperation === 'table';
  const needsPredefinedDocument = selectedOperation === 'predefinedDocuments';
  const isOutputOperation = needsExportFormat || needsPrintFormat || needsPredefinedDocument;
  const isTranspositionOperation = selectedOperation === 'nTo1' || selectedOperation === 'oneToN';
  const chainedSequenceMode = isTranspositionOperation
    ? findSavedRecord(chainedSequences, value.transposition.chainedSequenceId ?? '')?.sequence
        ?.output?.mode
    : undefined;
  const canAutomatisationTraitement =
    Boolean(selectedSequenceKey) &&
    (isOutputOperation ||
      (isTranspositionOperation &&
        (chainedSequenceMode === 'export' ||
          chainedSequenceMode === 'list' ||
          chainedSequenceMode === 'table' ||
          chainedSequenceMode === 'predefinedDocuments')));

  const resolveSortIdForFilter = (filterId: string | number): string => {
    const filterRecord = findSavedRecord(savedFilters, filterId);
    const linkedSort = filterRecord?.linkedSortId ?? filterRecord?.linkedSort;
    if (linkedSort == null || String(linkedSort).trim() === '') return '';
    const sortRecord = findSavedRecord(savedSorts, linkedSort);
    return sortRecord ? savedRecordKey(sortRecord) : String(linkedSort).trim();
  };

  const setFilterAt = (index: number, patch: Partial<SequenceFilterStep>) => {
    onChange({
      ...value,
      filters: normalizedFilters.map((step, i) => (i === index ? { ...step, ...patch } : step)),
    });
  };

  /** Initial search filter (index 0) drives Sort — re-derive `sortId` from its linked sort on every change. */
  const setInitialSearchFilter = (filterId: string) => {
    onChange({
      ...value,
      sortId: resolveSortIdForFilter(filterId),
      filters: normalizedFilters.map((step, i) => (i === 0 ? { ...step, filterId } : step)),
    });
  };

  const handleViewSelect = (viewId: string) => {
    const viewRecord = findSavedRecord(savedViews, viewId);
    const linkedFilter = viewRecord?.linkedFilterId ?? viewRecord?.linkedFilter;
    if (linkedFilter == null || String(linkedFilter).trim() === '') {
      onChange({ ...value, viewId });
      return;
    }
    const filterRecord = findSavedRecord(savedFilters, linkedFilter);
    const filterKey = filterRecord ? savedRecordKey(filterRecord) : String(linkedFilter).trim();
    onChange({
      ...value,
      viewId,
      sortId: resolveSortIdForFilter(filterKey),
      filters: normalizedFilters.map((step, i) =>
        i === 0 ? { ...step, filterId: filterKey } : step,
      ),
    });
  };

  const addFilter = () => {
    onChange({
      ...value,
      filters: [...normalizedFilters, { filterId: '', mode: 'intersection' }],
    });
  };

  const removeFilter = (index: number) => {
    onChange({
      ...value,
      filters: normalizedFilters.filter((_, i) => i !== index),
    });
  };

  const handleSequenceSelect = (key: string) => {
    setSelectedSequenceKey(key);
    if (!key) {
      setSequenceName('');
      return;
    }
    const record = findSavedRecord(savedSequences, key);
    if (!record) return;
    setSequenceName(recordLabel(record));
    onLoadSequence(record);
  };

  const sequenceToPersist = (): SequenceProgrammingPayload => {
    const filters = normalizedFilters.filter((step) => String(step.filterId ?? '').trim() !== '');
    if (value.transposition.mode === 'nTo1' || value.transposition.mode === 'oneToN') {
      return { ...value, filters };
    }
    const mode = value.output.mode;
    if (mode === 'display') {
      return { ...value, filters, output: { mode: 'display' } };
    }
    if (mode === 'export') {
      return {
        ...value,
        filters,
        output: {
          mode: 'export',
          exportFormatId: value.output.exportFormatId ?? '',
        },
      };
    }
    if (mode === 'list' || mode === 'table') {
      return {
        ...value,
        filters,
        output: {
          mode,
          printFormatId: value.output.printFormatId ?? '',
        },
      };
    }
    if (mode === 'predefinedDocuments') {
      return {
        ...value,
        filters,
        output: {
          mode,
          referenceDocumentId: value.output.referenceDocumentId ?? '',
        },
      };
    }
    return { ...value, filters };
  };

  const trimmedName = sequenceName.trim();
  const matchingExisting = trimmedName
    ? savedSequences.find((record) => record.name === trimmedName || record.title === trimmedName)
    : null;
  const willUpdateExisting = Boolean(matchingExisting) || (!trimmedName && !!selectedSequenceKey);
  const saveButtonDisabled = !trimmedName && !selectedSequenceKey;

  const handleSavePressed = () => {
    if (saveButtonDisabled) return;
    const payload = sequenceToPersist();
    if (trimmedName) {
      if (matchingExisting) {
        const key = savedRecordKey(matchingExisting);
        onUpdateSequence(key, payload);
        setSelectedSequenceKey(key);
      } else {
        onSaveSequence(trimmedName, payload);
        // Optimistic key — the reconciliation effect above will correct it to the
        // backend-assigned id once the updated collection round-trips back.
        setSelectedSequenceKey(trimmedName);
      }
    } else if (selectedSequenceKey) {
      onUpdateSequence(selectedSequenceKey, payload);
    }
    setSequenceName('');
  };

  const handleDeletePressed = () => {
    const record = findSavedRecord(savedSequences, selectedSequenceKey);
    if (!record) return;
    onDeleteSequence(record);
    setSelectedSequenceKey('');
    setSequenceName('');
  };

  const handleSharePressed = () => {
    const record = findSavedRecord(savedSequences, selectedSequenceKey);
    if (!record) return;
    onShare(record);
  };

  const selectTranspositionTreeOption = (option: SequenceTranspositionOption) => {
    const key = optionKey(option);
    onChange({
      ...value,
      transposition: {
        ...value.transposition,
        selectionKey: key,
        selectionId: option.id ?? option.tableId ?? option.targetId ?? key,
        selectionLabel: optionLabel(option),
        selectionLink: option.link ?? '',
      },
    });
    if (value.transposition.mode === 'oneToN' || value.transposition.mode === 'nTo1') {
      onTranspositionSelect(option, value.transposition.mode);
    }
  };

  const renderPredefinedDocumentOptions = (currentValue: string) => {
    const hasCurrentValue = predefinedDocuments.some(
      (option) => optionKey(option) === currentValue,
    );
    return (
      <>
        <option value="">{translation('Select predefined document')}</option>
        {predefinedDocuments.map((option) => {
          const key = optionKey(option);
          return (
            <option key={key || optionLabel(option)} value={key}>
              {optionLabel(option)}
            </option>
          );
        })}
        {currentValue && !hasCurrentValue ? (
          <option value={currentValue}>{currentValue}</option>
        ) : null}
      </>
    );
  };

  const setSequenceOperation = (operation: string) => {
    setExpandedTranspositionKeys(new Set());
    if (operation === 'nTo1' || operation === 'oneToN') {
      onChange({
        ...value,
        output: { ...value.output, mode: undefined },
        transposition: {
          ...value.transposition,
          mode: operation as SequenceProgrammingPayload['transposition']['mode'],
          selectionId: '',
          selectionKey: '',
          selectionLabel: '',
          selectionLink: '',
        },
      });
      return;
    }
    onChange({
      ...value,
      output: {
        ...value.output,
        mode: operation as SequenceProgrammingPayload['output']['mode'],
      },
      transposition: {
        ...value.transposition,
        mode: 'none',
        selectionId: '',
        selectionKey: '',
        selectionLabel: '',
        selectionLink: '',
      },
    });
  };

  const toggleTranspositionExpanded = (key: string) => {
    setExpandedTranspositionKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const controlStyle = {
    height: '31px',
    borderRadius: '6px',
    borderColor: '#0000001A',
    color: '#44444C',
    fontSize: '12px',
    fontWeight: 500,
  } as const;
  const selectClass = 'rounded-lg border border-gray-300 bg-white px-2 py-1';
  const labelClass = 'text-sm font-medium text-slate-700';

  return (
    <section
      className={`flex h-full min-h-full w-full flex-col overflow-hidden bg-white ${className || ''}`}
      style={style}
      aria-disabled={disabled}
    >
      <fieldset disabled={disabled} className="contents">
        <div className="min-h-0 flex-1 bg-slate-100 overflow-y-auto p-2 sm:p-3">
          <div className="rounded-md border border-slate-200 bg-white p-2 shadow-sm sm:p-3">
            <div className="rounded border border-slate-200 bg-slate-50 p-3">
              <label className={labelClass} style={{ fontSize: '12px' }}>
                {translation('View')}
              </label>
              <select
                className={`${selectClass} mt-2 w-full`}
                style={controlStyle}
                value={String(value.viewId ?? '')}
                onChange={(e) => handleViewSelect(e.target.value)}
              >
                <option value="">{translation('Select view')}</option>
                {savedViews.map((record) => (
                  <option key={savedRecordKey(record)} value={savedRecordKey(record)}>
                    {recordLabel(record)}
                  </option>
                ))}
              </select>
            </div>

            <div className="py-3">
              <div className="mb-2 px-2 flex items-center justify-between gap-2">
                <span style={{ color: '#334155', fontSize: '12px', fontWeight: 700 }}>
                  {translation('Searches')}
                </span>
                <button
                  type="button"
                  className="rounded-md border bg-white px-3 py-2"
                  style={controlStyle}
                  onClick={addFilter}
                >
                  {translation('Add search')}
                </button>
              </div>
              <div className="space-y-2">
                {normalizedFilters.map((step, index) => (
                  <div
                    key={`${index}-${String(step.filterId ?? '')}`}
                    className="rounded-md border border-slate-200 bg-slate-50 p-2"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span style={{ color: '#334155', fontSize: '12px', fontWeight: 600 }}>
                        {index === 0
                          ? translation('Initial search')
                          : `${translation('Search')} ${index + 1}`}
                      </span>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-md border disabled:cursor-not-allowed disabled:opacity-40"
                        style={{
                          width: '31px',
                          height: '31px',
                          borderRadius: '8px',
                          color: colors.danger,
                          borderColor: colors.danger,
                          backgroundColor: washColor(colors.danger, 10),
                        }}
                        onClick={() => removeFilter(index)}
                        disabled={normalizedFilters.length === 1}
                        title={translation('Remove')}
                      >
                        <GoTrash size={13} />
                      </button>
                    </div>
                    <div
                      className="grid gap-2"
                      style={{
                        gridTemplateColumns: index > 0 ? 'repeat(2, minmax(0, 1fr))' : '1fr',
                      }}
                    >
                      <label className="block text-slate-700" style={{ fontSize: '12px' }}>
                        <select
                          className={`${selectClass} w-full`}
                          style={controlStyle}
                          value={String(step.filterId ?? '')}
                          onChange={(e) =>
                            index === 0
                              ? setInitialSearchFilter(e.target.value)
                              : setFilterAt(index, { filterId: e.target.value })
                          }
                        >
                          <option value="">{translation('Select filter')}</option>
                          {savedFilters.map((record) => (
                            <option key={savedRecordKey(record)} value={savedRecordKey(record)}>
                              {recordLabel(record)}
                            </option>
                          ))}
                        </select>
                      </label>
                      {index > 0 && (
                        <label className="block text-slate-700" style={{ fontSize: '12px' }}>
                          <select
                            className={`${selectClass} w-full`}
                            style={controlStyle}
                            value={step.mode ?? 'intersection'}
                            onChange={(e) =>
                              setFilterAt(index, { mode: e.target.value as SequenceFilterMode })
                            }
                          >
                            {filterModeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {translation(option.label)}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3 py-3">
              <section className="rounded border border-slate-200 bg-slate-50 p-3">
                <span
                  className="mb-3 block text-slate-800"
                  style={{ fontSize: '12px', fontWeight: 700 }}
                >
                  {translation('Sequence action')}
                </span>
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
                >
                  {[
                    ['display', 'List display'],
                    ['export', 'Data export'],
                    ['list', 'List representation'],
                    ['table', 'Table representation'],
                    ['predefinedDocuments', 'Documents prédifinis'],
                    ['nTo1', 'Selection transposition: N to 1'],
                    ['oneToN', 'Selection transposition: 1 to N'],
                  ].map(([option, label]) => (
                    <label
                      key={option}
                      className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-2 text-slate-700"
                      style={{
                        fontSize: '12px',
                        borderColor: selectedOperation === option ? colors.primary : undefined,
                        color: selectedOperation === option ? colors.primary : undefined,
                      }}
                    >
                      <input
                        type="radio"
                        name="sequence-operation"
                        checked={selectedOperation === option}
                        onChange={() => setSequenceOperation(option)}
                      />
                      {translation(label)}
                    </label>
                  ))}
                </div>
              </section>

              {isOutputOperation && (
                <section className="rounded border border-slate-200 bg-slate-50 p-3">
                  <span
                    className="mb-3 block text-slate-800"
                    style={{ fontSize: '12px', fontWeight: 700 }}
                  >
                    {translation('Output options')}
                  </span>
                  {needsExportFormat ? (
                    <label className="block text-slate-700" style={{ fontSize: '12px' }}>
                      {translation('Export format')}
                      <select
                        className={`${selectClass} mt-1 w-full`}
                        style={controlStyle}
                        value={String(value.output.exportFormatId ?? '')}
                        onChange={(e) =>
                          onChange({
                            ...value,
                            output: { ...value.output, exportFormatId: e.target.value },
                          })
                        }
                      >
                        <option value="">{translation('Select export format')}</option>
                        {exportFormats.map((record) => (
                          <option
                            key={savedExportFormatKey(record)}
                            value={savedExportFormatKey(record)}
                          >
                            {recordLabel(record)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {needsPrintFormat ? (
                    <label className="block text-slate-700" style={{ fontSize: '12px' }}>
                      {translation('Print format')}
                      <select
                        className={`${selectClass} mt-1 w-full`}
                        style={controlStyle}
                        value={String(value.output.printFormatId ?? '')}
                        onChange={(e) =>
                          onChange({
                            ...value,
                            output: { ...value.output, printFormatId: e.target.value },
                          })
                        }
                      >
                        <option value="">{translation('Select print format')}</option>
                        {printFormats.map((record) => (
                          <option
                            key={savedPrintFormatKey(record)}
                            value={savedPrintFormatKey(record)}
                          >
                            {recordLabel(record)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {needsPredefinedDocument ? (
                    <label className="block text-slate-700" style={{ fontSize: '12px' }}>
                      {translation('Predefined documents')}
                      <select
                        className={`${selectClass} mt-1 w-full`}
                        style={controlStyle}
                        value={String(value.output.referenceDocumentId ?? '')}
                        onChange={(e) =>
                          onChange({
                            ...value,
                            output: { ...value.output, referenceDocumentId: e.target.value },
                          })
                        }
                      >
                        {renderPredefinedDocumentOptions(
                          String(value.output.referenceDocumentId ?? ''),
                        )}
                      </select>
                    </label>
                  ) : null}
                </section>
              )}

              {isTranspositionOperation && (
                <section className="rounded border border-slate-200 bg-slate-50 p-3">
                  <span
                    className="mb-3 block text-slate-800"
                    style={{ fontSize: '12px', fontWeight: 700 }}
                  >
                    {translation('Transposition options')}
                  </span>
                  <div>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span
                        className="text-slate-700"
                        style={{ fontSize: '12px', fontWeight: 600 }}
                      >
                        {translation('Transposition selection')}
                      </span>
                      {value.transposition.selectionLabel ? (
                        <span className="truncate text-slate-500" style={{ fontSize: '11px' }}>
                          {value.transposition.selectionLabel}
                        </span>
                      ) : null}
                    </div>
                    <div
                      className="max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white p-1"
                      style={{ minHeight: '88px' }}
                    >
                      <TranspositionTree
                        options={currentTranspositionTree}
                        selectedKey={String(value.transposition.selectionKey ?? '')}
                        expandedKeys={expandedTranspositionKeys}
                        toggleExpanded={toggleTranspositionExpanded}
                        onSelect={selectTranspositionTreeOption}
                        emptyLabel={
                          value.transposition.mode === 'none'
                            ? translation('Choose a transposition type')
                            : translation('No transposition available')
                        }
                        primaryColor={colors.primary}
                        primaryWash={washColor(colors.primary, 10)}
                      />
                    </div>
                  </div>
                  <label className="block text-slate-700" style={{ fontSize: '12px' }}>
                    {translation('Chained sequence')}
                    <select
                      className={`${selectClass} mt-1 w-full`}
                      style={controlStyle}
                      value={String(value.transposition.chainedSequenceId ?? '')}
                      onChange={(e) =>
                        onChange({
                          ...value,
                          transposition: {
                            ...value.transposition,
                            chainedSequenceId: e.target.value,
                          },
                        })
                      }
                    >
                      <option value="">{translation('No sequence')}</option>
                      {chainedSequences.map((record) => (
                        <option key={savedRecordKey(record)} value={savedRecordKey(record)}>
                          {recordLabel(record)}
                        </option>
                      ))}
                    </select>
                  </label>
                </section>
              )}
            </div>

            <section className="flex flex-col gap-3 px-2 py-3">
              <span style={{ color: '#717182', fontWeight: 500, fontSize: '11px' }}>
                {translation('Saved sequence programming')}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className="rounded-lg border border-gray-300 px-2 py-1"
                  style={controlStyle}
                  placeholder={translation('Sequence programming name')}
                  value={sequenceName}
                  onChange={(e) => setSequenceName(e.target.value)}
                />
                <select
                  className={selectClass}
                  style={controlStyle}
                  value={selectedSequenceKey}
                  onChange={(e) => handleSequenceSelect(e.target.value)}
                >
                  <option value="">{translation('Select Sequence programming')}</option>
                  {savedSequences.map((record) => (
                    <option key={savedRecordKey(record)} value={savedRecordKey(record)}>
                      {recordLabel(record)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg border"
                  style={{
                    width: '31px',
                    height: '31px',
                    borderRadius: '8px',
                    color: colors.danger,
                    borderColor: colors.danger,
                    backgroundColor: colors.dangerWash,
                  }}
                  onClick={handleDeletePressed}
                  disabled={!selectedSequenceKey}
                  title={translation('Delete')}
                >
                  <GoTrash size={14} />
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                  style={controlStyle}
                  disabled={saveButtonDisabled}
                  onClick={handleSavePressed}
                >
                  {willUpdateExisting ? translation('Update') : translation('Save')}
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-gray-300 bg-white px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                  style={controlStyle}
                  disabled={!selectedSequenceKey}
                  onClick={handleSharePressed}
                >
                  {translation('Share')}
                </button>
                {canAutomatisationTraitement ? (
                  <button
                    type="button"
                    className="rounded-lg border border-gray-300 bg-white px-2 py-1"
                    style={controlStyle}
                    onClick={onAutomatisationTraitement}
                  >
                    {translation('Automatisation traitement')}
                  </button>
                ) : null}
              </div>
            </section>
          </div>
        </div>

        <div
          className="flex w-full shrink-0 items-center justify-end gap-2 p-4"
          style={{ borderTop: '1px solid #E2E8F0' }}
        >
          <button
            type="button"
            className="flex items-center justify-center rounded-md border px-3 py-2"
            style={{
              height: '31px',
              borderRadius: '6px',
              borderColor: colors.danger,
              color: colors.danger,
              fontSize: '12px',
            }}
            onClick={onCancel}
          >
            {translation('Cancel')}
          </button>
          <button
            type="button"
            className="flex items-center justify-center rounded-md border px-3 py-2 text-center text-sm text-white"
            style={{ background: colors.primary, height: '31px', fontSize: '12px' }}
            onClick={() => onApply(sequenceToPersist())}
          >
            {translation('Apply')}
          </button>
        </div>
      </fieldset>
    </section>
  );
};

export default SequenceProgrammingPanel;
