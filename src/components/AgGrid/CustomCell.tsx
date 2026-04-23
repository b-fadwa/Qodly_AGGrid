import { formatValue, useI18n, useLocalization } from '@ws-ui/webform-editor';
import { MdCheck, MdClose } from 'react-icons/md';
import { DataType, getStyle } from '@ws-ui/formatter';

const CustomCell = ({
  format,
  dataType,
  value,
  colDef,
}: {
  format: any;
  dataType: string;
  value: any;
  colDef?: {
    field?: string;
    headerName?: string;
    source?: string;
    context?: { source?: string };
  };
}) => {
  const { i18n } = useI18n();
  const { selected: lang } = useLocalization();

  const translateFromHeader = (input: any): any => {
    const headerKey =
      colDef?.context?.source ??
      colDef?.source ??
      colDef?.headerName ??
      colDef?.field ??
      '';
    const match = typeof headerKey === 'string' ? headerKey.match(/_r_(16\d{3})/i) : null;
    if (!match || input === undefined || input === null || input === '') {
      return input;
    }

    const resourceId = match[1];
    const translationKey = `${resourceId}${input}`;

    const entry = i18n?.keys?.[translationKey];

    return entry?.[lang] ?? entry?.default ?? input;
  };

  const translatedValue = translateFromHeader(value);

  switch (true) {
    case translatedValue &&
      typeof translatedValue === 'object' &&
      !(translatedValue instanceof Date):
      return (
        <>
          {(translatedValue as any)?.__deferred?.image ? (
            <img className="image h-full" src={(translatedValue as any)?.__deferred?.uri} alt="" />
          ) : (
            JSON.stringify(translatedValue)
          )}
        </>
      );
    case dataType === 'number' && typeof translatedValue === 'boolean' && format === 'checkbox':
      return <input className="checkbox" type="checkbox" checked={translatedValue} disabled />;
    case dataType === 'number' && typeof translatedValue === 'boolean' && format === 'icon':
      return (
        <div className={'icon h-full flex items-center icon-' + translatedValue}>
          {translatedValue ? <MdCheck /> : <MdClose />}
        </div>
      );
    case dataType === 'number' && typeof translatedValue === 'number' && format === 'slider':
      return <input className="slider" type="range" value={translatedValue} disabled />;
    case dataType === 'bool' && typeof translatedValue === 'boolean' && format === 'boolean':
      return <div className="cell">{translatedValue.toString()}</div>;
    default:
      const customValue =
        translatedValue !== undefined && translatedValue !== null
          ? format
            ? formatValue(translatedValue, dataType, format)
            : translatedValue.toString()
          : translatedValue;
      const customStyle =
        format && format !== 'icon' && format !== 'checkbox'
          ? getStyle(dataType as DataType, format, translatedValue)
          : {};

      return (
        <div style={customStyle} className="cell whitespace-nowrap">
          {customValue}
        </div>
      );
  }
};

export default CustomCell;
