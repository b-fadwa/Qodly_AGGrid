import {
  EComponentKind,
  Settings,
  T4DComponentConfig,
  T4DComponentDatasourceDeclaration,
} from '@ws-ui/webform-editor';
import { MdOutlineLowPriority } from 'react-icons/md';
import SequenceProgrammingSettings, { BasicSettings } from './SequenceProgramming.settings';

export interface ISequenceProgrammingProps extends webforms.ComponentProps {
  /** Scalar array of saved views — same list AgGrid's "View" setting points at. */
  views?: string;
  /** Scalar array of saved filters. */
  filters?: string;
  /** Scalar array of saved sorts. */
  sorts?: string;
  /** Scalar object containing the live sequence-programming draft. */
  sequence?: string;
  /** Scalar array of named saved sequence-programming records. */
  sequences?: string;
  /** Scalar object describing the available transposition trees (1-to-N, N-to-1) — options 6 & 7 only. */
  transpositions?: string;
  /** Scalar array of saved export formats (same list `ExportSettings`' "exports" setting points at) — option 2. */
  exportFormats?: string;
  /** Scalar array of saved print formats (same list `PrintSettings`' "formats" setting points at) — options 3 & 4. */
  printFormats?: string;
  /** Scalar array of predefined-document options — option 5. */
  predefinedDocuments?: string;
  /** Scalar array of chained-sequence choices (SavedSequence-shaped), scoped by the last transposition item picked — options 6 & 7. */
  chainedSequences?: string;
  colorPrimary?: string;
  colorDanger?: string;
  colorAccent?: string;
  colorDangerWash?: string;
}

export default {
  craft: {
    displayName: 'SequenceProgramming',
    kind: EComponentKind.BASIC,
    props: { name: '', classNames: [], events: [] },
    related: { settings: Settings(SequenceProgrammingSettings, BasicSettings) },
  },
  info: {
    settings: SequenceProgrammingSettings,
    sanityCheck: {
      keys: [
        { name: 'sequence', require: true, isDatasource: true },
        { name: 'sequences', require: false, isDatasource: true },
        { name: 'views', require: false, isDatasource: true },
        { name: 'filters', require: false, isDatasource: true },
        { name: 'sorts', require: false, isDatasource: true },
        { name: 'transpositions', require: false, isDatasource: true },
        { name: 'exportFormats', require: false, isDatasource: true },
        { name: 'printFormats', require: false, isDatasource: true },
        { name: 'predefinedDocuments', require: false, isDatasource: true },
        { name: 'chainedSequences', require: false, isDatasource: true },
      ],
    },
    displayName: 'Sequence Programming',
    exposed: true,
    icon: MdOutlineLowPriority,
    events: [
      { label: 'On Load', value: 'onload' },
      { label: 'On Cancel', value: 'oncancel' },
      { label: 'On Apply Sequence', value: 'onsequence' },
      { label: 'On Load Sequence', value: 'onloadsequence' },
      { label: 'On Save Sequence', value: 'onsavesequence' },
      { label: 'On Update Sequence', value: 'onupdatesequence' },
      { label: 'On Delete Sequence', value: 'ondeletesequence' },
      { label: 'On Automatisation traitement', value: 'onautomatisationtraitement' },
      { label: 'On Share', value: 'onshare' },
      { label: 'On Transposition Select', value: 'ontranspositionselect' },
    ],
    datasources: {
      declarations: (props) => {
        const {
          views = '',
          filters = '',
          sorts = '',
          sequence = '',
          sequences = '',
          transpositions = '',
          exportFormats = '',
          printFormats = '',
          predefinedDocuments = '',
          chainedSequences = '',
        } = props as ISequenceProgrammingProps;
        const declarations: T4DComponentDatasourceDeclaration[] = [];
        if (views) declarations.push({ path: views, iterable: true });
        if (filters) declarations.push({ path: filters, iterable: true });
        if (sorts) declarations.push({ path: sorts, iterable: true });
        if (sequence) declarations.push({ path: sequence });
        if (sequences) declarations.push({ path: sequences, iterable: true });
        if (transpositions) declarations.push({ path: transpositions });
        if (exportFormats) declarations.push({ path: exportFormats, iterable: true });
        if (printFormats) declarations.push({ path: printFormats, iterable: true });
        if (predefinedDocuments) declarations.push({ path: predefinedDocuments, iterable: true });
        if (chainedSequences) declarations.push({ path: chainedSequences, iterable: true });
        return declarations;
      },
    },
  },
  defaultProps: {
    views: '',
    filters: '',
    sorts: '',
    sequence: '',
    sequences: '',
    transpositions: '',
    exportFormats: '',
    printFormats: '',
    predefinedDocuments: '',
    chainedSequences: '',
    colorPrimary: '#2B5797',
    colorDanger: '#EC7B80',
    colorAccent: '#6B8AD4',
    colorDangerWash: 'rgba(236, 123, 128, 0.2)',
    style: { width: '100%', height: '620px' },
  },
} as T4DComponentConfig<ISequenceProgrammingProps>;
