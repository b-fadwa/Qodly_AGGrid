import { FC, useEffect, useMemo, useRef, useState } from 'react';
import type { IColumn } from '../AgGrid.config';
import get from 'lodash/get';
import {
  extractRefDatasetKeyFromSource,
  getColumnAgGridFilterType,
  getColumnFilterOperators,
  type FilterOperatorDescriptor,
  refOptionI18nCompositeKey,
} from '../AgGrid.filtering';
import {
  DateSaisieLibreSelect,
  makeDateSaisieLibreConditionMeta,
  readDateSaisieLibreConditionValue,
  readDateSaisieLibreConditionValueTo,
  type DateEntryMode,
} from './DateSaisieLibre';

interface ConditionDraft {
  operator: string;
  value: string;
  value2: string;
  entryMode?: DateEntryMode;
}

type FilterSearchScopeKind = 'global' | 'selection';
type FilterSearchTypeKind = 'replace' | 'add' | 'remove';

export interface MonoCriteriaApplyOptions {
  scope: {
    option: FilterSearchScopeKind;
  };
  searchType: {
    option: FilterSearchTypeKind;
  };
}

const COLLECTION_OPERATOR_KEY = 'inCollection';

const parseCollectionTokens = (raw: string): string[] =>
  String(raw ?? '')
    .replace(/\\n/g, '\n')
    .split(/[\n\r,]+/g)
    .map((v) => v.trim())
    .filter(Boolean);

const joinCollectionTokens = (tokens: string[]): string => tokens.join(', ');

interface HeaderFilterPopupProps {
  open: boolean;
  anchorRect: DOMRect | null;
  column: IColumn | null;
  colId: string | null;
  currentEntry: any;
  i18n?: any;
  lang?: string;
  showDateFinancialToggle: boolean;
  dateFinancialFilterEnabled: boolean;
  onDateFinancialFilterEnabledChange: (enabled: boolean) => void;
  showFilterInactiveRecordsToggle: boolean;
  filterInactiveRecordsEnabled: boolean;
  onFilterInactiveRecordsEnabledChange: (enabled: boolean) => void;
  initialScopeOption?: FilterSearchScopeKind;
  initialSearchTypeOption?: FilterSearchTypeKind;
  translation: (key: string) => string;
  dateSaisieLibreTranslation?: (key: string) => string;
  onApply: (colId: string, condition: any | null, options: MonoCriteriaApplyOptions) => void;
  onClose: () => void;
}

const ZERO_INPUT_OPERATORS = new Set(['isTrue', 'isFalse', 'blank', 'notBlank']);
const EMPTY_TEXT_VALUE_OPERATORS = new Set(['equals', 'notEqual']);
const NUMERIC_TEXT_INPUT_DATA_TYPES = new Set([
  'word',
  'short',
  'long',
  'number',
  'long64',
  'duration',
]);
const boolOps = (ops: FilterOperatorDescriptor[]) =>
  ops.some((o) => o.key === 'isTrue' || o.key === 'isFalse');
const defaultOp = (ops: FilterOperatorDescriptor[]) =>
  boolOps(ops)
    ? (ops.find((o) => o.key === 'isTrue')?.key ?? ops[0]?.key ?? 'equals')
    : (ops[0]?.key ?? 'equals');

const parseEntry = (entry: any, ops: FilterOperatorDescriptor[]): ConditionDraft => {
  const fallback = defaultOp(ops);
  if (!entry || typeof entry !== 'object') {
    return { operator: fallback, value: '', value2: '' };
  }
  const condition = Array.isArray(entry.conditions) ? entry.conditions[0] : entry;
  if (!condition || typeof condition !== 'object') {
    return { operator: fallback, value: '', value2: '' };
  }
  return {
    operator: condition?.type ?? fallback,
    value: condition?.dateSaisieLibre
      ? readDateSaisieLibreConditionValue(condition)
      : condition?.filter != null
        ? String(condition.filter)
        : condition?.dateFrom != null
          ? String(condition.dateFrom)
          : condition?.value != null
            ? String(condition.value)
            : '',
    value2: condition?.dateSaisieLibre
      ? readDateSaisieLibreConditionValueTo(condition)
      : condition?.filterTo != null
        ? String(condition.filterTo)
        : condition?.dateTo != null
          ? String(condition.dateTo)
          : '',
    entryMode:
      condition?.filterType === 'date' ? (condition?.dateSaisieLibre ? 'list' : 'free') : undefined,
  };
};

