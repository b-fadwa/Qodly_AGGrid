import { FC, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { SortModelItem } from 'ag-grid-community';
import { IoMdClose } from 'react-icons/io';
import { FaFloppyDisk } from 'react-icons/fa6';
import { GoTrash } from 'react-icons/go';

import type { SavedSort } from '../state/types';

type Translation = (key: string) => string;

/** Sentinel for the sort dropdown: no saved sort applied for this search. */
export const CALCULATED_SEARCH_SORT_NONE = 'none' as const;

function savedSortOptionKey(sort: SavedSort): string {
  return String(sort.name ?? sort.title ?? sort.id ?? '');
}

function resolveInitialSortSelect(savedSorts: SavedSort[], toolbarSelectedSortKey: string): string {
  if (!toolbarSelectedSortKey) return CALCULATED_SEARCH_SORT_NONE;
  const valid = new Set(
    savedSorts.map(savedSortOptionKey).filter((k) => k.length > 0),
  );
  return valid.has(toolbarSelectedSortKey) ? toolbarSelectedSortKey : CALCULATED_SEARCH_SORT_NONE;
}

/** Full AG Grid sort model for the dropdown choice (empty when “No sort”). */
function sortModelForSelectValue(
  savedSorts: SavedSort[],
  selectValue: string,
): SortModelItem[] {
  if (selectValue === CALCULATED_SEARCH_SORT_NONE) return [];
  const record = savedSorts.find((s) => savedSortOptionKey(s) === selectValue);
  const model = record?.sortModel;
  if (!Array.isArray(model)) return [];
  return model.map((item) => ({ ...item }));
}

/** Search scope: entire dataset vs current selection (toolbar radios). */
export type CalculatedSearchScopeKind = 'global' | 'selection';

/** How the search result updates the current selection. */
export type CalculatedSearchTypeKind = 'replace' | 'add' | 'remove';

/** Payload emitted on **On Calculated search** (`oncalculatedsearch`). */
export type CalculatedSearchEmitPayload = {
  scope: {
    option: CalculatedSearchScopeKind;
  };
  searchType: {
    option: CalculatedSearchTypeKind;
  };
  /** AG Grid sort model levels (`colId` + `sort`); empty when “No sort” is chosen. */
  sort: SortModelItem[];
  filterOnFiscalYears: boolean;
};

const mockInput = {
  background: '#F3F3F5',
  borderColor: '#E5E7EB',
  color: '#0A0A0A',
} as const;

const ACCENT = '#2B5797';

const styleSectionHeading: CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.05em',
  lineHeight: 1.25,
  color: '#334155',
  textTransform: 'uppercase',
  margin: 0,
};

const styleLabel11: CSSProperties = {
  fontSize: '11px',
  fontWeight: 500,
  lineHeight: 1.25,
  color: '#475569',
};

const styleBody11: CSSProperties = {
  fontSize: '11px',
  lineHeight: 1.375,
};

const styleBody11Tight: CSSProperties = {
  fontSize: '11px',
  lineHeight: 1.25,
};

const styleControl14: CSSProperties = {
  width: '14px',
  height: '14px',
  flexShrink: 0,
  accentColor: ACCENT,
};

const styleCheckbox14: CSSProperties = {
  width: '14px',
  height: '14px',
  flexShrink: 0,
  accentColor: ACCENT,
};

const styleBottomColumn: CSSProperties = {
  minWidth: '9.5rem',
  maxWidth: '13rem',
};

const styleSavedColumn: CSSProperties = {
  minWidth: 'min(100%, 240px)',
};

function MockSelect({
  translation,
  label,
  defaultValue,
  options,
}: {
  translation: Translation;
  label: string;
  defaultValue: string;
  options: { value: string; labelKey: string }[];
}) {
  return (
    <label className="flex w-full flex-col gap-1 text-left">
      <span style={styleLabel11}>{translation(label)}</span>
      <select
        className="h-7 w-full rounded border px-2 text-xs outline-none"
        style={mockInput}
        defaultValue={defaultValue}
        disabled
        aria-hidden
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {translation(o.labelKey)}
          </option>
        ))}
      </select>
    </label>
  );
}

