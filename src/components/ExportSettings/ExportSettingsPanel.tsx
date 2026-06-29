import { CSSProperties, FC, useMemo, useState } from 'react';
import { GoTrash } from 'react-icons/go';
import { TbDecimal } from 'react-icons/tb';
import {
  MdCalendarToday,
  MdDragIndicator,
  MdHelpOutline,
  MdLooksOne,
  MdOutlineFileDownload,
  MdTextFields,
  MdToggleOn,
} from 'react-icons/md';
import { resolveSimpleColumnTitle } from '../SimpleAgGrid/simpleAgGridColumns';
import type { ExportExtension, ExportFormatValue, ExportSettingsColumn, SavedExportFormat } from './ExportSettings.types';
import { exportColumnId, savedExportFormatKey } from './ExportSettings.types';

interface ResolvedColumn extends ExportSettingsColumn {
  colId: string;
  label: string;
}

type ExportSettingsI18n = { keys?: Record<string, Record<string, unknown>> } | null | undefined;
type AgGridTranslation = (key: string) => string;

const SKIPPED_EXPORT_COLUMN_IDS = new Set(['ag-Grid-SelectionColumn']);
const EXPORT_EXTENSIONS: ExportExtension[] = ['CSV', 'TXT', 'XML'];

interface ExportSettingsPanelProps {
  columns: ExportSettingsColumn[];
  value: ExportFormatValue;
  exports: SavedExportFormat[];
  accentColor?: string;
  disabled?: boolean;
  i18n?: ExportSettingsI18n;
  lang?: string;
  style?: CSSProperties;
  className?: string;
  onChange: (value: ExportFormatValue) => void;
  onLoadExport: (record: SavedExportFormat) => void;
  onSaveExport: (name: string, isDefault: boolean) => void;
  onUpdateExport: (key: string, isDefault: boolean) => void;
  onDeleteExport: (key: string) => void;
  onHelp: () => void;
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

const borderStyle = { borderColor: '#E5E7EB' } as const;
const titleStyle = { color: '#0A0A0A', fontSize: '13px', fontWeight: 500 } as const;
const subtitleStyle = { color: '#4A5565', fontSize: '11px', lineHeight: 1.25 } as const;
const smallTitleStyle = { color: '#717182', fontWeight: 500, fontSize: '11px' } as const;
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
const trashButtonStyle = {
  width: '31px',
  height: '31px',
  borderRadius: '8px',
  color: '#EC7B80',
  borderColor: '#EC7B80',
  backgroundColor: '#EC7B8033',
} as const;
const optionsCardStyle = {
  backgroundColor: '#F3F4F6',
  borderColor: '#E5E7EB',
} as const;

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

function translateExportKey(
  i18n: ExportSettingsI18n,
  lang: string | undefined,
  key: string,
  fallback: string,
): string {
  return pickI18nString(i18n?.keys?.[key], lang) ?? fallback;
}

function translateAgGridKey(
  i18n: ExportSettingsI18n,
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

function getExportColumnTypeLabel(dataType: string | undefined, translation: AgGridTranslation) {
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

function ExportColumnTypeBadge({
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
      {getExportColumnTypeLabel(dataType, translation)}
    </span>
  );
}

const ExportSettingsPanel: FC<ExportSettingsPanelProps> = ({
  columns,
  value,
  exports,
  disabled = false,
  i18n,
  lang,
  style,
  className,
  onChange,
  onLoadExport,
  onSaveExport,
  onUpdateExport,
  onDeleteExport,
  onHelp,
  onValidate,
  onCancel,
}) => {
  const [search, setSearch] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    targetId: string;
    edge: 'before' | 'after';
  } | null>(null);
  const [selectedExport, setSelectedExport] = useState('');
  const [exportName, setExportName] = useState('');

  const resolvedColumns = useMemo<ResolvedColumn[]>(
    () =>
      columns.map((column, index) => ({
        ...column,
        colId: exportColumnId(column, index),
        label:
          resolveSimpleColumnTitle(column.title, i18n, lang) ||
          column.source ||
          `Column ${index + 1}`,
      })),
    [columns, i18n, lang],
  );
  const exportableColumns = resolvedColumns.filter(
    (column) => !SKIPPED_EXPORT_COLUMN_IDS.has(column.colId),
  );
  const columnById = useMemo(
    () => new Map(exportableColumns.map((column) => [column.colId, column])),
    [exportableColumns],
  );
  const orderedColumns = value.columnState
    .map((state) => columnById.get(state.colId))
    .filter((column): column is ResolvedColumn => Boolean(column));
  const visibleIds = new Set(
    value.columnState
      .filter((state) => !state.hidden && columnById.has(state.colId))
      .map((state) => state.colId),
  );
  const filteredColumns = orderedColumns.filter((column) =>
    `${column.label} ${column.source}`.toLowerCase().includes(search.trim().toLowerCase()),
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

  const handleSavedExportSelection = (key: string) => {
    setSelectedExport(key);
    if (!key) return;
    const record = exports.find((item) => savedExportFormatKey(item) === key);
    if (!record) return;
    setExportName(record.name || record.title || '');
    onLoadExport(record);
  };

  const handleSaveOrUpdateExport = () => {
    const trimmed = exportName.trim();
    if (trimmed) {
      const existing = exports.find(
        (record) => record.name === trimmed || record.title === trimmed,
      );
      if (existing) {
        onUpdateExport(savedExportFormatKey(existing), false);
      } else {
        onSaveExport(trimmed, false);
      }
      setExportName('');
      return;
    }
    if (selectedExport) onUpdateExport(selectedExport, false);
  };

  const trimmedExportName = exportName.trim();
  const matchingExport = trimmedExportName
    ? exports.find(
        (record) => record.name === trimmedExportName || record.title === trimmedExportName,
      )
    : null;
  const willUpdateExport = Boolean(matchingExport) || (!trimmedExportName && !!selectedExport);
  const canSaveOrUpdateExport = Boolean(trimmedExportName || selectedExport);

  const t = (key: string) => translateAgGridKey(i18n, lang, key);
  const ta = (key: string, fallback: string) => translateAgGridAlias(t, key, fallback);
  const te = (key: string, fallback: string) => translateExportKey(i18n, lang, key, fallback);

  return (
    <section
      className={`flex h-full min-h-full w-full flex-col overflow-auto bg-white gap-2 ${className || ''}`}
      style={{ ...style, color: '#0A0A0A' }}
      aria-disabled={disabled}
    >
      {columns.length === 0 ? (
        <div
          className="flex flex-1 flex-col items-center justify-center gap-1 text-slate-400"
          style={{ minHeight: '390px' }}
        >
          <MdOutlineFileDownload className="mb-1" style={{ color: '#2B5797', fontSize: '38px' }} />
          <strong className="text-sm font-medium" style={{ color: '#364153' }}>
            {t('No columns configured')}
          </strong>
          <span className="text-xs">
            {t('Bind the table state/view datasource to discover exportable fields.')}
          </span>
        </div>
      ) : (
        <div
          className="flex flex-col gap-2.5 p-2.5 rounded-xl border m-2"
          style={{ borderColor: '#D1D5DC' }}
        >
          <div className="flex flex-row gap-2.5">
            <article
              className={cardClass}
              style={{ ...borderStyle, flex: '1.15 1 360px', minWidth: 0 }}
            >
              <div className={cardHeadingClass} style={{ ...borderStyle, minHeight: '46px' }}>
                <div>
                  <h2 className={headingTitleClass} style={titleStyle}>
                    {ta('Columns', 'Columns to export')}
                  </h2>
                  <p className={headingTextClass} style={subtitleStyle}>
                    {t('Fields discovered from the bound table state.')}
                  </p>
                </div>
                <span
                  className="whitespace-nowrap rounded-full border px-2 py-1"
                  style={badgeStyle}
                >
                  {visibleIds.size} / {exportableColumns.length}
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
                            dropIndicator?.targetId === column.colId
                              ? dropIndicator.edge
                              : 'before',
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
                      <ExportColumnTypeBadge dataType={column.dataType} translation={t} />
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
              <article
                className="min-w-0 rounded-lg border p-3"
                style={optionsCardStyle}
              >
                <h2 className={headingTitleClass} style={{ ...titleStyle, marginBottom: '12px' }}>
                  {te('options', 'Options')}
                </h2>
                <div className="flex flex-col gap-3">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      className="h-3.5 w-3.5 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ accentColor: '#2B5797' }}
                      type="checkbox"
                      checked={value.exportHeaderNames}
                      disabled={disabled}
                      onChange={(event) =>
                        onChange({ ...value, exportHeaderNames: event.target.checked })
                      }
                    />
                    <span style={{ color: '#374151', fontSize: '12px', fontWeight: 400 }}>
                      {te('name_of_champs_en_entete', 'Nom des champs en entête')}
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      className="h-3.5 w-3.5 disabled:cursor-not-allowed disabled:opacity-50"
                      style={{ accentColor: '#2B5797' }}
                      type="checkbox"
                      checked={value.exportUppercase}
                      disabled={disabled}
                      onChange={(event) =>
                        onChange({ ...value, exportUppercase: event.target.checked })
                      }
                    />
                    <span style={{ color: '#374151', fontSize: '12px', fontWeight: 400 }}>
                      {te('conversion_en_majuscules', 'Conversion en MAJUSCULES')}
                    </span>
                  </label>
                  <div className="flex items-center justify-between gap-3">
                    <span style={{ color: '#374151', fontSize: '12px', fontWeight: 400 }}>
                      {te('extension_of_document', 'Extension du document')}
                    </span>
                    <select
                      className={`${selectClass} shrink-0`}
                      style={{
                        ...inputStyle,
                        width: '96px',
                        borderColor: '#6B8AD4',
                      }}
                      value={value.exportExtension}
                      disabled={disabled}
                      onChange={(event) =>
                        onChange({
                          ...value,
                          exportExtension: event.target.value as ExportExtension,
                        })
                      }
                    >
                      {EXPORT_EXTENSIONS.map((extension) => (
                        <option value={extension} key={extension}>
                          {extension}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </article>

              <article className="rounded-lg border bg-white" style={borderStyle}>
                <div className="flex flex-col gap-3 px-3 py-3">
                  <div className="flex min-w-0 flex-col gap-2">
                    <span style={smallTitleStyle}>{t('Save export')}</span>
                    <input
                      className="rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-800 outline-none disabled:cursor-not-allowed disabled:opacity-50 w-full"
                      style={inputStyle}
                      value={exportName}
                      disabled={disabled}
                      placeholder={t('Export name')}
                      onChange={(event) => setExportName(event.target.value)}
                    />
                  </div>
                  <div className="flex min-w-0 flex-col gap-2">
                    <span style={smallTitleStyle}>{t('Saved exports')}</span>
                    <div className="flex gap-2">
                      <select
                        className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-1 text-sm text-gray-800 outline-none disabled:cursor-not-allowed disabled:opacity-50"
                        style={inputStyle}
                        value={selectedExport}
                        disabled={disabled}
                        onChange={(event) => handleSavedExportSelection(event.target.value)}
                      >
                        <option value="">{t('Select export')}</option>
                        {exports.map((record) => (
                          <option value={savedExportFormatKey(record)} key={savedExportFormatKey(record)}>
                            {record.name || record.title || record.id}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="header-button-trash inline-flex shrink-0 items-center justify-center rounded-lg border"
                        style={trashButtonStyle}
                        aria-label={ta('Delete', 'Delete export')}
                        disabled={disabled || !selectedExport}
                        onClick={() => onDeleteExport(selectedExport)}
                      >
                        <GoTrash size={14} />
                      </button>
                      <button
                        type="button"
                        className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm font-medium text-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                        style={buttonStyle}
                        disabled={disabled || !canSaveOrUpdateExport}
                        onClick={handleSaveOrUpdateExport}
                      >
                        {willUpdateExport ? t('Update') : t('Save')}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </div>
      )}

      <footer
        className="flex w-full shrink-0 items-center justify-end gap-2 p-4"
        style={{ backgroundColor: '#F9FAFB' }}
      >
        <button
          type="button"
          className="flex items-center justify-center gap-2 px-3 py-2 text-center text-sm disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            ...primaryButtonStyle,
            borderRadius: '6px',
            border: '1px solid var(--info-font-color)',
            color: 'var(--info-font-color)',
            backgroundColor: 'transparent',
          }}
          onClick={onHelp}
          disabled={disabled || columns.length === 0 || visibleIds.size === 0}
        >
          <MdHelpOutline size={16} aria-hidden="true" />
          {t('Informations')}
        </button>
        <button
          type="button"
          className="flex items-center justify-center px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            ...buttonStyle,
            color: '#EC7B80',
            borderRadius: '6px',
            border: '1px solid #EC7B80',
          }}
          onClick={onCancel}
          disabled={disabled}
        >
          {t('Cancel')}
        </button>
        <button
          type="button"
          className="flex items-center justify-center px-3 py-2 text-center text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
          style={{ ...primaryButtonStyle, borderRadius: '6px', border: '1px solid #2B5797' }}
          onClick={onValidate}
          disabled={disabled || columns.length === 0 || visibleIds.size === 0}
        >
          {te('exporter', 'Export')}
        </button>
      </footer>
    </section>
  );
};

export default ExportSettingsPanel;
