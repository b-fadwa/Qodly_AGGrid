import { formatValue } from '@ws-ui/webform-editor';
import { MdCheck, MdClose } from 'react-icons/md';
//import { DataType, getStyle } from '@ws-ui/formatter';

const CustomCell = ({ format, dataType, value }: { format: any; dataType: string; value: any }) => {
  switch (true) {
    case value && typeof value === 'object' && !(value instanceof Date):
      return (
        <>
          {value?.__deferred?.image ? (
            <img className="image h-full" src={value?.__deferred?.uri} alt="" />
          ) : (
            JSON.stringify(value)
          )}
        </>
      );
    case dataType === 'number' && typeof value === 'boolean' && format === 'checkbox':
      return <input className="checkbox" type="checkbox" checked={value} disabled />;
    case dataType === 'number' && typeof value === 'boolean' && format === 'icon':
      return (
        <div className="icon h-full flex items-center">{value ? <MdCheck /> : <MdClose />}</div>
      );
    case dataType === 'number' && typeof value === 'number' && format === 'slider':
      return <input className="slider" type="range" value={value} disabled />;
    case dataType === 'bool' && typeof value === 'boolean' && format === 'boolean':
      return <div className="cell">{value.toString()}</div>;
    default:
      const customValue =
        value !== undefined && value !== null
          ? format
            ? formatValue(value, dataType, format)
            : value.toString()
          : value;
      //const customStyle = format ? getStyle(dataType as DataType, format, value) : {};

      return <div /*style={customStyle}*/ className="cell whitespace-nowrap">{customValue}</div>;
  }
};

export default CustomCell;
