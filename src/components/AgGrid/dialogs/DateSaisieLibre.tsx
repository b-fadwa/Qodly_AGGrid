import type { CSSProperties, FC } from 'react';
import rawDateSaisieLibre from './dateSaisieLibre.json';

/* eslint-disable react-refresh/only-export-components */

export const DATE_SAISIE_LIBRE_FLAG = 'dateSaisieLibre';
export const DATE_SAISIE_LIBRE_VALUE = 'dateSaisieLibreValue';
export const DATE_SAISIE_LIBRE_VALUE_TO = 'dateSaisieLibreValueTo';
export const DATE_SAISIE_LIBRE_KEY = 'dateSaisieLibreKey';
export const DATE_SAISIE_LIBRE_KEY_TO = 'dateSaisieLibreKeyTo';

export type DateEntryMode = 'free' | 'list';

export interface DateSaisieLibreOption {
  value: number;
  code: string;
  translationKey: string;
}

export interface DateSaisieLibreConditionMeta {
  dateSaisieLibre?: boolean;
  dateSaisieLibreValue?: number;
  dateSaisieLibreValueTo?: number;
  dateSaisieLibreKey?: string;
  dateSaisieLibreKeyTo?: string;
}

const buildDateSaisieLibreOption = (
  rawValue: string,
  rawTranslationKey: string,
): DateSaisieLibreOption | null => {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 1 || value > 142) return null;
  const translationKey = String(rawTranslationKey ?? '').trim();
  if (!translationKey) return null;
  const code = String(value).padStart(3, '0');
  return {
    value,
    code,
    translationKey,
  };
};

const dateSaisieLibreTranslationOrder = (option: DateSaisieLibreOption): number => {
  const match = option.translationKey.match(/^(\d{2,3})_/);
  const value = match ? Number(match[1]) : Number.NaN;
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
};

const sameCodeDateSaisieLibreOrder = (option: DateSaisieLibreOption): number => {
  switch (option.translationKey) {
    case '009_date_du_jour_7_jours':
      return 0;
    case '009_date_du_jour_14_jours':
      return 1;
    case '025_fin_of_semaine_suivante':
      return 0;
    case '025_debut_du_mois_courant_2':
      return 1;
    case '025_fin_du_mois_courant_2':
      return 2;
    default:
      return 0;
  }
};

export const DATE_SAISIE_LIBRE_OPTIONS: DateSaisieLibreOption[] = Object.entries(
  rawDateSaisieLibre as Record<string, string>,
)
  .map(([value, label]) => buildDateSaisieLibreOption(value, label))
  .filter((option): option is DateSaisieLibreOption => option !== null)
  .sort((a, b) => {
    const byTranslationCode =
      dateSaisieLibreTranslationOrder(a) - dateSaisieLibreTranslationOrder(b);
    if (byTranslationCode !== 0) return byTranslationCode;
    const bySameCode = sameCodeDateSaisieLibreOrder(a) - sameCodeDateSaisieLibreOrder(b);
    if (bySameCode !== 0) return bySameCode;
    return a.translationKey.localeCompare(b.translationKey);
  });

export const getDateSaisieLibreOptionByValue = (
  rawValue: string | number | null | undefined,
): DateSaisieLibreOption | null => {
  const value = Number(String(rawValue ?? '').trim());
  if (!Number.isInteger(value)) return null;
  return DATE_SAISIE_LIBRE_OPTIONS.find((option) => option.value === value) ?? null;
};

export const makeDateSaisieLibreConditionMeta = (
  rawValue: string | number | null | undefined,
  rawValueTo?: string | number | null | undefined,
): DateSaisieLibreConditionMeta | null => {
  const option = getDateSaisieLibreOptionByValue(rawValue);
  if (!option) return null;
  const optionTo =
    rawValueTo != null && String(rawValueTo).trim() !== ''
      ? getDateSaisieLibreOptionByValue(rawValueTo)
      : null;
  if (rawValueTo != null && String(rawValueTo).trim() !== '' && !optionTo) return null;
  return {
    dateSaisieLibre: true,
    dateSaisieLibreValue: option.value,
    dateSaisieLibreKey: option.translationKey,
    ...(optionTo
      ? {
          dateSaisieLibreValueTo: optionTo.value,
          dateSaisieLibreKeyTo: optionTo.translationKey,
        }
      : {}),
  };
};

export const isDateSaisieLibreCondition = (
  condition: DateSaisieLibreConditionMeta | null | undefined,
): boolean => Boolean(condition?.dateSaisieLibre);

export const readDateSaisieLibreConditionValue = (
  condition: DateSaisieLibreConditionMeta | null | undefined,
): string =>
  condition?.dateSaisieLibreValue != null ? String(condition.dateSaisieLibreValue) : '';

export const readDateSaisieLibreConditionValueTo = (
  condition: DateSaisieLibreConditionMeta | null | undefined,
): string =>
  condition?.dateSaisieLibreValueTo != null ? String(condition.dateSaisieLibreValueTo) : '';

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
  <select
    className={className}
    style={style}
    value={value}
    onChange={(e) => onChange(e.target.value)}
  >
    <option value="">{translation('Choose one')}</option>
    {DATE_SAISIE_LIBRE_OPTIONS.map((option) => (
      <option key={option.translationKey} value={String(option.value)}>
        {dateSaisieLibreDisplayLabel(option, translateDateKey)}
      </option>
    ))}
  </select>
);
