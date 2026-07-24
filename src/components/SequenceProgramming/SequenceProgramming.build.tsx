import { FC, useState } from 'react';
import { useEnhancedNode, useI18n, useLocalization } from '@ws-ui/webform-editor';
import type { ISequenceProgrammingProps } from './SequenceProgramming.config';
import SequenceProgrammingPanel from './SequenceProgrammingPanel';
import {
  emptySequence,
  sequenceFromRecord,
  savedRecordKey,
} from './SequenceProgramming.types';
import type {
  SavedExportFormat,
  SavedPrintFormat,
  SavedSequence,
  SequenceProgrammingPayload,
  SequenceTranspositionOption,
  SequenceTranspositionsValue,
} from './SequenceProgramming.types';

const MOCK_VIEWS = [
  { name: 'Default view', linkedFilterId: 'Active records' },
  { name: 'Compact view' },
];
const MOCK_FILTERS = [
  { name: 'Active records', linkedSortId: 'Name ascending' },
  { name: 'This year' },
];
const MOCK_SORTS = [{ name: 'Name ascending' }];
const MOCK_CHAINED_SEQUENCES: SavedSequence[] = [
  { name: 'Chained display', sequence: emptySequence() },
];
const MOCK_TRANSPOSITIONS: SequenceTranspositionsValue = {
  oneToN: [{ key: 'orders', label: 'Orders' }],
  nToOne: [{ key: 'customer', label: 'Customer' }],
};
const MOCK_EXPORT_FORMATS: SavedExportFormat[] = [
  { name: 'Default export', format: { columnState: [], exportHeaderNames: true, exportUppercase: false, exportExtension: 'TXT' } },
];
const MOCK_PRINT_FORMATS: SavedPrintFormat[] = [
  {
    name: 'Default print',
    format: { representation: 'list', columnState: [], dateFormats: {}, subtotals: [] },
  },
];
const MOCK_PREDEFINED_DOCUMENTS: SequenceTranspositionOption[] = [
  { key: 'invoice', label: 'Invoice template' },
];

const SequenceProgrammingBuild: FC<ISequenceProgrammingProps> = ({
  colorPrimary,
  colorDanger,
  colorAccent,
  colorDangerWash,
  disabled,
  style,
  className,
  classNames = [],
}) => {
  const {
    connectors: { connect },
  } = useEnhancedNode();
  const { i18n } = useI18n();
  const { selected: lang } = useLocalization();
  const [value, setValue] = useState<SequenceProgrammingPayload>(() => emptySequence());
  const [savedSequences, setSavedSequences] = useState<SavedSequence[]>([]);

  const save = (name: string, sequence: SequenceProgrammingPayload) => {
    setSavedSequences((current) => [...current, { name, sequence }]);
  };

  const update = (key: string, sequence: SequenceProgrammingPayload) => {
    setSavedSequences((current) =>
      current.map((record) => (savedRecordKey(record) === key ? { ...record, sequence } : record)),
    );
  };

  const remove = (record: SavedSequence) => {
    const key = savedRecordKey(record);
    setSavedSequences((current) => current.filter((item) => savedRecordKey(item) !== key));
  };

  return (
    <div
      ref={connect}
      style={style}
      className={[className, ...classNames].filter(Boolean).join(' ')}
    >
      <SequenceProgrammingPanel
        savedViews={MOCK_VIEWS}
        savedFilters={MOCK_FILTERS}
        savedSorts={MOCK_SORTS}
        savedSequences={savedSequences}
        transpositions={MOCK_TRANSPOSITIONS}
        exportFormats={MOCK_EXPORT_FORMATS}
        printFormats={MOCK_PRINT_FORMATS}
        predefinedDocuments={MOCK_PREDEFINED_DOCUMENTS}
        chainedSequences={MOCK_CHAINED_SEQUENCES}
        value={value}
        colorPrimary={colorPrimary}
        colorDanger={colorDanger}
        colorAccent={colorAccent}
        colorDangerWash={colorDangerWash}
        disabled={disabled}
        i18n={i18n}
        lang={lang}
        style={{ height: '100%' }}
        onChange={setValue}
        onSaveSequence={save}
        onUpdateSequence={update}
        onDeleteSequence={remove}
        onLoadSequence={(record) => setValue(sequenceFromRecord(record))}
        onApply={setValue}
        onAutomatisationTraitement={() => undefined}
        onShare={() => undefined}
        onTranspositionSelect={() => undefined}
        onCancel={() => undefined}
      />
    </div>
  );
};

export default SequenceProgrammingBuild;
