import { FC, useMemo, useState } from 'react';
import { IoMdClose } from 'react-icons/io';
import { GoTrash } from 'react-icons/go';
import type { IColumn } from '../AgGrid.config';
import type { SavedFilter } from '../state/types';
import type { Translation } from '../state/sorts';

interface FilterDialogProps {
  open: boolean;
  onClose: () => void;
  translation: Translation;
  columns: IColumn[];
  /** Current live filter model as read from the grid, used for the preview panel. */
  currentFilterModel: any;
  /** Clear every column filter in the grid. */
  onClear: () => void;
  savedFilters: SavedFilter[];
  saveFilter: (name: string) => void;
  loadFilter: (key: string) => void;
  updateFilter: (key: string) => void;
  deleteFilter: (key: string) => void;
  loadFiltersList: () => void;
}

/**
 * Summarize a single column-filter-model entry as a human string.
 * This dialog is not a column-filter editor (use the per-column filter popup for that) —
 * it manages _named_ filter sets built out of the grid's current state.
 */
function formatFilterEntry(filter: any): string {
  if (!filter || typeof filter !== 'object') return '';
  if (Array.isArray(filter.conditions)) {
    const op = filter.operator ? ` ${filter.operator} ` : ' AND ';
    return filter.conditions.map((c: any) => formatSingleCondition(c)).filter(Boolean).join(op);
  }
  return formatSingleCondition(filter);
}

function formatSingleCondition(filter: any): string {
  if (!filter || typeof filter !== 'object') return '';
  const type = filter.type ?? '';
  const filterType = filter.filterType ?? '';
  const value =
    filter.filter ?? filter.dateFrom ?? filter.value ?? '';
  const valueTo = filter.filterTo ?? filter.dateTo ?? '';
  const label = type || filterType || '';
  if (valueTo) return `${label} [${value} → ${valueTo}]`;
  if (value !== '' && value != null) return `${label} "${value}"`;
  return label;
}

export const FilterDialog: FC<FilterDialogProps> = ({
  open,
  onClose,
  translation,
  columns,
  currentFilterModel,
  onClear,
  savedFilters,
  saveFilter,
  loadFilter,
  updateFilter,
  deleteFilter,
  loadFiltersList,
}) => {
  const [filterName, setFilterName] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('');

  const activeEntries = useMemo(() => {
    const model = currentFilterModel;
    if (!model || typeof model !== 'object') return [];
    return Object.keys(model).map((colKey) => {
      const col = columns.find(
        (c) => c.title === colKey || c.source === colKey || String(c.id ?? '') === colKey,
      );
      return {
        colKey,
        label: col?.title ?? colKey,
        summary: formatFilterEntry(model[colKey]),
      };
    });
  }, [columns, currentFilterModel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 rounded-t-xl">
          <div>
            <span
              className="text-sm tracking-wide"
              style={{ color: '#0A0A0A', fontSize: '21px', fontWeight: 500 }}
            >
              {translation('ADVANCED FILTERING')}
            </span>
            <span
              className="mt-1 block text-sm"
              style={{ color: '#4A5565', fontSize: '14px' }}
            >
              {translation(
                'Review current column filters and manage named filter sets',
              )}
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

        <div className="px-5 py-4">
          <div
            className="rounded-lg border p-3"
            style={{ borderColor: '#D1D5DC', backgroundColor: '#FAFAFA' }}
          >
            <div
              className="mb-2"
              style={{ color: '#717182', fontWeight: 500, fontSize: '11px' }}
            >
              {translation('Current filter')}
            </div>
            {activeEntries.length === 0 ? (
              <div className="text-sm text-slate-600">
                {translation('No active column filters')}
              </div>
            ) : (
              <ul className="space-y-1">
                {activeEntries.map((entry) => (
                  <li
                    key={entry.colKey}
                    className="flex items-center justify-between text-sm"
                    style={{ color: '#364153' }}
                  >
                    <span className="font-medium">{entry.label}</span>
                    <span className="text-slate-500">{entry.summary}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div
          className="px-5 py-3 flex flex-col gap-3"
          style={{ borderTop: '1px solid #E5E7EB' }}
        >
          <span
            style={{ color: '#717182', fontWeight: 500, fontSize: '11px' }}
          >
            {translation('Saved filters')}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder={translation('Filter name')}
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1"
              style={{
                height: '31px',
                borderRadius: '6px',
                borderColor: '#0000001A',
                color: '#44444C',
                fontSize: '12px',
              }}
            />
            <button
              type="button"
              className="rounded-lg border border-gray-300 bg-white px-2 py-1"
              style={{
                height: '31px',
                borderRadius: '6px',
                borderColor: '#0000001A',
                color: '#44444C',
                fontSize: '12px',
                fontWeight: 500,
              }}
              onClick={() => {
                const name = filterName.trim();
                if (!name) return;
                saveFilter(name);
                setFilterName('');
              }}
            >
              {translation('Save new')}
            </button>
            <select
              value={selectedFilter}
              onChange={(e) => {
                const next = e.target.value;
                setSelectedFilter(next);
                if (next) loadFilter(next);
              }}
              className="rounded-lg border border-gray-300 px-2 py-1"
              style={{
                height: '31px',
                borderRadius: '6px',
                borderColor: '#0000001A',
                color: '#44444C',
                fontSize: '12px',
              }}
            >
              <option value="">{translation('Select filter')}</option>
              {savedFilters.map((record) => (
                <option key={record.name} value={record.name}>
                  {record.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="rounded-lg border border-gray-300 bg-white px-2 py-1"
              style={{
                height: '31px',
                borderRadius: '6px',
                borderColor: '#0000001A',
                color: '#44444C',
                fontSize: '12px',
              }}
              onClick={() => {
                if (!selectedFilter) return;
                updateFilter(selectedFilter);
              }}
            >
              {translation('Update')}
            </button>
            <button
              type="button"
              className="rounded-lg border border-gray-300 bg-white px-2 py-1"
              style={{
                height: '31px',
                borderRadius: '6px',
                borderColor: '#0000001A',
                color: '#44444C',
                fontSize: '12px',
              }}
              onClick={loadFiltersList}
              title={translation('Reload list')}
            >
              {translation('Load list')}
            </button>
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
                if (!selectedFilter) return;
                deleteFilter(selectedFilter);
              }}
              title={translation('Delete')}
            >
              <GoTrash size={14} />
            </button>
          </div>
        </div>

        <div
          className="flex justify-end items-center gap-2 w-full p-4"
          style={{ borderTop: '1px solid #E5E7EB' }}
        >
          <button
            type="button"
            className="rounded-md border px-3 py-2 flex items-center justify-center"
            style={{
              height: '31px',
              borderRadius: '6px',
              borderColor: '#0000001A',
              color: '#44444C',
              fontSize: '12px',
            }}
            onClick={() => {
              onClear();
            }}
          >
            {translation('Clear')}
          </button>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm text-white flex text-center items-center justify-center"
            onClick={onClose}
            style={{
              background: '#2B5797',
              height: '31px',
              fontSize: '12px',
            }}
          >
            {translation('Close')}
          </button>
        </div>
      </div>
    </div>
  );
};
