import { FC, useEffect, useState } from 'react';
import { IoMdClose } from 'react-icons/io';
import { GoTrash } from 'react-icons/go';
import type { SortModelItem } from 'ag-grid-community';
import type { SavedSort } from '../state/types';
import type {
  SortableColumnDescriptor,
  Translation,
} from '../state/sorts';
import { buildInitialSortDialogModel } from '../state/sorts';

interface SortingDialogProps {
  open: boolean;
  onClose: () => void;
  translation: Translation;
  sortableColumns: SortableColumnDescriptor[];
  /** Current grid sort model when the dialog opened. */
  initialSortModel: SortModelItem[];
  /** Apply the edited rules to the grid. */
  onApply: (sortModel: SortModelItem[]) => void;
  /** Reset current grid sorting. */
  onClear: () => void;
  savedSorts: SavedSort[];
  saveSort: (name: string) => void;
  loadSort: (key: string) => void;
  updateSort: (key: string) => void;
  deleteSort: (key: string) => void;
  loadSortsList: () => void;
}

export const SortingDialog: FC<SortingDialogProps> = ({
  open,
  onClose,
  translation,
  sortableColumns,
  initialSortModel,
  onApply,
  onClear,
  savedSorts,
  saveSort,
  loadSort,
  updateSort,
  deleteSort,
  loadSortsList,
}) => {
  const [sortDialogModel, setSortDialogModel] = useState<SortModelItem[]>([]);
  const [sortName, setSortName] = useState('');
  const [selectedSort, setSelectedSort] = useState('');

  useEffect(() => {
    if (!open) return;
    setSortDialogModel(buildInitialSortDialogModel(initialSortModel, sortableColumns));
  }, [open, initialSortModel, sortableColumns]);

  if (!open) return null;

  const addLevel = () => {
    if (sortableColumns.length === 0) return;
    setSortDialogModel((prev) => {
      const used = new Set(prev.map((rule) => rule.colId));
      const next = sortableColumns.find((col) => !used.has(col.colId)) ?? sortableColumns[0];
      return [...prev, { colId: next.colId, sort: 'asc' }];
    });
  };

  const removeLevel = (indexToDelete: number) => {
    setSortDialogModel((prev) => prev.filter((_, i) => i !== indexToDelete));
  };

  const updateLevelColumn = (index: number, colId: string) => {
    setSortDialogModel((prev) =>
      prev.map((rule, i) => (i === index ? { ...rule, colId } : rule)),
    );
  };

  const updateLevelDirection = (index: number, sort: 'asc' | 'desc') => {
    setSortDialogModel((prev) =>
      prev.map((rule, i) => (i === index ? { ...rule, sort } : rule)),
    );
  };

  const handleApply = () => {
    onApply(sortDialogModel);
    onClose();
  };

  const handleClear = () => {
    setSortDialogModel([]);
    onClear();
    onClose();
  };

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
              {translation('ADVANCED SORTING')}
            </span>
            <span
              className="mt-1 block text-sm"
              style={{ color: '#4A5565', fontSize: '14px' }}
            >
              {translation(
                'Choose one or multiple columns and define sort direction for each level',
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

        <div>
          {sortableColumns.length === 0 ? (
            <div
              className="bg-slate-50 px-3 py-2"
              style={{ color: '#4A5565', fontSize: '14px' }}
            >
              {translation('No sortable columns are enabled in grid properties')}
            </div>
          ) : (
            <>
              <div className="px-3 py-2 mb-4">
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {sortDialogModel.length === 0 ? (
                    <div className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-600">
                      {translation('No sort level configured yet')}
                    </div>
                  ) : (
                    sortDialogModel.map((rule, index) => (
                      <div
                        key={`${rule.colId}-${index}`}
                        className="flex items-center gap-2 px-2 py-2"
                      >
                        <span
                          className="w-14"
                          style={{ color: '#364153', fontSize: '14px' }}
                        >
                          {translation('Level')} {index + 1}
                        </span>
                        <select
                          className="min-w-0 flex-1 px-2 py-1"
                          style={{
                            backgroundColor: '#F3F3F5',
                            borderRadius: '8px',
                            height: '36px',
                            fontSize: '14px',
                            width: '256px',
                          }}
                          value={rule.colId}
                          onChange={(e) => updateLevelColumn(index, e.target.value)}
                        >
                          {sortableColumns.map((column) => (
                            <option key={column.colId} value={column.colId}>
                              {column.label}
                            </option>
                          ))}
                        </select>
                        <select
                          className="w-28 rounded-md"
                          style={{
                            backgroundColor: '#F3F3F5',
                            borderRadius: '8px',
                            height: '36px',
                            width: '128px',
                            fontSize: '14px',
                          }}
                          value={rule.sort}
                          onChange={(e) =>
                            updateLevelDirection(
                              index,
                              (e.target.value as 'asc' | 'desc') || 'asc',
                            )
                          }
                        >
                          <option value="asc">{translation('Asc')}</option>
                          <option value="desc">{translation('Desc')}</option>
                        </select>
                        <button
                          type="button"
                          className="border bg-white px-2 py-1"
                          style={{
                            height: '36px',
                            borderColor: '#0000001A',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                          onClick={() => removeLevel(index)}
                        >
                          {translation('Remove')}
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between pb-4">
                  <button
                    type="button"
                    style={{
                      height: '31px',
                      borderRadius: '8px',
                      borderColor: '#0000001A',
                      color: '#44444C',
                      fontSize: '12px',
                      fontWeight: 500,
                    }}
                    className="rounded-md border px-3 py-2 flex items-center justify-center"
                    onClick={addLevel}
                    disabled={sortableColumns.length === 0}
                  >
                    {translation('Add level')}
                  </button>
                </div>
              </div>

              <SavedSortsSection
                translation={translation}
                savedSorts={savedSorts}
                sortName={sortName}
                setSortName={setSortName}
                selectedSort={selectedSort}
                setSelectedSort={setSelectedSort}
                onSave={() => {
                  if (!sortName.trim()) return;
                  saveSort(sortName.trim());
                  setSortName('');
                }}
                onLoad={(key) => loadSort(key)}
                onUpdate={() => {
                  if (!selectedSort) return;
                  updateSort(selectedSort);
                }}
                onDelete={() => {
                  if (!selectedSort) return;
                  deleteSort(selectedSort);
                }}
                onLoadList={loadSortsList}
              />

              <div
                className="flex justify-end align-end items-center gap-2 w-full p-4"
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
                  onClick={handleClear}
                >
                  {translation('Clear')}
                </button>
                <button
                  type="button"
                  className="rounded-md border px-3 py-2 text-sm text-white flex text-center items-center justify-center"
                  onClick={handleApply}
                  style={{
                    background: '#2B5797',
                    height: '31px',
                    fontSize: '12px',
                  }}
                >
                  {translation('Apply sorting')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

interface SavedSortsSectionProps {
  translation: Translation;
  savedSorts: SavedSort[];
  sortName: string;
  setSortName: (value: string) => void;
  selectedSort: string;
  setSelectedSort: (value: string) => void;
  onSave: () => void;
  onLoad: (key: string) => void;
  onUpdate: () => void;
  onDelete: () => void;
  onLoadList: () => void;
}

const SavedSortsSection: FC<SavedSortsSectionProps> = ({
  translation,
  savedSorts,
  sortName,
  setSortName,
  selectedSort,
  setSelectedSort,
  onSave,
  onLoad,
  onUpdate,
  onDelete,
  onLoadList,
}) => {
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

  return (
    <div
      className="px-4 py-3 flex flex-col gap-3"
      style={{ borderTop: '1px solid #E5E7EB' }}
    >
      <span
        style={{ color: '#717182', fontWeight: 500, fontSize: '11px' }}
      >
        {translation('Saved sorts')}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder={translation('Sort name')}
          value={sortName}
          onChange={(e) => setSortName(e.target.value)}
          className="rounded-lg border border-gray-300 px-2 py-1"
          style={inputStyle}
        />
        <button
          type="button"
          className="rounded-lg border border-gray-300 bg-white px-2 py-1"
          style={buttonStyle}
          onClick={onSave}
        >
          {translation('Save new')}
        </button>
        <select
          value={selectedSort}
          onChange={(e) => {
            const next = e.target.value;
            setSelectedSort(next);
            if (next) onLoad(next);
          }}
          className="rounded-lg border border-gray-300 px-2 py-1"
          style={buttonStyle}
        >
          <option value="">{translation('Select sort')}</option>
          {savedSorts.map((record) => (
            <option key={record.name} value={record.name}>
              {record.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="rounded-lg border border-gray-300 bg-white px-2 py-1"
          style={buttonStyle}
          onClick={onUpdate}
        >
          {translation('Update')}
        </button>
        <button
          type="button"
          className="rounded-lg border border-gray-300 bg-white px-2 py-1"
          style={buttonStyle}
          onClick={onLoadList}
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
          onClick={onDelete}
          title={translation('Delete')}
        >
          <GoTrash size={14} />
        </button>
      </div>
    </div>
  );
};
