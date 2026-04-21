import { FC, useState } from 'react';
import { IoMdClose } from 'react-icons/io';
import { GoTrash } from 'react-icons/go';
import type { IColumn } from '../AgGrid.config';
import type { SavedFilter } from '../state/types';
import type { Translation } from '../state/sorts';
import { QueryBuilder } from './QueryBuilder';

interface FilterDialogProps {
  open: boolean;
  onClose: () => void;
  translation: Translation;
  columns: IColumn[];
  /** AG Grid `getFilterModel()` snapshot — kept in sync with the header filter via `onFilterChanged`. */
  filterModel: any;
  /** Push a new filterModel back to AG Grid (typically `gridApi.setFilterModel`). */
  setFilterModel: (next: any) => void;
  savedFilters: SavedFilter[];
  saveFilter: (name: string) => void;
  loadFilter: (key: string) => void;
  updateFilter: (key: string) => void;
  deleteFilter: (key: string) => void;
}

export const FilterDialog: FC<FilterDialogProps> = ({
  open,
  onClose,
  translation,
  columns,
  filterModel,
  setFilterModel,
  savedFilters,
  saveFilter,
  loadFilter,
  updateFilter,
  deleteFilter,
}) => {
  const [filterName, setFilterName] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('');

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
              className="text-sm tracking-wide"
              style={{ color: '#0A0A0A', fontSize: '21px', fontWeight: 500 }}
            >
              {translation('ADVANCED FILTERING')}
            </span>
            <span
              className="mt-1 block text-sm"
              style={{ color: '#4A5565', fontSize: '14px' }}
            >
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
            translation={translation}
            columns={columns}
            filterModel={filterModel}
            onChange={setFilterModel}
          />
        </div>

        <div
          className="px-5 py-3 flex flex-col gap-3"
          style={{ borderTop: '1px solid #E5E7EB' }}
        >
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
            onClick={() => setFilterModel(null)}
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