const toCondition = (
  row: ConditionDraft,
  filterType: 'text' | 'number' | 'date' | 'qodlyRefSelect',
  column?: IColumn | null,
): any | null => {
  if (!row.operator) return null;
  if (ZERO_INPUT_OPERATORS.has(row.operator)) return { filterType, type: row.operator };
  if (filterType === 'date') {
    if (row.entryMode === 'list') {
      const meta = makeDateSaisieLibreConditionMeta(
        row.value,
        row.operator === 'inRange' ? row.value2 : undefined,
      );
      if (!meta) return null;
      return { filterType, type: row.operator, dateFrom: null, dateTo: null, ...meta };
    }
    if (!row.value) return null;
    return {
      filterType,
      type: row.operator,
      dateFrom: row.value,
      dateTo: row.value2 || null,
      dateSaisieLibre: false,
    };
  }
  if (filterType === 'qodlyRefSelect') {
    const raw = String(row.value ?? '').trim();
    if (!raw) return null;
    const num = Number(raw);
    if (!Number.isFinite(num)) return null;
    return { filterType, type: row.operator, value: num };
  }
  const normalizedValue =
    row.operator === COLLECTION_OPERATOR_KEY
      ? joinCollectionTokens(parseCollectionTokens(row.value))
      : row.value;
  const dataType = String(column?.dataType ?? '')
    .trim()
    .toLowerCase();
  const emptyTextComparisonAllowed =
    filterType === 'text' &&
    dataType !== 'date' &&
    !NUMERIC_TEXT_INPUT_DATA_TYPES.has(dataType) &&
    EMPTY_TEXT_VALUE_OPERATORS.has(row.operator);
  if ((normalizedValue === '' || normalizedValue == null) && !emptyTextComparisonAllowed) {
    return null;
  }
  return {
    filterType,
    type: row.operator,
    filter: normalizedValue,
    filterTo: row.value2 || undefined,
  };
};

const styles = {
  panel: {
    position: 'fixed',
    minWidth: '250px',
    maxWidth: '350px',
    maxHeight: '70vh',
    overflow: 'auto',
    background: '#F3F4F6',
    border: '1px solid #0000001A',
    borderRadius: '8px',
    boxShadow: '0 16px 24px rgba(0, 0, 0, 0.12)',
    zIndex: 100001,
  } as React.CSSProperties,
  control: {
    height: '32px',
    boxSizing: 'border-box',
    display: 'block',
    minWidth: 0,
    borderRadius: '5px',
    border: '1px solid #CBD5E1',
    color: '#44444C',
    fontSize: '13px',
    padding: '0 12px',
    background: '#FFFFFF',
  } as React.CSSProperties,
};

