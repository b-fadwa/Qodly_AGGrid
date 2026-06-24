import { CSSProperties, FC, useMemo, useState } from 'react';
import { GoTrash } from 'react-icons/go';
import { TbDecimal } from 'react-icons/tb';
import {
  MdAdd,
  MdCalendarToday,
  MdClose,
  MdDragIndicator,
  MdHelpOutline,
  MdLooksOne,
  MdOutlineCalendarMonth,
  MdOutlineFormatListBulleted,
  MdOutlinePrint,
  MdOutlineTableChart,
  MdTextFields,
  MdToggleOn,
} from 'react-icons/md';
import { resolveSimpleColumnTitle } from '../SimpleAgGrid/simpleAgGridColumns';
import {
  PrintFormatValue,
  PrintSettingsColumn,
  PrintSubtotalRule,
  SavedPrintFormat,
  SubtotalFunction,
  printColumnId,
  savedPrintFormatKey,
} from './PrintSettings.types';
import { DATE_FORMATS, SUBTOTAL_FUNCTIONS } from './PrintSettings.utils';

interface ResolvedColumn extends PrintSettingsColumn {
  colId: string;
  label: string;
}

type PrintSettingsI18n = { keys?: Record<string, Record<string, unknown>> } | null | undefined;
type AgGridTranslation = (key: string) => string;

interface PrintSettingsPanelProps {
  columns: PrintSettingsColumn[];
  value: PrintFormatValue;
  formats: SavedPrintFormat[];
  accentColor?: string;
  disabled?: boolean;
  i18n?: PrintSettingsI18n;
  lang?: string;
  style?: CSSProperties;
  className?: string;
  onChange: (value: PrintFormatValue) => void;
  onLoadFormat: (record: SavedPrintFormat) => void;
  onSaveFormat: (name: string, isDefault: boolean) => void;
  onUpdateFormat: (key: string, isDefault: boolean) => void;
  onDeleteFormat: (key: string) => void;
  onValidate: () => void;
  onCancel: () => void;
}

const cardClass = 'min-w-0 rounded-lg border bg-white';
const cardHeadingClass = 'flex items-center justify-between gap-2 border-b px-3 py-2';
const headingTitleClass = 'm-0 font-medium tracking-wide';
const headingTextClass = 'mt-1 block';
const inputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800 outline-none disabled:cursor-not-allowed disabled:opacity-50';
const buttonClass =
  'flex items-center justify-center rounded-md border bg-white px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50';
const selectClass =
  'w-full rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800 outline-none disabled:cursor-not-allowed disabled:opacity-50';
const emptyClass = 'px-3 py-4 text-center text-xs text-slate-400';
const labelCaptionClass = 'mb-1 block font-medium';

const borderStyle = { borderColor: '#E5E7EB' } as const;
const titleStyle = { color: '#0A0A0A', fontSize: '13px', fontWeight: 500 } as const;
const subtitleStyle = { color: '#4A5565', fontSize: '11px', lineHeight: 1.25 } as const;
const smallTitleStyle = { color: '#717182', fontWeight: 500, fontSize: '11px' } as const;
const labelStyle = { color: '#717182', fontSize: '11px', fontWeight: 500 } as const;
const inputStyle = {
  height: '31px',
  borderRadius: '6px',
  borderColor: '#0000001A',
  color: '#44444C',
  fontSize: '12px',
  fontWeight: 500,
} as const;
const buttonStyle = {
  height: '31px',
  borderRadius: '6px',
  borderColor: '#0000001A',
  color: '#44444C',
  fontSize: '12px',
  fontWeight: 500,
} as const;
const primaryButtonStyle = {
  background: '#2B5797',
  height: '31px',
  fontSize: '12px',
} as const;
const badgeStyle = {
  color: '#4A5565',
  backgroundColor: '#F3F3F5',
  borderColor: '#0000001A',
  fontSize: '10px',
  fontWeight: 650,
} as const;
const selectedOptionStyle = {
  color: '#2B5797',
  backgroundColor: '#F8FBFF',
  borderColor: '#6B8AD4',
  boxShadow: 'inset 0 0 0 1px rgba(107, 138, 212, 0.18)',
} as const;
const unselectedOptionStyle = {
  color: '#4A5565',
  backgroundColor: '#FAFAFA',
  borderColor: '#E5E7EB',
} as const;
const trashButtonStyle = {
  width: '31px',
  height: '31px',
  borderRadius: '8px',
  color: '#EC7B80',
  borderColor: '#EC7B80',
  backgroundColor: '#EC7B8033',
} as const;

