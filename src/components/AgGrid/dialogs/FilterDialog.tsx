import { FC, useEffect, useMemo, useRef, useState } from 'react';
import { IoMdClose } from 'react-icons/io';
import { GoTrash } from 'react-icons/go';
import type { IColumn } from '../AgGrid.config';
import type { SavedFilter, SavedSort } from '../state/types';
import type { Translation } from '../state/sorts';
import { isHiddenIdColumn } from '../state/gridState';
import { QueryBuilder, type QueryBuilderHandle } from './QueryBuilder';

interface FilterDialogProps {
  open: boolean;
  onClose: () => void;
  translation: Translation;
  i18n?: any;
  lang?: string;
  columns: IColumn[];
  showDateFinancialToggle: boolean;
  dateFinancialFilterEnabled: boolean;
  onDateFinancialFilterEnabledChange: (enabled: boolean) => void;
  showFilterInactiveRecordsToggle: boolean;
  filterInactiveRecordsEnabled: boolean;
  onFilterInactiveRecordsEnabledChange: (enabled: boolean) => void;
  /** AG Grid `getFilterModel()` snapshot — kept in sync with the header filter via `onFilterChanged`. */
  filterModel: any;
  /** Push a new filterModel back to AG Grid (typically `gridApi.setFilterModel`). */
  setFilterModel: (next: any) => void;
  savedFilters: SavedFilter[];
  savedSorts: SavedSort[];
  saveFilter: (name: string, options?: { isDefault?: boolean; linkedSort?: string }) => void;
  loadFilter: (key: string) => void;
  updateFilter: (key: string, options?: { isDefault?: boolean; linkedSort?: string }) => void;
  deleteFilter: (key: string) => void;
  /**
   * Currently selected saved filter — owned by the parent so that an
   * auto-applied default (via `tryApplyDefault`) is reflected in the dropdown
   * even before the user opens the dialog.
   */
  selectedFilter: string;
  setSelectedFilter: (next: string) => void;
}

