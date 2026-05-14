import type { CSSProperties, FC } from 'react';
import rawDateSaisieLibre from './dateSaisieLibre.json';

/* eslint-disable react-refresh/only-export-components */

export const DATE_SAISIE_LIBRE_FLAG = 'dateSaisieLibre';
export const DATE_SAISIE_LIBRE_VALUE = 'dateSaisieLibreValue';
export const DATE_SAISIE_LIBRE_KEY = 'dateSaisieLibreKey';

export type DateEntryMode = 'free' | 'list';

export interface DateSaisieLibreOption {
  value: number;
  code: string;
  translationKey: string;
}

export interface DateSaisieLibreConditionMeta {
  dateSaisieLibre?: boolean;
  dateSaisieLibreValue?: number;
  dateSaisieLibreKey?: string;
}

const buildDateSaisieLibreOption = (
  rawValue: string,
  rawTranslationKey: string,
): DateSaisieLibreOption | null => {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1 || value > 140) return null;
  const translationKey = String(rawTranslationKey ?? '').trim();
  if (!translationKey) return null;
  const code = String(value).padStart(3, '0');
  return {
    value,
    code,
    translationKey,
  };
};

export const DATE_SAISIE_LIBRE_OPTIONS: DateSaisieLibreOption[] = Object.entries(
  rawDateSaisieLibre as Record<string, string>,
)
  .map(([value, label]) => buildDateSaisieLibreOption(value, label))
  .filter((option): option is DateSaisieLibreOption => option !== null)
  .sort((a, b) => a.value - b.value);

export const getDateSaisieLibreOptionByValue = (
  rawValue: string | number | null | undefined,
): DateSaisieLibreOption | null => {
  const value = Number(String(rawValue ?? '').trim());
  if (!Number.isInteger(value)) return null;
  return DATE_SAISIE_LIBRE_OPTIONS.find((option) => option.value === value) ?? null;
};

export const makeDateSaisieLibreConditionMeta = (
  rawValue: string | number | null | undefined,
): DateSaisieLibreConditionMeta | null => {
  const option = getDateSaisieLibreOptionByValue(rawValue);
  if (!option) return null;
  return {
    dateSaisieLibre: true,
    dateSaisieLibreValue: option.value,
    dateSaisieLibreKey: option.translationKey,
  };
};

export const isDateSaisieLibreCondition = (
  condition: DateSaisieLibreConditionMeta | null | undefined,
): boolean => Boolean(condition?.dateSaisieLibre);

export const readDateSaisieLibreConditionValue = (
  condition: DateSaisieLibreConditionMeta | null | undefined,
): string =>
  condition?.dateSaisieLibreValue != null ? String(condition.dateSaisieLibreValue) : '';

export const dateSaisieLibreDisplayLabel = (
  option: DateSaisieLibreOption,
  translateDateKey?: (key: string) => string,
): string => {
  const translated = translateDateKey?.(option.translationKey);
  const label =
    translated && translated !== option.translationKey
      ? translated
      : option.translationKey.replace(/^\d{2,3}_/, '').replace(/_/g, ' ');
  return label.replace(/^\s*\d{2,3}\*?\s*/, '').trim();
};

interface DateSaisieLibreSelectProps {
  value: string;
  translation: (key: string) => string;
  translateDateKey?: (key: string) => string;
  onChange: (value: string) => void;
  className?: string;
  style?: CSSProperties;
}

export const DateSaisieLibreSelect: FC<DateSaisieLibreSelectProps> = ({
  value,
  translation,
  translateDateKey,
  onChange,
  className,
  style,
}) => (
  <select className={className} style={style} value={value} onChange={(e) => onChange(e.target.value)}>
    <option value="">{translation('Choose one')}</option>
    {DATE_SAISIE_LIBRE_OPTIONS.map((option) => (
      <option key={option.translationKey} value={String(option.value)}>
        {dateSaisieLibreDisplayLabel(option, translateDateKey)}
      </option>
    ))}
  </select>
);