function pickI18nString(entry: Record<string, unknown> | undefined, lang?: string): string | undefined {
  if (!entry) return undefined;
  const localized = lang ? entry[lang] : undefined;
  if (typeof localized === 'string' && localized.trim()) return localized;
  const fallback = entry.default;
  return typeof fallback === 'string' && fallback.trim() ? fallback : undefined;
}

function translateAgGridKey(i18n: PrintSettingsI18n, lang: string | undefined, key: string): string {
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

function getDateFormatTranslationKey(format: string) {
  switch (format) {
    case 'DD/MM/YYYY':
      return 'Date format DD MM YYYY';
    case 'DD-MM-YYYY':
      return 'Date format DD-MM-YYYY';
    case 'YYYY-MM-DD':
      return 'Date format YYYY-MM-DD';
    case 'MM/DD/YYYY':
      return 'Date format MM DD YYYY';
    case 'DD/MM/YYYY HH:mm':
      return 'Date format DD MM YYYY HH mm';
    case 'dddd D MMMM YYYY':
      return 'Date format weekday D month YYYY';
    default:
      return format;
  }
}

function getPrintColumnTypeLabel(dataType: string | undefined, translation: AgGridTranslation) {
  const dt = String(dataType ?? '')
    .trim()
    .toLowerCase();
  if (dt === 'number' || dt === 'real') return translation('Real');
  if (dt === 'integer') return translation('Int');
  if (dt === 'long') return translation('Long');
  if (dt === 'word') return translation('Word');
  if (dt === 'date') return translation('Date');
  if (dt === 'boolean' || dt === 'bool') return translation('Bool');
  if (dt === 'string' || dt === 'text') return translation('Text');
  return dt || translation('Type');
}

function PrintColumnTypeBadge({
  dataType,
  translation,
}: {
  dataType?: string;
  translation: AgGridTranslation;
}) {
  const dt = String(dataType ?? '')
    .trim()
    .toLowerCase();
  const Icon =
    dt === 'number' || dt === 'real'
      ? TbDecimal
      : dt === 'integer' || dt === 'long' || dt === 'word'
        ? MdLooksOne
        : dt === 'date'
          ? MdCalendarToday
          : dt === 'boolean' || dt === 'bool'
            ? MdToggleOn
            : dt === 'string' || dt === 'text'
              ? MdTextFields
              : MdHelpOutline;

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 leading-none"
      style={{
        color: '#64748B',
        backgroundColor: '#F8FAFC',
        borderColor: '#E2E8F0',
        fontSize: '10px',
        fontWeight: 600,
      }}
      title={dataType || translation('Type')}
    >
      <Icon size={12} />
      {getPrintColumnTypeLabel(dataType, translation)}
    </span>
  );
}

