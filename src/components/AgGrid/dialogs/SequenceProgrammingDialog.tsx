import { FC, useEffect, useMemo, useState } from 'react';
import { IoMdClose } from 'react-icons/io';
import { GoTrash } from 'react-icons/go';
import { findSavedRecord, savedRecordKey } from '../state/gridState';
import type {
  SavedFilter,
  SavedSequence,
  SavedSort,
  SavedView,
  SequenceFilterMode,
  SequenceFilterStep,
  SequenceProgrammingPayload,
} from '../state/types';
import type { Translation } from '../state/sorts';

interface SequenceProgrammingDialogProps {
  open: boolean;
  onClose: () => void;
  translation: Translation;
  savedViews: SavedView[];
  savedFilters: SavedFilter[];
  savedSorts: SavedSort[];
  savedSequences: SavedSequence[];
  transpositions: SequenceTranspositionsValue | null;
  selectedSequence: SavedSequence | null;
  setSelectedSequence: (record: SavedSequence | null) => void;
  onSave: (name: string, sequence: SequenceProgrammingPayload) => void;
  onUpdate: (key: string, sequence: SequenceProgrammingPayload) => void;
  onDelete: (record: SavedSequence) => void;
  onLoad: (key: string) => void;
  onApply: (sequence: SequenceProgrammingPayload) => void;
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

const emptySequence = (): SequenceProgrammingPayload => ({
  viewId: '',
  filters: [],
  sortId: '',
  output: {
    mode: undefined,
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

const filterModeOptions: Array<{ value: SequenceFilterMode; label: string }> = [
  { value: 'intersection', label: 'Intersect with previous selection' },
  { value: 'reunion', label: 'Add to previous selection' },
  { value: 'exclusion', label: 'Subtract from previous selection' },
];

const sequenceFromRecord = (record: SavedSequence | null): SequenceProgrammingPayload =>
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

const recordLabel = (record: { name?: string; title?: string; id?: string | number }) =>
  record.name || record.title || String(record.id ?? '');

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
  depth?: number;
}> = ({ options, selectedKey, expandedKeys, toggleExpanded, onSelect, emptyLabel, depth = 0 }) => {
  if (!Array.isArray(options) || options.length === 0) {
    if (depth > 0) return null;
    return (
      <div className="rounded-md border border-dashed border-slate-200 px-3 py-4 text-center text-slate-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={depth === 0 ? 'space-y-1' : 'mt-1 space-y-1'}>
      {options.map((option) => {
        const key = optionKey(option);
        const selected = selectedKey === key;
        const hasChildren = Array.isArray(option.children) && option.children.length > 0;
        const expanded = expandedKeys.has(key);
        return (
          <div key={key || optionLabel(option)}>
            <div
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50"
              style={{
                paddingLeft: `${8 + depth * 16}px`,
                background: selected ? 'rgba(43, 87, 151, 0.10)' : undefined,
                color: selected ? '#2B5797' : '#334155',
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
                depth={depth + 1}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

export const SequenceProgrammingDialog: FC<SequenceProgrammingDialogProps> = ({
  open,
  onClose,
  translation,
  savedViews,
  savedFilters,
  savedSorts,
  savedSequences,
  transpositions,
  selectedSequence,
  setSelectedSequence,
  onSave,
  onUpdate,
  onDelete,
  onLoad,
  onApply,
}) => {
  const [sequenceName, setSequenceName] = useState('');
  const [selectedSequenceKey, setSelectedSequenceKey] = useState('');
  const [draft, setDraft] = useState<SequenceProgrammingPayload>(emptySequence);
  const [expandedTranspositionKeys, setExpandedTranspositionKeys] = useState<Set<string>>(
    () => new Set(),
  );

  const normalizedFilters = useMemo(
    () =>
      draft.filters.length > 0
        ? draft.filters
        : ([{ filterId: '', mode: 'intersection' }] as SequenceFilterStep[]),
    [draft.filters],
  );

  const currentTranspositionTree =
    draft.transposition.mode === 'oneToN'
      ? ((transpositions ?? fallbackTranspositions).oneToN ?? [])
      : draft.transposition.mode === 'nTo1'
        ? ((transpositions ?? fallbackTranspositions).nToOne ?? [])
        : [];

  useEffect(() => {
    if (!open) return;
    setSequenceName('');
    setSelectedSequenceKey(selectedSequence ? savedRecordKey(selectedSequence) : '');
    setDraft(sequenceFromRecord(selectedSequence));
    setExpandedTranspositionKeys(new Set());
  }, [open, selectedSequence]);

  if (!open) return null;

  const setFilterAt = (index: number, patch: Partial<SequenceFilterStep>) => {
    setDraft((prev) => {
      const next = normalizedFilters.map((step, i) => (i === index ? { ...step, ...patch } : step));
      return { ...prev, filters: next };
    });
  };

  const addFilter = () => {
    setDraft((prev) => ({
      ...prev,
      filters: [...normalizedFilters, { filterId: '', mode: 'intersection' }],
    }));
  };

  const removeFilter = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      filters: normalizedFilters.filter((_, i) => i !== index),
    }));
  };

  const handleSequenceSelect = (key: string) => {
    setSelectedSequenceKey(key);
    if (!key) {
      setSelectedSequence(null);
      setDraft(emptySequence());
      setSequenceName('');
      return;
    }
    const record = findSavedRecord(savedSequences, key) as SavedSequence | null;
    setSelectedSequence(record);
    setDraft(sequenceFromRecord(record));
    setSequenceName(recordLabel(record ?? {}));
    onLoad(key);
  };

  const sequenceToPersist = (): SequenceProgrammingPayload => ({
    ...draft,
    filters: normalizedFilters.filter((step) => String(step.filterId ?? '').trim() !== ''),
  });

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
        onUpdate(savedRecordKey(matchingExisting), payload);
      } else {
        onSave(trimmedName, payload);
      }
    } else if (selectedSequenceKey) {
      onUpdate(selectedSequenceKey, payload);
    }
    setSequenceName('');
  };

  const selectTranspositionTreeOption = (option: SequenceTranspositionOption) => {
    const key = optionKey(option);
    setDraft((prev) => ({
      ...prev,
      transposition: {
        ...prev.transposition,
        selectionKey: key,
        selectionId: option.id ?? option.tableId ?? option.targetId ?? key,
        selectionLabel: optionLabel(option),
        selectionLink: option.link ?? '',
      },
    }));
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
        style={{ maxHeight: '92vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 rounded-t-xl border-b border-slate-200 px-5 py-4">
          <div>
            <span
              className="tracking-wide"
              style={{ color: '#0A0A0A', fontSize: '16px', fontWeight: 500 }}
            >
              {translation('Sequence programming')}
            </span>
            <span className="mt-1 block text-sm" style={{ color: '#4A5565', fontSize: '14px' }}>
              {translation('Prepare a view, searches, sort, and output')}
            </span>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center"
            style={{ color: '#6A7282' }}
            onClick={onClose}
          >
            <IoMdClose />
          </button>
        </div>

        <div className="min-h-0 flex-1 bg-slate-100 overflow-y-auto p-2 sm:p-3">
          <div className="rounded-md border border-slate-200 bg-white p-2 shadow-sm sm:p-3">
            <div
              className="grid gap-3"
              style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
            >
              <div className="rounded border border-slate-200 bg-slate-50 p-3">
                <label className={labelClass} style={{ fontSize: '12px' }}>
                  {translation('View')}
                </label>
                <select
                  className={`${selectClass} mt-2 w-full`}
                  style={controlStyle}
                  value={String(draft.viewId ?? '')}
                  onChange={(e) => setDraft((prev) => ({ ...prev, viewId: e.target.value }))}
                >
                  <option value="">{translation('Select view')}</option>
                  {savedViews.map((record) => (
                    <option key={savedRecordKey(record)} value={savedRecordKey(record)}>
                      {recordLabel(record)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 p-3">
                <label className={labelClass} style={{ fontSize: '12px' }}>
                  {translation('Sort')}
                </label>
                <select
                  className={`${selectClass} mt-2 w-full`}
                  style={controlStyle}
                  value={String(draft.sortId ?? '')}
                  onChange={(e) => setDraft((prev) => ({ ...prev, sortId: e.target.value }))}
                >
                  <option value="">{translation('Select sort')}</option>
                  {savedSorts.map((record) => (
                    <option key={savedRecordKey(record)} value={savedRecordKey(record)}>
                      {recordLabel(record)}
                    </option>
                  ))}
                </select>
              </div>
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
                          color: '#EC7B80',
                          borderColor: '#EC7B80',
                          backgroundColor: '#EC7B801A',
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
                          onChange={(e) => setFilterAt(index, { filterId: e.target.value })}
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
            <div className="grid gap-4 py-3 md:grid-cols-2">
              <section className="rounded border border-slate-200 bg-slate-50 p-3">
                <span
                  className="mb-3 block text-slate-800"
                  style={{ fontSize: '12px', fontWeight: 700 }}
                >
                  {translation('List display')}
                </span>
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
                >
                  {[
                    ['export', 'Data export'],
                    ['list', 'List representation'],
                    ['table', 'Table representation'],
                  ].map(([value, label]) => (
                    <label
                      key={value}
                      className="flex items-center gap-2 text-slate-700"
                      style={{ fontSize: '12px' }}
                    >
                      <input
                        type="radio"
                        name="sequence-output"
                        checked={draft.output.mode === value}
                        onChange={() =>
                          setDraft((prev) => ({
                            ...prev,
                            output: {
                              ...prev.output,
                              mode: value as SequenceProgrammingPayload['output']['mode'],
                            },
                          }))
                        }
                      />
                      {translation(label)}
                    </label>
                  ))}
                </div>
                <label className="block text-slate-700" style={{ fontSize: '12px' }}>
                  {translation('Reference document')}
                  <input
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1"
                    style={controlStyle}
                    value={String(draft.output.referenceDocumentId ?? '')}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        output: { ...prev.output, referenceDocumentId: e.target.value },
                      }))
                    }
                  />
                </label>
              </section>

              <section className="rounded border border-slate-200 bg-slate-50   p-3">
                <span
                  className="mb-3 block text-slate-800"
                  style={{ fontSize: '12px', fontWeight: 700 }}
                >
                  {translation('Transposition')}
                </span>
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
                >
                  {[
                    ['nTo1', 'Selection transposition: N to 1'],
                    ['oneToN', 'Selection transposition: 1 to N'],
                  ].map(([value, label]) => (
                    <label
                      key={value}
                      className="flex items-center gap-2 text-slate-700"
                      style={{ fontSize: '12px' }}
                    >
                      <input
                        type="radio"
                        name="sequence-transposition"
                        checked={draft.transposition.mode === value}
                        onChange={() =>
                          setDraft((prev) => ({
                            ...prev,
                            transposition: {
                              ...prev.transposition,
                              mode: value as SequenceProgrammingPayload['transposition']['mode'],
                              selectionId: '',
                              selectionKey: '',
                              selectionLabel: '',
                              selectionLink: '',
                            },
                          }))
                        }
                      />
                      {translation(label)}
                    </label>
                  ))}
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-slate-700" style={{ fontSize: '12px', fontWeight: 600 }}>
                      {translation('Transposition selection')}
                    </span>
                    {draft.transposition.selectionLabel ? (
                      <span className="truncate text-slate-500" style={{ fontSize: '11px' }}>
                        {draft.transposition.selectionLabel}
                      </span>
                    ) : null}
                  </div>
                  <div
                    className="max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white p-1"
                    style={{ minHeight: '88px' }}
                  >
                    <TranspositionTree
                      options={currentTranspositionTree}
                      selectedKey={String(draft.transposition.selectionKey ?? '')}
                      expandedKeys={expandedTranspositionKeys}
                      toggleExpanded={toggleTranspositionExpanded}
                      onSelect={selectTranspositionTreeOption}
                      emptyLabel={
                        draft.transposition.mode === 'none'
                          ? translation('Choose a transposition type')
                          : translation('No transposition available')
                      }
                    />
                  </div>
                </div>
                <label className="block text-slate-700" style={{ fontSize: '12px' }}>
                  {translation('Chained sequence')}
                  <select
                    className={`${selectClass} mt-1 w-full`}
                    style={controlStyle}
                    value={String(draft.transposition.chainedSequenceId ?? '')}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        transposition: { ...prev.transposition, chainedSequenceId: e.target.value },
                      }))
                    }
                  >
                    <option value="">{translation('No sequence')}</option>
                    {savedSequences.map((record) => (
                      <option key={savedRecordKey(record)} value={savedRecordKey(record)}>
                        {recordLabel(record)}
                      </option>
                    ))}
                  </select>
                </label>
                <label
                  className="my-2 flex items-center gap-2 text-slate-700"
                  style={{ fontSize: '12px' }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(draft.transposition.runSearchesOnResultSelection)}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        transposition: {
                          ...prev.transposition,
                          runSearchesOnResultSelection: e.target.checked,
                        },
                      }))
                    }
                  />
                  {translation('Run sequence searches on the resulting selection')}
                </label>
                <label className="block text-slate-700" style={{ fontSize: '12px' }}>
                  {translation('Predefined documents')}
                  <input
                    className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1"
                    style={controlStyle}
                    value={String(draft.transposition.predefinedDocumentId ?? '')}
                    onChange={(e) =>
                      setDraft((prev) => ({
                        ...prev,
                        transposition: {
                          ...prev.transposition,
                          predefinedDocumentId: e.target.value,
                        },
                      }))
                    }
                  />
                </label>
              </section>
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
                    color: '#EC7B80',
                    borderColor: '#EC7B80',
                    backgroundColor: '#EC7B8033',
                  }}
                  onClick={() => {
                    const record = findSavedRecord(
                      savedSequences,
                      selectedSequenceKey,
                    ) as SavedSequence | null;
                    if (record) onDelete(record);
                  }}
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
              borderColor: '#0000001A',
              color: '#44444C',
              fontSize: '12px',
            }}
            onClick={onClose}
          >
            {translation('Clear')}
          </button>
          <button
            type="button"
            className="flex items-center justify-center rounded-md border px-3 py-2 text-center text-sm text-white"
            style={{
              background: '#2B5797',
              height: '31px',
              fontSize: '12px',
            }}
            onClick={() => onApply(sequenceToPersist())}
          >
            {translation('Apply')}
          </button>
        </div>
      </div>
    </div>
  );
};