export const HeaderFilterPopup: FC<HeaderFilterPopupProps> = ({
  open,
  anchorRect,
  column,
  colId,
  currentEntry,
  i18n,
  lang,
  showDateFinancialToggle,
  dateFinancialFilterEnabled,
  onDateFinancialFilterEnabledChange,
  showFilterInactiveRecordsToggle,
  filterInactiveRecordsEnabled,
  onFilterInactiveRecordsEnabledChange,
  initialScopeOption = 'global',
  initialSearchTypeOption = 'replace',
  translation,
  dateSaisieLibreTranslation,
  onApply,
  onClose,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const operators = useMemo(() => (column ? getColumnFilterOperators(column) : []), [column]);
  const filterType = useMemo(() => getColumnAgGridFilterType(column), [column]);
  const inputType = useMemo(() => {
    const dt = String(column?.dataType ?? '')
      .trim()
      .toLowerCase();
    if (dt === 'date') return 'date';
    if (['word', 'short', 'long', 'number', 'long64', 'duration'].includes(dt)) return 'number';
    return 'text';
  }, [column]);
  const [row, setRow] = useState<ConditionDraft>({ operator: 'equals', value: '', value2: '' });
  const [dateFinancialFilterDraft, setDateFinancialFilterDraft] = useState<boolean>(false);
  const [filterInactiveRecordsDraft, setFilterInactiveRecordsDraft] = useState<boolean>(false);
  const [scopeOption, setScopeOption] = useState<FilterSearchScopeKind>('global');
  const [searchTypeOption, setSearchTypeOption] = useState<FilterSearchTypeKind>('replace');

  useEffect(() => {
    if (!open || !colId) return;
    setDateFinancialFilterDraft(Boolean(dateFinancialFilterEnabled));
    setFilterInactiveRecordsDraft(Boolean(filterInactiveRecordsEnabled));
    setScopeOption(initialScopeOption);
    setSearchTypeOption(initialSearchTypeOption);
    setRow(parseEntry(currentEntry, operators));
  }, [
    open,
    colId,
    currentEntry,
    operators,
    dateFinancialFilterEnabled,
    filterInactiveRecordsEnabled,
    initialScopeOption,
    initialSearchTypeOption,
  ]);

  const refSelectOptions = useMemo(() => {
    if (!column) return [];
    if (filterType !== 'qodlyRefSelect') return [];
    const refKey = extractRefDatasetKeyFromSource(column.source);
    if (!refKey) return [];

    const readLabel = (value: number): string | null => {
      const composite = refOptionI18nCompositeKey(refKey, value);
      const base = `keys.${composite}`;
      const fromLang = lang ? get(i18n, `${base}.${lang}`) : undefined;
      const fromDef = get(i18n, `${base}.default`);
      const leaf = get(i18n, base);
      const raw =
        (fromLang != null && String(fromLang).trim() !== '' ? fromLang : undefined) ??
        (fromDef != null && String(fromDef).trim() !== '' ? fromDef : undefined) ??
        (typeof leaf === 'string' || typeof leaf === 'number' ? leaf : undefined);
      const s = raw != null ? String(raw).trim() : '';
      return s ? s : null;
    };

    const rawRefValues: any = (column as any).refValues;
    const values: number[] | null = Array.isArray(rawRefValues)
      ? rawRefValues
          .map((v: any) => (typeof v === 'number' ? v : Number(String(v ?? '').trim())))
          .filter((n: number) => Number.isFinite(n))
      : typeof rawRefValues === 'string' && rawRefValues.trim()
        ? rawRefValues
            .split(/[\n\r,]+/g)
            .map((s: string) => Number(String(s).trim()))
            .filter((n: number) => Number.isFinite(n))
        : null;

    const out: Array<{ value: number; label: string }> = [];
    if (values?.length) {
      Array.from(new Set(values)).forEach((v) => {
        out.push({ value: v, label: readLabel(v) ?? String(v) });
      });
      return out;
    }

    for (let j = 1; j <= 256; j += 1) {
      const label = readLabel(j);
      if (!label) break;
      out.push({ value: j, label });
    }
    return out;
  }, [column, filterType, i18n, lang]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      const panel = panelRef.current;
      if (panel && !panel.contains(e.target as Node)) onClose();
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open, onClose]);

  if (!open || !column || !colId || !anchorRect || !filterType) return null;

  const top = Math.min(anchorRect.bottom + 8, window.innerHeight - 20);
  const left = Math.min(Math.max(12, anchorRect.left), Math.max(12, window.innerWidth - 372));
  const selectedOp = operators.find((op) => op.key === row.operator) ?? operators[0] ?? null;
  const inputs = selectedOp?.inputs ?? 1;
  const isCollection = selectedOp?.key === COLLECTION_OPERATOR_KEY;
  const tokens = parseCollectionTokens(row.value);
  const isDateInput = inputType === 'date';

  return (
    <div ref={panelRef} style={{ ...styles.panel, top, left }}>
      <div className="border-b border-[#D1D5DB] p-2 flex items-center justify-between gap-2">
        <div className="text-[12px] font-semibold text-[#111827]">{column.title}</div>
      </div>
      <div className="flex flex-col gap-1 p-2">
        <select
          style={{ ...styles.control, width: '100%' }}
          value={row.operator}
          onChange={(e) => {
            setRow({ operator: e.target.value, value: '', value2: '' });
          }}
        >
          {operators.map((op) => (
            <option key={op.key} value={op.key}>
              {translation(op.label)}
            </option>
          ))}
        </select>
        {inputs >= 1 ? (
          <div className="flex flex-col gap-1">
            {isDateInput ? (
              <div className="flex flex-wrap items-center gap-3">
                {(['free', 'list'] as DateEntryMode[]).map((mode) => (
                  <label
                    key={mode}
                    className="inline-flex cursor-pointer items-center gap-1.5"
                    style={{ color: '#334155', fontSize: '13px' }}
                  >
                    <input
                      type="radio"
                      name={`header-filter-date-entry-mode-${colId}`}
                      checked={(row.entryMode ?? 'free') === mode}
                      onChange={() => setRow({ ...row, entryMode: mode, value: '', value2: '' })}
                      style={{ width: '14px', height: '14px', accentColor: '#2B5797' }}
                    />
                    <span>{translation(mode === 'free' ? 'Saisie libre' : 'From list')}</span>
                  </label>
                ))}
              </div>
            ) : null}
            {isCollection && tokens.length ? (
              <div className="mb-1 flex flex-wrap gap-1">
                {tokens.map((token) => (
                  <button
                    key={token}
                    type="button"
                    title={translation('Remove')}
                    onClick={() => {
                      const next = tokens.filter((t) => t !== token);
                      setRow({ ...row, value: joinCollectionTokens(next) });
                    }}
                    style={{
                      border: '1px solid rgba(99, 143, 207, 0.4)',
                      background: 'rgba(99, 143, 207, 0.15)',
                      color: '#2B5797',
                      borderRadius: '999px',
                      padding: '2px 8px',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    {token} ×
                  </button>
                ))}
              </div>
            ) : null}
            {isDateInput && row.entryMode === 'list' ? (
              <div className="flex flex-col gap-1">
                <DateSaisieLibreSelect
                  value={row.value}
                  translation={translation}
                  translateDateKey={dateSaisieLibreTranslation}
                  style={{ ...styles.control, width: '100%' }}
                  onChange={(nextValue) => setRow({ ...row, value: nextValue })}
                />
                {inputs === 2 ? (
                  <DateSaisieLibreSelect
                    value={row.value2}
                    translation={translation}
                    translateDateKey={dateSaisieLibreTranslation}
                    style={{ ...styles.control, width: '100%' }}
                    onChange={(nextValue2) => setRow({ ...row, value2: nextValue2 })}
                  />
                ) : null}
              </div>
            ) : filterType === 'qodlyRefSelect' ? (
              <select
                value={row.value}
                style={{ ...styles.control, width: '100%' }}
                onChange={(e) => setRow({ ...row, value: e.target.value })}
              >
                <option value="">{translation('Choose one')}</option>
                {refSelectOptions.map((o) => (
                  <option key={o.value} value={String(o.value)}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : isCollection ? (
              <textarea
                value={row.value}
                placeholder={translation('Enter values separated by commas')}
                style={{
                  ...styles.control,
                  width: '100%',
                  height: '56px',
                  paddingTop: '6px',
                  paddingBottom: '6px',
                  resize: 'vertical',
                }}
                onChange={(e) => setRow({ ...row, value: e.target.value })}
              />
            ) : isDateInput && inputs === 2 ? (
              <div className="flex flex-col gap-1">
                <input
                  type={inputType}
                  value={row.value}
                  placeholder={translation('Filter...')}
                  style={{ ...styles.control, width: '100%' }}
                  onChange={(e) => setRow({ ...row, value: e.target.value })}
                />
                <input
                  type={inputType}
                  value={row.value2}
                  placeholder={translation('Filter...')}
                  style={{ ...styles.control, width: '100%' }}
                  onChange={(e) => setRow({ ...row, value2: e.target.value })}
                />
              </div>
            ) : (
              <input
                type={inputType}
                value={row.value}
                placeholder={translation('Filter...')}
                style={{ ...styles.control, width: '100%' }}
                onChange={(e) => setRow({ ...row, value: e.target.value })}
              />
            )}
          </div>
        ) : null}
        {inputs === 2 && !isDateInput ? (
          <input
            type={inputType}
            value={row.value2}
            placeholder={translation('Filter...')}
            style={{ ...styles.control, width: '100%' }}
            onChange={(e) => setRow({ ...row, value2: e.target.value })}
          />
        ) : null}
      </div>
      {showDateFinancialToggle || showFilterInactiveRecordsToggle ? (
        <div className="flex flex-col gap-2 border-t border-[#D1D5DB] bg-[#ECECEC] p-2">
          {showDateFinancialToggle ? (
            <label
              className="mr-auto inline-flex items-center gap-1.5"
              style={{ color: '#44444C', fontSize: '12px', fontWeight: 500 }}
            >
              <input
                type="checkbox"
                checked={dateFinancialFilterDraft}
                onChange={(e) => setDateFinancialFilterDraft(e.target.checked)}
              />
              <span>{translation('filter by fiscal year')}</span>
            </label>
          ) : null}
          {showFilterInactiveRecordsToggle ? (
            <label
              className="mr-auto inline-flex items-center gap-1.5"
              style={{ color: '#44444C', fontSize: '12px', fontWeight: 500 }}
            >
              <input
                type="checkbox"
                checked={filterInactiveRecordsDraft}
                onChange={(e) => setFilterInactiveRecordsDraft(e.target.checked)}
              />
              <span>{translation('filter inactive records')}</span>
            </label>
          ) : null}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-3 border-t border-[#D1D5DB] bg-white p-2 sm:grid-cols-2">
        <section className="flex flex-col gap-1.5">
          <h3
            style={{
              margin: 0,
              color: '#111827',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              lineHeight: 1.25,
              textTransform: 'uppercase',
            }}
          >
            {translation('Search scope')}
          </h3>
          <div className="flex flex-col gap-1" style={{ color: '#334155', fontSize: '12px' }}>
            {[
              ['global', 'Global search'],
              ['selection', 'Search in selection'],
            ].map(([value, label]) => (
              <label key={value} className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name="header-filter-scope"
                  checked={scopeOption === value}
                  onChange={() => setScopeOption(value as FilterSearchScopeKind)}
                  style={{ width: '14px', height: '14px', flexShrink: 0, accentColor: '#2B5797' }}
                />
                <span>{translation(label)}</span>
              </label>
            ))}
          </div>
        </section>
        <section className="flex flex-col gap-1.5">
          <h3
            style={{
              margin: 0,
              color: '#111827',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              lineHeight: 1.25,
              textTransform: 'uppercase',
            }}
          >
            {translation('Search type')}
          </h3>
          <div className="flex flex-col gap-1" style={{ color: '#334155', fontSize: '12px' }}>
            {[
              ['replace', 'Replace selection'],
              ['add', 'Add to selection'],
              ['remove', 'Remove from selection'],
            ].map(([value, label]) => (
              <label key={value} className="inline-flex cursor-pointer items-center gap-1.5">
                <input
                  type="radio"
                  name="header-filter-search-type"
                  checked={searchTypeOption === value}
                  onChange={() => setSearchTypeOption(value as FilterSearchTypeKind)}
                  style={{ width: '14px', height: '14px', flexShrink: 0, accentColor: '#2B5797' }}
                />
                <span>{translation(label)}</span>
              </label>
            ))}
          </div>
        </section>
      </div>
      <div className="flex items-center justify-center border-t border-[#D1D5DB] bg-[#ECECEC] p-2">
        <button
          type="button"
          style={{
            ...styles.control,
            background: '#2B5797',
            color: '#FFFFFF',
            borderColor: '#2B5797',
            width: 'auto',
          }}
          onClick={() => {
            const condition = toCondition(row, filterType, column);
            onDateFinancialFilterEnabledChange(dateFinancialFilterDraft);
            onFilterInactiveRecordsEnabledChange(filterInactiveRecordsDraft);
            onApply(colId, condition, {
              scope: { option: scopeOption },
              searchType: { option: searchTypeOption },
            });
            onClose();
          }}
        >
          {translation('Apply')}
        </button>
      </div>
    </div>
  );
};