const PrintSettingsPanel: FC<PrintSettingsPanelProps> = ({
  columns,
  value,
  formats,
  disabled = false,
  i18n,
  lang,
  style,
  className,
  onChange,
  onLoadFormat,
  onSaveFormat,
  onUpdateFormat,
  onDeleteFormat,
  onValidate,
  onCancel,
}) => {
  const [search, setSearch] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    targetId: string;
    edge: 'before' | 'after';
  } | null>(null);
  const [selectedFormat, setSelectedFormat] = useState('');
  const [formatName, setFormatName] = useState('');

  const resolvedColumns = useMemo<ResolvedColumn[]>(
    () =>
      columns.map((column, index) => ({
        ...column,
        colId: printColumnId(column, index),
        label:
          resolveSimpleColumnTitle(column.title, i18n, lang) ||
          column.source ||
          `Column ${index + 1}`,
      })),
    [columns, i18n, lang],
  );
  const columnById = useMemo(
    () => new Map(resolvedColumns.map((column) => [column.colId, column])),
    [resolvedColumns],
  );
  const orderedColumns = value.columnState
    .map((state) => columnById.get(state.colId))
    .filter((column): column is ResolvedColumn => Boolean(column));
  const visibleIds = new Set(
    value.columnState.filter((state) => !state.hidden).map((state) => state.colId),
  );
  const filteredColumns = orderedColumns.filter((column) =>
    `${column.label} ${column.source}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const visibleDateColumns = orderedColumns.filter(
    (column) => visibleIds.has(column.colId) && column.dataType === 'date',
  );
  const visibleNumberColumns = orderedColumns.filter(
    (column) => visibleIds.has(column.colId) && column.dataType === 'number',
  );

  const updateColumnVisibility = (colId: string, visible: boolean) => {
    onChange({
      ...value,
      columnState: value.columnState.map((state) =>
        state.colId === colId ? { ...state, hidden: !visible } : state,
      ),
    });
  };

  const setFilteredVisibility = (visible: boolean) => {
    const filteredIds = new Set(filteredColumns.map((column) => column.colId));
    onChange({
      ...value,
      columnState: value.columnState.map((state) =>
        filteredIds.has(state.colId) ? { ...state, hidden: !visible } : state,
      ),
    });
  };

  const moveColumn = (sourceId: string, targetId: string, edge: 'before' | 'after' = 'before') => {
    if (!sourceId || sourceId === targetId) return;
    const next = [...value.columnState];
    const sourceIndex = next.findIndex((item) => item.colId === sourceId);
    const targetIndex = next.findIndex((item) => item.colId === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;
    const [moved] = next.splice(sourceIndex, 1);
    const nextTargetIndex = next.findIndex((item) => item.colId === targetId);
    next.splice(nextTargetIndex + (edge === 'after' ? 1 : 0), 0, moved);
    onChange({ ...value, columnState: next });
  };

  const updateSubtotal = (id: string, patch: Partial<PrintSubtotalRule>) => {
    onChange({
      ...value,
      subtotals: value.subtotals.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
    });
  };

  const addSubtotal = () => {
    const breakColumn = orderedColumns.find((column) => visibleIds.has(column.colId))?.colId || '';
    if (!breakColumn || visibleNumberColumns.length === 0) return;
    const rule: PrintSubtotalRule = {
      id: `subtotal-${Date.now()}-${value.subtotals.length}`,
      breakColumn,
      function: 'sum',
      targetColumns: [visibleNumberColumns[0].colId],
    };
    onChange({ ...value, subtotals: [...value.subtotals, rule] });
  };

  const handleSavedFormatSelection = (key: string) => {
    setSelectedFormat(key);
    if (!key) return;
    const record = formats.find((item) => savedPrintFormatKey(item) === key);
    if (!record) return;
    setFormatName(record.name || record.title || '');
    onLoadFormat(record);
  };
  const handleSaveOrUpdateFormat = () => {
    const trimmed = formatName.trim();
    if (trimmed) {
      const existing = formats.find(
        (record) => record.name === trimmed || record.title === trimmed,
      );
      if (existing) {
        onUpdateFormat(savedPrintFormatKey(existing), false);
      } else {
        onSaveFormat(trimmed, false);
      }
      setFormatName('');
      return;
    }
    if (selectedFormat) onUpdateFormat(selectedFormat, false);
  };
  const trimmedFormatName = formatName.trim();
  const matchingFormat = trimmedFormatName
    ? formats.find(
        (record) => record.name === trimmedFormatName || record.title === trimmedFormatName,
      )
    : null;
  const willUpdateFormat = Boolean(matchingFormat) || (!trimmedFormatName && !!selectedFormat);
  const canSaveOrUpdateFormat = Boolean(trimmedFormatName || selectedFormat);
  const t = (key: string) => translateAgGridKey(i18n, lang, key);
  const ta = (key: string, fallback: string) => translateAgGridAlias(t, key, fallback);
  const translateSubtotalFunction = (entry: (typeof SUBTOTAL_FUNCTIONS)[number]) => {
    if (entry.value === 'min') return ta('Min', entry.label);
    if (entry.value === 'max') return ta('Max', entry.label);
    return t(entry.label);
  };

  return (
    <section
      className={`flex h-full min-h-full w-full flex-col overflow-auto rounded-xl border bg-white font-sans ${className || ''}`}
      style={{ ...style, borderColor: '#D1D5DC', color: '#0A0A0A' }}
      aria-disabled={disabled}
    >
      {columns.length === 0 ? (
        <div
          className="flex flex-1 flex-col items-center justify-center gap-2 text-slate-400"
          style={{ minHeight: '390px' }}
        >
          <MdOutlinePrint className="mb-1" style={{ color: '#2B5797', fontSize: '38px' }} />
          <strong className="text-sm font-medium" style={{ color: '#364153' }}>
            {t('No columns configured')}
          </strong>
          <span className="text-xs">
            {t('Bind the table state/view datasource to discover printable fields.')}
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 p-2.5">
          <div className="flex flex-row gap-2.5">
            <article
              className={cardClass}
              style={{ ...borderStyle, flex: '1.15 1 360px', minWidth: 0 }}
            >
              <div className={cardHeadingClass} style={{ ...borderStyle, minHeight: '46px' }}>
                <div>
                  <h2 className={headingTitleClass} style={titleStyle}>
                    {ta('Columns', 'Columns to print')}
                  </h2>
                  <p className={headingTextClass} style={subtitleStyle}>
                    {t('Fields discovered from the bound table state.')}
                  </p>
                </div>
                <span
                  className="whitespace-nowrap rounded-full border px-2 py-1"
                  style={badgeStyle}
                >
                  {visibleIds.size} / {columns.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5 border-b bg-white p-2" style={borderStyle}>
                <input
                  className={`${inputClass} min-w-0 flex-1`}
                  style={inputStyle}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={ta('Search field', 'Search columns')}
                  disabled={disabled}
                />
                <button
                  type="button"
                  className={`${buttonClass} shrink-0 whitespace-nowrap`}
                  style={buttonStyle}
                  onClick={() => setFilteredVisibility(true)}
                  disabled={disabled}
                >
                  {t('Select all')}
                </button>
                <button
                  type="button"
                  className={`${buttonClass} shrink-0 whitespace-nowrap`}
                  style={{ ...buttonStyle, borderColor: '#6B8AD4', color: '#6B8AD4' }}
                  onClick={() => setFilteredVisibility(false)}
                  disabled={disabled}
                >
                  {t('Clear')}
                </button>
              </div>
              <div
                className="overflow-y-auto rounded-b-lg p-1.5"
                style={{ height: '292px', backgroundColor: '#FAFAFA' }}
              >
                {filteredColumns.map((column) => {
                  const visible = visibleIds.has(column.colId);
                  return (
                    <div
                      className={`relative flex items-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 transition hover:bg-slate-100 ${
                        dragging === column.colId ? 'opacity-45' : ''
                      }`}
                      style={{ minHeight: '26px' }}
                      key={column.colId}
                      draggable={!disabled}
                      onDragStart={(event) => {
                        const dragPreview = document.createElement('canvas');
                        dragPreview.width = 1;
                        dragPreview.height = 1;
                        event.dataTransfer.setDragImage(dragPreview, 0, 0);
                        setDragging(column.colId);
                        setDropIndicator(null);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setDropIndicator(null);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (!dragging || dragging === column.colId) {
                          setDropIndicator(null);
                          return;
                        }
                        const rect = event.currentTarget.getBoundingClientRect();
                        setDropIndicator({
                          targetId: column.colId,
                          edge: event.clientY < rect.top + rect.height / 2 ? 'before' : 'after',
                        });
                      }}
                      onDrop={() => {
                        if (dragging && dragging !== column.colId) {
                          moveColumn(
                            dragging,
                            column.colId,
                            dropIndicator?.targetId === column.colId ? dropIndicator.edge : 'before',
                          );
                        }
                        setDragging(null);
                        setDropIndicator(null);
                      }}
                    >
                      {dropIndicator?.targetId === column.colId && (
                        <span
                          className={`pointer-events-none absolute left-1 right-1 h-0.5 rounded-full ${
                            dropIndicator.edge === 'before' ? 'top-0' : 'bottom-0'
                          }`}
                          style={{ backgroundColor: '#2B5797' }}
                        />
                      )}
                      <MdDragIndicator className="shrink-0 cursor-grab text-sm text-slate-400" />
                      <label
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-1"
                        title={`${column.label} (${column.dataType || 'string'})`}
                      >
                        <input
                          className="h-3 w-3 disabled:cursor-not-allowed disabled:opacity-50"
                          style={{ accentColor: '#2B5797' }}
                          type="checkbox"
                          checked={visible}
                          disabled={disabled}
                          onChange={(event) =>
                            updateColumnVisibility(column.colId, event.target.checked)
                          }
                        />
                        <span
                          className="truncate text-left"
                          style={{ color: '#374151', fontSize: '12px', fontWeight: 400 }}
                        >
                          {column.label}
                        </span>
                      </label>
                      <PrintColumnTypeBadge dataType={column.dataType} translation={t} />
                    </div>
                  );
                })}
                {filteredColumns.length === 0 && (
                  <div className="px-3 py-7 text-center text-xs text-slate-400">
                    {ta('No fields match your filter', 'No matching columns')}
                  </div>
                )}
              </div>
            </article>

            <div className="flex flex-col gap-2.5" style={{ flex: '0.85 1 320px', minWidth: 0 }}>
              <article className={cardClass} style={borderStyle}>
                <div className={cardHeadingClass} style={{ ...borderStyle, minHeight: '46px' }}>
                  <div>
                    <h2 className={headingTitleClass} style={titleStyle}>
                      {t('Representation')}
                    </h2>
                    <p className={headingTextClass} style={subtitleStyle}>
                      {t('Select the report layout.')}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 p-2.5">
                  <label
                    className="relative flex cursor-pointer items-center gap-2 rounded-lg border p-2"
                    style={{
                      minHeight: '58px',
                      ...(value.representation === 'list'
                        ? selectedOptionStyle
                        : unselectedOptionStyle),
                    }}
                  >
                    <input
                      className="absolute right-2 top-2 h-3 w-3 disabled:cursor-not-allowed disabled:opacity-50 hidden"
                      style={{ accentColor: '#2B5797' }}
                      type="radio"
                      name="representation"
                      checked={value.representation === 'list'}
                      disabled={disabled}
                      onChange={() => onChange({ ...value, representation: 'list' })}
                    />
                    <MdOutlineFormatListBulleted className="shrink-0 text-xl" />
                    <span className="flex flex-col gap-0.5">
                      <strong className="text-xs font-medium" style={{ color: '#364153' }}>
                        {t('List representation')}
                      </strong>
                    </span>
                  </label>
                  <label
                    className="relative flex cursor-pointer items-center gap-2 rounded-lg border p-2"
                    style={{
                      minHeight: '58px',
                      ...(value.representation === 'table'
                        ? selectedOptionStyle
                        : unselectedOptionStyle),
                    }}
                  >
                    <input
                      className="absolute right-2 top-2 h-3 w-3 disabled:cursor-not-allowed disabled:opacity-50 hidden"
                      style={{ accentColor: '#2B5797' }}
                      type="radio"
                      name="representation"
                      checked={value.representation === 'table'}
                      disabled={disabled}
                      onChange={() =>
                        onChange({ ...value, representation: 'table', subtotals: [] })
                      }
                    />
                    <MdOutlineTableChart className="shrink-0 text-xl" />
                    <span className="flex flex-col gap-0.5">
                      <strong className="text-xs font-medium" style={{ color: '#364153' }}>
                        {t('Table representation')}
                      </strong>
                    </span>
                  </label>
                </div>
              </article>

              <article className={cardClass} style={borderStyle}>
                <div className={cardHeadingClass} style={{ ...borderStyle, minHeight: '46px' }}>
                  <div>
                    <h2 className={headingTitleClass} style={titleStyle}>
                      {t('Date formats')}
                    </h2>
                    <p className={headingTextClass} style={subtitleStyle}>
                      {t('Set the display format for date fields.')}
                    </p>
                  </div>
                  <MdOutlineCalendarMonth className="text-xl" style={{ color: '#6A7282' }} />
                </div>
                <div className="overflow-y-auto px-2.5 pb-2 pt-1.5" style={{ maxHeight: '126px' }}>
                  {visibleDateColumns.map((column) => (
                    <label
                      className="grid grid-cols-2 items-center gap-2 border-b border-slate-100 text-xs last:border-b-0"
                      style={{ minHeight: '34px', color: '#364153' }}
                      key={column.colId}
                    >
                      <span>{column.label}</span>
                      <select
                        className={selectClass}
                        style={inputStyle}
                        value={value.dateFormats[column.colId] || DATE_FORMATS[0]}
                        disabled={disabled}
                        onChange={(event) =>
                          onChange({
                            ...value,
                            dateFormats: {
                              ...value.dateFormats,
                              [column.colId]: event.target.value,
                            },
                          })
                        }
                      >
                        {DATE_FORMATS.map((format) => (
                          <option value={format} key={format}>
                            {ta(getDateFormatTranslationKey(format), format)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                  {visibleDateColumns.length === 0 && (
                    <div className={emptyClass}>
                      {t('Select a date column to configure its format.')}
                    </div>
                  )}
                </div>
              </article>
            </div>
          </div>

          {value.representation === 'list' && (
            <article className={cardClass} style={borderStyle}>
              <div className={cardHeadingClass} style={{ ...borderStyle, minHeight: '46px' }}>
                <div>
                  <h2 className={headingTitleClass} style={titleStyle}>
                    {t('Subtotals')}
                  </h2>
                  <p className={headingTextClass} style={subtitleStyle}>
                    {t('Add calculations when the value of a grouping column changes.')}
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ ...primaryButtonStyle, borderColor: '#2B5797' }}
                  onClick={addSubtotal}
                  disabled={disabled || visibleNumberColumns.length === 0}
                >
                  <MdAdd /> {t('Add subtotal')}
                </button>
              </div>
              {visibleNumberColumns.length === 0 ? (
                <div className={emptyClass}>
                  {t('Select at least one real-number column to enable subtotals.')}
                </div>
              ) : value.subtotals.length === 0 ? (
                <div className={emptyClass}>
                  {t('No subtotal rules. Add one when the report needs grouped calculations.')}
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 p-2">
                  {value.subtotals.map((rule, index) => (
                    <div
                      className="flex flex-wrap items-end gap-2 rounded-lg border px-2 py-1.5"
                      style={{ borderColor: '#D1D5DC', backgroundColor: '#FAFAFA' }}
                      key={rule.id}
                    >
                      <div
                        className="mb-0.5 grid shrink-0 place-items-center rounded-md border font-bold"
                        style={{ ...badgeStyle, width: '22px', height: '22px' }}
                      >
                        {index + 1}
                      </div>
                      <label className="min-w-0" style={{ flex: '1 1 190px' }}>
                        <span className={labelCaptionClass} style={labelStyle}>
                          {t('At each change in')}
                        </span>
                        <select
                          className={selectClass}
                          style={inputStyle}
                          value={rule.breakColumn}
                          disabled={disabled}
                          onChange={(event) =>
                            updateSubtotal(rule.id, { breakColumn: event.target.value })
                          }
                        >
                          {orderedColumns
                            .filter((column) => visibleIds.has(column.colId))
                            .map((column) => (
                              <option key={column.colId} value={column.colId}>
                                {column.label}
                              </option>
                            ))}
                        </select>
                      </label>
                      <label className="min-w-0" style={{ flex: '0 1 160px' }}>
                        <span className={labelCaptionClass} style={labelStyle}>
                          {t('Function')}
                        </span>
                        <select
                          className={selectClass}
                          style={inputStyle}
                          value={rule.function}
                          disabled={disabled}
                          onChange={(event) =>
                            updateSubtotal(rule.id, {
                              function: event.target.value as SubtotalFunction,
                            })
                          }
                        >
                          {SUBTOTAL_FUNCTIONS.map((entry) => (
                            <option key={entry.value} value={entry.value}>
                              {translateSubtotalFunction(entry)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <fieldset className="m-0 min-w-0 border-0 p-0" style={{ flex: '2 1 260px' }}>
                        <legend className={labelCaptionClass} style={labelStyle}>
                          {t('Apply to real-number columns')}
                        </legend>
                        <div
                          className="flex min-h-[31px] flex-wrap items-center gap-x-2 gap-y-1 overflow-y-auto rounded-md border bg-white px-1.5 py-1"
                          style={{ maxHeight: '58px', borderColor: '#0000001A' }}
                        >
                          {visibleNumberColumns.map((column) => (
                            <label
                              className="flex min-w-0 cursor-pointer items-center gap-1"
                              style={{ color: '#364153', fontSize: '11px' }}
                              key={column.colId}
                            >
                              <input
                                className="h-3 w-3 disabled:cursor-not-allowed disabled:opacity-50"
                                style={{ accentColor: '#2B5797' }}
                                type="checkbox"
                                checked={rule.targetColumns.includes(column.colId)}
                                disabled={disabled}
                                onChange={(event) =>
                                  updateSubtotal(rule.id, {
                                    targetColumns: event.target.checked
                                      ? [...rule.targetColumns, column.colId]
                                      : rule.targetColumns.filter((id) => id !== column.colId),
                                  })
                                }
                              />
                              <span className="truncate">{column.label}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                      <button
                        type="button"
                        className="grid shrink-0 place-items-center rounded-lg border p-0 text-base disabled:cursor-not-allowed disabled:opacity-50"
                        style={trashButtonStyle}
                        aria-label={ta('Remove', 'Remove subtotal')}
                        disabled={disabled}
                        onClick={() =>
                          onChange({
                            ...value,
                            subtotals: value.subtotals.filter((item) => item.id !== rule.id),
                          })
                        }
                      >
                        <MdClose />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </article>
          )}

          <article className="rounded-lg border bg-white" style={borderStyle}>
            <div className="flex flex-row flex-wrap gap-1 px-4 py-3">
              <div
                className="flex min-w-0 flex-col gap-2 rounded-lg bg-white p-1"
                style={{ flex: '0 1 300px' }}
              >
                <span style={smallTitleStyle}>{t('Save format')}</span>
                <div className="flex gap-2">
                  <input
                    className="rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-800 outline-none disabled:cursor-not-allowed disabled:opacity-50 w-full"
                    style={{ ...inputStyle, minWidth: '180px' }}
                    value={formatName}
                    disabled={disabled}
                    placeholder={t('Format name')}
                    onChange={(event) => setFormatName(event.target.value)}
                  />
                </div>
              </div>
              <div
                className="flex min-w-0 flex-col gap-2 rounded-lg bg-white p-1"
                style={{ flex: '1 1 520px' }}
              >
                <span style={smallTitleStyle}>{t('Saved formats')}</span>
                <div className="flex gap-2">
                  <select
                    className="rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-800 outline-none disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ ...inputStyle, minWidth: '250px' }}
                    value={selectedFormat}
                    disabled={disabled}
                    onChange={(event) => handleSavedFormatSelection(event.target.value)}
                  >
                    <option value="">{t('Select format')}</option>
                    {formats.map((record) => (
                      <option value={savedPrintFormatKey(record)} key={savedPrintFormatKey(record)}>
                        {record.name || record.title || record.id}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="header-button-trash inline-flex items-center justify-center rounded-lg border"
                    style={trashButtonStyle}
                    aria-label={ta('Delete', 'Delete format')}
                    disabled={disabled || !selectedFormat}
                    onClick={() => onDeleteFormat(selectedFormat)}
                  >
                    <GoTrash size={14} />
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                    style={buttonStyle}
                    disabled={disabled || !canSaveOrUpdateFormat}
                    onClick={handleSaveOrUpdateFormat}
                  >
                    {willUpdateFormat ? t('Update') : t('Save')}
                  </button>
                </div>
              </div>
            </div>
          </article>
        </div>
      )}

      <footer
        className="flex w-full shrink-0 items-center justify-end gap-2 border-t bg-white p-4"
        style={borderStyle}
      >
        <button
          type="button"
          className="flex items-center justify-center rounded-md border px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
          style={buttonStyle}
          onClick={onCancel}
          disabled={disabled}
        >
          {t('Cancel')}
        </button>
        <button
          type="button"
          className="flex items-center justify-center rounded-md border px-3 py-2 text-center text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
          style={{ ...primaryButtonStyle, borderColor: '#2B5797' }}
          onClick={onValidate}
          disabled={disabled || columns.length === 0 || visibleIds.size === 0}
        >
          {t('Print')}
        </button>
      </footer>
    </section>
  );
};

export default PrintSettingsPanel;