export const FilterDialog: FC<FilterDialogProps> = ({
  open,
  onClose,
  translation,
  i18n,
  lang,
  columns,
  showDateFinancialToggle,
  dateFinancialFilterEnabled,
  onDateFinancialFilterEnabledChange,
  showFilterInactiveRecordsToggle,
  filterInactiveRecordsEnabled,
  onFilterInactiveRecordsEnabledChange,
  filterModel,
  setFilterModel,
  savedFilters,
  savedSorts,
  saveFilter,
  loadFilter,
  updateFilter,
  deleteFilter,
  selectedFilter,
  setSelectedFilter,
}) => {
  const [filterName, setFilterName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [linkedSort, setLinkedSort] = useState('');
  const queryBuilderRef = useRef<QueryBuilderHandle>(null);

  useEffect(() => {
    if (!selectedFilter) {
      setIsDefault(false);
      setLinkedSort('');
      return;
    }
    const record = savedFilters.find(
      (r) =>
        r.name === selectedFilter ||
        r.title === selectedFilter ||
        (r.id != null && String(r.id) === selectedFilter),
    );
    setIsDefault(Boolean(record?.isDefault));
    setLinkedSort(record?.linkedSort ?? '');
  }, [selectedFilter, savedFilters]);

  /**
   * Hide internal id columns from the column picker (Feature 3) — they still
   * render in the grid because the data is needed, but the user shouldn't
   * be able to filter on them via the advanced filter modal.
   */
  const visibleColumns = useMemo(() => columns.filter((c) => !isHiddenIdColumn(c)), [columns]);

  /**
   * Single Save/Update button (Feature 1):
   *   - typed name matches an existing record  → update that record
   *   - typed name is new                      → save a brand-new record
   *   - input empty + a saved filter selected  → update the selected one
   *   - otherwise                              → no-op (button disabled)
   */
  const trimmedName = filterName.trim();
  const matchingExisting = trimmedName
    ? savedFilters.find((r) => r.name === trimmedName || r.title === trimmedName)
    : null;
  const willUpdateExisting = Boolean(matchingExisting) || (!trimmedName && !!selectedFilter);
  const saveButtonDisabled = !trimmedName && !selectedFilter;
  const handleSavePressed = () => {
    if (saveButtonDisabled) return;
    if (trimmedName) {
      if (matchingExisting) {
        updateFilter(matchingExisting.name, { isDefault });
      } else {
        saveFilter(trimmedName, { isDefault, linkedSort });
      }
    } else if (selectedFilter) {
      updateFilter(selectedFilter, { isDefault, linkedSort });
    }
    setFilterName('');
    if (!selectedFilter) {
      setIsDefault(false);
      setLinkedSort('');
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 rounded-t-xl">
          <div>
            <span
              className="tracking-wide"
              style={{ color: '#0A0A0A', fontSize: '16px', fontWeight: 500 }}
            >
              {translation('Advanced filtering')}
            </span>
            <span className="mt-1 block text-sm" style={{ color: '#4A5565', fontSize: '14px' }}>
              {translation('Edit the same filters as the column popups')}
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

        <div className="px-5 py-4" style={{ overflowY: 'auto' }}>
          <QueryBuilder
            ref={queryBuilderRef}
            deferEmit
            translation={translation}
            columns={visibleColumns}
            i18n={i18n}
            lang={lang}
            filterModel={filterModel}
            onChange={setFilterModel}
          />
          {showDateFinancialToggle ? (
            <label
              className="mt-3 inline-flex items-center gap-2"
              style={{ color: '#44444C', fontSize: '12px', fontWeight: 500 }}
            >
              <input
                type="checkbox"
                checked={dateFinancialFilterEnabled}
                onChange={(e) => onDateFinancialFilterEnabledChange(e.target.checked)}
              />
              <span>{translation('filter by fiscal year')}</span>
            </label>
          ) : null}
          {showFilterInactiveRecordsToggle ? (
            <label
              className="mt-2 inline-flex items-center gap-2"
              style={{ color: '#44444C', fontSize: '12px', fontWeight: 500 }}
            >
              <input
                type="checkbox"
                checked={filterInactiveRecordsEnabled}
                onChange={(e) => onFilterInactiveRecordsEnabledChange(e.target.checked)}
              />
              <span>{translation('filter inactive records')}</span>
            </label>
          ) : null}
        </div>

        <div className="px-5 py-3 flex flex-col gap-3" style={{ borderTop: '1px solid #E5E7EB' }}>
          <span style={{ color: '#717182', fontWeight: 500, fontSize: '11px' }}>
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
            <label
              className="inline-flex items-center gap-1 whitespace-nowrap"
              style={{ color: '#717182', fontSize: '12px', fontWeight: 500 }}
              title={translation('Set as default')}
            >
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
              />
              <span>{translation('Default')}</span>
            </label>
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
            <select
              value={linkedSort}
              onChange={(e) => setLinkedSort(e.target.value)}
              className="rounded-lg border border-gray-300 px-2 py-1"
              style={{
                height: '31px',
                borderRadius: '6px',
                borderColor: '#0000001A',
                color: '#44444C',
                fontSize: '12px',
              }}
              title={translation('Linked sort')}
            >
              <option value="">{translation('No linked sort')}</option>
              {savedSorts.map((record) => (
                <option key={record.name} value={record.name}>
                  {record.name}
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
                if (!selectedFilter) return;
                deleteFilter(selectedFilter);
              }}
              title={translation('Delete')}
            >
              <GoTrash size={14} />
            </button>
            <button
              type="button"
              className="rounded-lg border border-gray-300 bg-white px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
              style={{
                height: '31px',
                borderRadius: '6px',
                borderColor: '#0000001A',
                color: '#44444C',
                fontSize: '12px',
                fontWeight: 500,
              }}
              disabled={saveButtonDisabled}
              onClick={handleSavePressed}
            >
              {willUpdateExisting ? translation('Update') : translation('Save')}
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
            onClick={() => setFilterModel(null)}
          >
            {translation('Clear')}
          </button>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm text-white flex text-center items-center justify-center"
            onClick={() => {
              queryBuilderRef.current?.commitToGrid();
              onClose();
            }}
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