function MockTextInput({
  translation,
  label,
  defaultValue,
}: {
  translation: Translation;
  label: string;
  defaultValue: string;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-left">
      <span style={styleLabel11}>{translation(label)}</span>
      <input
        type="text"
        readOnly
        className="h-7 rounded border px-2 text-xs leading-tight"
        style={mockInput}
        defaultValue={defaultValue}
        aria-hidden
      />
    </label>
  );
}

export const CalculatedSearchDialog: FC<{
  open: boolean;
  onClose: () => void;
  translation: Translation;
  savedSorts: SavedSort[];
  /** Toolbar / grid selected saved sort name; synced when the dialog opens. */
  selectedSortKey: string;
  /** Current “filter on fiscal years” flag from the grid when the dialog opens. */
  filterOnFiscalYearsInitial: boolean;
  /** Invoked when the user confirms; parent should `emit('oncalculatedsearch', payload)`. */
  onApply: (payload: CalculatedSearchEmitPayload) => void | Promise<void>;
}> = ({
  open,
  onClose,
  translation,
  savedSorts,
  selectedSortKey,
  filterOnFiscalYearsInitial,
  onApply,
}) => {
  const [applyBusy, setApplyBusy] = useState(false);
  const [scopeOption, setScopeOption] = useState<CalculatedSearchScopeKind>('global');
  const [searchTypeOption, setSearchTypeOption] = useState<CalculatedSearchTypeKind>('replace');
  const [sortSelectValue, setSortSelectValue] = useState<string>(CALCULATED_SEARCH_SORT_NONE);
  const [filterOnFiscalYears, setFilterOnFiscalYears] = useState(true);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setScopeOption('global');
      setSearchTypeOption('replace');
      setSortSelectValue(resolveInitialSortSelect(savedSorts, selectedSortKey));
      setFilterOnFiscalYears(filterOnFiscalYearsInitial);
    }
    wasOpenRef.current = open;
  }, [open, savedSorts, selectedSortKey, filterOnFiscalYearsInitial]);

  const handleApply = useCallback(async () => {
    if (applyBusy) return;
    const payload: CalculatedSearchEmitPayload = {
      scope: { option: scopeOption },
      searchType: { option: searchTypeOption },
      sort: sortModelForSelectValue(savedSorts, sortSelectValue),
      filterOnFiscalYears,
    };
    setApplyBusy(true);
    try {
      await onApply(payload);
    } finally {
      setApplyBusy(false);
    }
  }, [
    applyBusy,
    onApply,
    scopeOption,
    searchTypeOption,
    sortSelectValue,
    savedSorts,
    filterOnFiscalYears,
  ]);

  if (!open) return null;

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
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 rounded-t-xl">
          <div>
            <span
              className="tracking-wide"
              style={{ color: '#0A0A0A', fontSize: '16px', fontWeight: 500 }}
            >
              {translation('Calculated search')}
            </span>
            <span className="mt-1 block text-sm" style={{ color: '#4A5565', fontSize: '14px' }}>
              {translation('Filter rows using calculated field criteria.')}
            </span>
          </div>
          <button
            className="inline-flex items-center justify-center"
            style={{ color: '#6A7282' }}
            onClick={onClose}
          >
            <IoMdClose />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:p-3">
          <div className="rounded-md border border-slate-200 bg-white p-2 shadow-sm sm:p-3">
            {/* Two columns: equal width (50% / 50%) — fields | constraint + target */}
            <div className="flex min-h-0 min-w-0 flex-row items-stretch gap-4 overflow-x-auto">
              {/* Column 1 — Available fields */}
              <div
                className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded border border-slate-200 bg-white"
                style={{ minHeight: '200px' }}
              >
                <div
                  className="border-b border-slate-200 bg-slate-50 px-2 py-1.5"
                  style={styleSectionHeading}
                >
                  {translation('Available fields')}
                </div>
                <div
                  className="min-h-0 flex-1 overflow-y-auto p-2 font-mono leading-snug text-slate-700"
                  style={{ fontSize: '11px' }}
                >
                  <div className="text-slate-600">{translation('Quantity')}</div>
                  <div className="text-slate-600">{translation('Movement type')}</div>
                  <div className="mt-2 font-sans text-slate-500">▼ STOCK RESERVATIONS</div>
                  <div className="pl-3 text-slate-600">{translation('Reservation date')}</div>
                  <div className="rounded bg-sky-50 py-0.5 pl-3 font-sans text-sky-900">
                    {translation('Update date')}
                  </div>
                  <div className="pl-3 text-slate-600">{translation('Reserved quantity')}</div>
                </div>
              </div>

              {/* Column 2 — Constraint + Target value (same width as column 1) */}
              <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col gap-3">
                <section className="flex flex-col gap-2 rounded border border-slate-200 bg-slate-50 p-2 sm:p-3">
                  <h3 style={styleSectionHeading}>{translation('Constraint')}</h3>
                  <div className="flex flex-col gap-2">
                    <MockSelect
                      translation={translation}
                      label="Constraint type"
                      defaultValue="count"
                      options={[
                        { value: 'count', labelKey: 'Number (count)' },
                        { value: 'sum', labelKey: 'Sum' },
                        { value: 'exists', labelKey: 'Exists' },
                      ]}
                    />
                    <div>
                      <span
                        className="mb-1 block font-medium text-slate-600"
                        style={{ fontSize: '11px' }}
                      >
                        {translation('Number of related records')}
                      </span>
                      <div className="flex flex-wrap items-end gap-2">
                        <MockTextInput translation={translation} label="From" defaultValue="2" />
                        <MockTextInput translation={translation} label="To" defaultValue="99999" />
                      </div>
                    </div>
                  </div>
                </section>

                <section className="flex flex-col gap-2 rounded border border-slate-200 bg-slate-50 p-2 sm:p-3">
                  <h3 style={styleSectionHeading}>{translation('Target value')}</h3>
                  <div className="mb-1 text-slate-500" style={{ fontSize: '11px' }}>
                    Stock réservations · {translation('Update date')}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                    <div className="min-w-0 flex-1" style={{ minWidth: '7.5rem' }}>
                      <MockSelect
                        translation={translation}
                        label="Comparison operator"
                        defaultValue="eq"
                        options={[
                          { value: 'eq', labelKey: 'Equal to' },
                          { value: 'ne', labelKey: 'Not equal to' },
                          { value: 'gt', labelKey: 'Greater than' },
                        ]}
                      />
                    </div>
                    <div className="min-w-0 flex-1" style={{ minWidth: '6rem' }}>
                      <MockTextInput
                        translation={translation}
                        label="Value"
                        defaultValue="00/00/0000"
                      />
                    </div>
                    <div className="min-w-0 flex-1" style={{ minWidth: '7.5rem' }}>
                      <MockSelect
                        translation={translation}
                        label="Entry mode"
                        defaultValue="free"
                        options={[
                          { value: 'free', labelKey: 'Free entry' },
                          { value: 'list', labelKey: 'From list' },
                        ]}
                      />
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* Search expression table */}
            <div className="mt-2">
              <div
                className="mb-1 font-semibold uppercase tracking-wide text-slate-600"
                style={{ fontSize: '10px' }}
              >
                {translation('Search expression')}
              </div>
              <div className="overflow-x-auto rounded border border-slate-200">
                <div
                  className="flex w-full min-w-0 flex-col text-left text-slate-800"
                  style={{ minWidth: '520px', fontSize: '11px' }}
                  role="table"
                  aria-label={translation('Search expression')}
                >
                  <div
                    className="flex w-full flex-row border-b border-slate-200 bg-slate-100 font-medium text-slate-600"
                    role="row"
                  >
                    <div
                      className="min-w-0 flex-1 border-slate-200 px-1.5 py-1"
                      role="columnheader"
                    >
                      {translation('Logic')}
                    </div>
                    <div
                      className="min-w-0 flex-1 border-slate-200 px-1.5 py-1"
                      role="columnheader"
                    >
                      {translation('Table / Field')}
                    </div>
                    <div
                      className="min-w-0 flex-1 border-slate-200 px-1.5 py-1"
                      role="columnheader"
                    >
                      {translation('Constraint')}
                    </div>
                    <div
                      className="min-w-0 flex-1 border-slate-200 px-1.5 py-1"
                      role="columnheader"
                    >
                      {translation('Comparison operator')}
                    </div>
                    <div
                      className="min-w-0 flex-1 border-slate-200 px-1.5 py-1"
                      role="columnheader"
                    >
                      {translation('Target value')}
                    </div>
                  </div>
                  <div
                    className="flex w-full flex-row border-b border-slate-200 bg-white"
                    role="row"
                  >
                    <div className="min-w-0 flex-1 px-1.5 py-1 text-slate-500" role="cell">
                      —
                    </div>
                    <div className="min-w-0 flex-1 px-1.5 py-1" role="cell">
                      Stock réserv. / {translation('Update date')}
                    </div>
                    <div className="min-w-0 flex-1 px-1.5 py-1" role="cell">
                      2 … 99999
                    </div>
                    <div className="min-w-0 flex-1 px-1.5 py-1" role="cell">
                      {translation('Equal to')}
                    </div>
                    <div className="min-w-0 flex-1 px-1.5 py-1" role="cell">
                      00/00/0000
                    </div>
                  </div>
                  <div
                    className="flex w-full flex-row border-b border-slate-200 bg-slate-50"
                    role="row"
                  >
                    <div
                      className="min-w-0 flex-1 px-1.5 py-1 font-semibold"
                      style={{ color: ACCENT }}
                      role="cell"
                    >
                      {translation('And')}
                    </div>
                    <div className="min-w-0 flex-1 px-1.5 py-1" role="cell">
                      Mouvements / {translation('Movement type')}
                    </div>
                    <div className="min-w-0 flex-1 px-1.5 py-1" role="cell">
                      1 … 999
                    </div>
                    <div className="min-w-0 flex-1 px-1.5 py-1" role="cell">
                      {translation('Equal to')}
                    </div>
                    <div className="min-w-0 flex-1 px-1.5 py-1 text-slate-500" role="cell">
                      —
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div
                  className="flex flex-wrap items-center gap-2 text-slate-700"
                  style={styleBody11}
                >
                  <span className="font-medium text-slate-600">
                    {translation('Logical operators')}
                  </span>
                  <label className="inline-flex cursor-default items-center gap-1 text-slate-700">
                    <input
                      type="radio"
                      name="calcsearch-logic"
                      defaultChecked
                      disabled
                      style={{ accentColor: ACCENT }}
                    />
                    {translation('And')}
                  </label>
                  <label className="inline-flex cursor-default items-center gap-1 text-slate-700">
                    <input
                      type="radio"
                      name="calcsearch-logic"
                      disabled
                      style={{ accentColor: ACCENT }}
                    />
                    {translation('Or')}
                  </label>
                  <label className="inline-flex cursor-default items-center gap-1 text-slate-700">
                    <input
                      type="radio"
                      name="calcsearch-logic"
                      disabled
                      style={{ accentColor: ACCENT }}
                    />
                    {translation('Except')}
                  </label>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(['Add', 'Insert', 'Delete', 'Remove all', 'Copy'] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-medium text-slate-700"
                      style={{ fontSize: '11px' }}
                    >
                      {translation(key)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom bands — flex-row with wrap; compact spacing */}
            <div className="mt-3 border-t border-slate-200 pt-3">
              <div className="flex w-full flex-row flex-wrap items-start gap-3 text-left md:gap-4">
                <section className="flex flex-1 flex-col gap-1.5" style={styleBottomColumn}>
                  <h3 style={styleSectionHeading}>{translation('Options')}</h3>
                  <div className="flex flex-col gap-1.5">
                    <label className="flex w-full flex-col gap-1 text-left">
                      <span style={styleLabel11}>{translation('Sort order')}</span>
                      <select
                        className="h-7 w-full rounded border px-2 text-xs outline-none"
                        style={mockInput}
                        value={sortSelectValue}
                        onChange={(e) => setSortSelectValue(e.target.value)}
                      >
                        <option value={CALCULATED_SEARCH_SORT_NONE}>
                          {translation('No sort')}
                        </option>
                        {savedSorts
                          .filter((sort) => savedSortOptionKey(sort).length > 0)
                          .map((sort) => {
                            const value = savedSortOptionKey(sort);
                            const label = String(sort.title ?? sort.name ?? value);
                            return (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            );
                          })}
                      </select>
                    </label>
                    <label
                      className="flex cursor-pointer items-center gap-1.5 text-slate-800"
                      style={styleBody11Tight}
                    >
                      <input
                        type="checkbox"
                        checked={filterOnFiscalYears}
                        onChange={(e) => setFilterOnFiscalYears(e.target.checked)}
                        className="shrink-0 rounded border-slate-300"
                        style={styleCheckbox14}
                      />
                      {translation('Filter on fiscal years')}
                    </label>
                  </div>
                </section>

                <section className="flex flex-1 flex-col gap-1.5" style={styleBottomColumn}>
                  <h3 style={styleSectionHeading}>{translation('Search scope')}</h3>
                  <div className="flex flex-col gap-1 text-slate-800" style={styleBody11Tight}>
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="radio"
                        name="calcsearch-scope"
                        checked={scopeOption === 'global'}
                        onChange={() => setScopeOption('global')}
                        style={styleControl14}
                      />
                      {translation('Global search')}
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="radio"
                        name="calcsearch-scope"
                        checked={scopeOption === 'selection'}
                        onChange={() => setScopeOption('selection')}
                        style={styleControl14}
                      />
                      {translation('Search in selection')}
                    </label>
                  </div>
                </section>

                <section className="flex flex-1 flex-col gap-1.5" style={styleBottomColumn}>
                  <h3 style={styleSectionHeading}>{translation('Search type')}</h3>
                  <div className="flex flex-col gap-1 text-slate-800" style={styleBody11Tight}>
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="radio"
                        name="calcsearch-type"
                        checked={searchTypeOption === 'replace'}
                        onChange={() => setSearchTypeOption('replace')}
                        style={styleControl14}
                      />
                      {translation('Replace selection')}
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="radio"
                        name="calcsearch-type"
                        checked={searchTypeOption === 'add'}
                        onChange={() => setSearchTypeOption('add')}
                        style={styleControl14}
                      />
                      {translation('Add to selection')}
                    </label>
                    <label className="flex cursor-pointer items-center gap-1.5">
                      <input
                        type="radio"
                        name="calcsearch-type"
                        checked={searchTypeOption === 'remove'}
                        onChange={() => setSearchTypeOption('remove')}
                        style={styleControl14}
                      />
                      {translation('Remove from selection')}
                    </label>
                  </div>
                </section>

                <section
                  className="flex flex-1 flex-col gap-1.5 border-t border-slate-200 xx@lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0"
                  style={styleSavedColumn}
                >
                  <h3 style={styleSectionHeading}>{translation('Saved search formats')}</h3>
                  <div className="flex min-w-0 max-w-md items-center gap-1">
                    <select
                      className="h-7 min-w-0 flex-1 rounded border px-2 text-xs"
                      style={mockInput}
                      defaultValue="a"
                      disabled
                      aria-hidden
                    >
                      <option value="a">{translation('My saved search (sample)')}</option>
                    </select>
                    <button
                      type="button"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-slate-600"
                      aria-label={translation('Save')}
                    >
                      <FaFloppyDisk size={11} />
                    </button>
                    <button
                      type="button"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-slate-600"
                      aria-label={translation('Delete')}
                    >
                      <GoTrash size={12} />
                    </button>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>

        <div
          className="flex w-full shrink-0 items-center justify-end gap-2 p-4"
          style={{ borderTop: '1px solid #E5E7EB' }}
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
            className="flex items-center justify-center rounded-md border px-3 py-2 text-center text-sm text-white disabled:opacity-50"
            onClick={() => void handleApply()}
            disabled={applyBusy}
            style={{
              background: '#2B5797',
              height: '31px',
              fontSize: '12px',
            }}
          >
            {translation('Apply')}
          </button>
        </div>
      </div>
    </div>
  );
};
