import React, { useEffect, useRef, useState } from 'react';
import Select, { CSSObjectWithLabel } from 'react-select';

import classNames from 'classnames';
import CreatableSelect from 'react-select/creatable';
import theme from '../utils/theme';
import { useSession } from '../utils/useSession';

export interface OptionType {
  value: string;
  label: string;
}

interface SelectProps {
  field: string;
  placeholder: string;
  value?: string | string[] | readonly string[];
  handleChange: (event: any) => void;
  disabled?: boolean;
  options: OptionType[];
  className?: string;
  isMulti?: any;
  isCreatable?: boolean;
}

const DropdownIndicator = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="w-4 h-4 mr-2 text-gray-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
};

const SearchSelect = ({
  field,
  placeholder,
  value,
  handleChange,
  disabled = false,
  options,
  className = '',
  isCreatable = false,
  ...rest
}: SelectProps) => {
  const selectRef = useRef(null) as any;
  const [selectedOption, setSelectedOption] = useState<
    OptionType | OptionType[]
  >();

  const {
    session: { theme: vaultTheme },
  } = useSession();

  const findMatchingOption = (val: string) =>
    options.find((option) => option.value === val);

  const createNewOptionType = (val: string): OptionType => ({
    label: val,
    value: val,
  });

  const findOrCreateOption = (val: string): OptionType =>
    findMatchingOption(val) ?? createNewOptionType(val);

  // If the value is not in the options list, add it as a custom option
  // It handles both single and multi-select cases
  const addCustomOptionIfNeeded = (
    updatedValues: OptionType | OptionType[] | undefined,
    value: string | string[] | readonly string[] | undefined
  ): OptionType | OptionType[] | undefined => {
    if (!value || !updatedValues) return updatedValues;

    if (Array.isArray(value)) {
      return value.map((v) => findOrCreateOption(v));
    } else if (typeof value === 'string') {
      return findOrCreateOption(value);
    } else {
      return updatedValues;
    }
  };

  useEffect(() => {
    if (!value) return;

    let option = rest.isMulti
      ? options?.filter((option: OptionType) => value?.includes(option.value))
      : options?.find((option: OptionType) => option.value === value);

    if (isCreatable) {
      option = rest.isMulti
        ? addCustomOptionIfNeeded(option, value)
        : ({ label: value, value } as OptionType);
    }

    if (option) setSelectedOption(option);
  }, [isCreatable, options, rest.isMulti, value]);

  const patchedOnChange = (options: any) => {
    const value = rest.isMulti
      ? options.map((option: OptionType) => option.value)
      : options.value;
    handleChange({ currentTarget: { value, name: field } });
    setSelectedOption(options);
  };

  const customStyles = {
    control: (provided: CSSObjectWithLabel, state: { isFocused: boolean }) => ({
      ...provided,
      border: state.isFocused
        ? `1px solid transparent`
        : `1px solid ${theme?.colors?.gray[300]}`,
      borderRadius: theme?.borderRadius.md,
      boxShadow: state.isFocused
        ? `0 0 0 2px ${
            vaultTheme?.primary_color
              ? vaultTheme.primary_color
              : theme?.colors.primary[500]
          }`
        : 'none',
      '&:hover': {
        border: state.isFocused
          ? `1px solid transparent`
          : `1px solid ${theme?.colors.gray[300]}`,
      },
      fontSize: theme?.fontSize.sm,
    }),
    placeholder: (provided: CSSObjectWithLabel) => ({
      ...provided,
      fontSize: theme?.fontSize.sm,
      color: theme?.colors.gray[400],
    }),
    menu: (provided: CSSObjectWithLabel) => ({
      ...provided,
      marginTop: '5px',
      border: `1px solid ${theme?.colors.gray[300]}`,
      borderRadius: theme?.borderRadius.md,
      boxShadow: theme?.boxShadow.lg,
    }),
    option: (
      provided: CSSObjectWithLabel,
      state: { isSelected: boolean; isFocused: boolean }
    ) => ({
      ...provided,
      backgroundColor:
        state.isSelected || state.isFocused
          ? vaultTheme?.primary_color
            ? vaultTheme.primary_color
            : `${theme?.colors.primary[500]}`
          : 'none',
      color:
        state.isSelected || state.isFocused
          ? `${theme?.colors.white}`
          : `${theme?.colors.gray[900]}`,
      fontWeight: `${theme?.fontWeight.normal}`,
      fontSize: `${theme?.fontSize.sm}`,
      '&:Active': {
        backgroundColor: `${
          vaultTheme?.primary_color
            ? vaultTheme.primary_color
            : theme?.colors.primary[400]
        }`,
      },
    }),
    noOptionsMessage: (provided: CSSObjectWithLabel) => ({
      ...provided,
      fontSize: theme?.fontSize.sm,
    }),
  };

  const selectProps = {
    ref: selectRef,
    id: field,
    name: field,
    ['data-testid']: field,
    value: selectedOption,
    isDisabled: disabled,
    onChange: patchedOnChange,
    placeholder,
    options,
    className: classNames(
      'react-select',
      'text-base text-gray-600 placeholder-gray-400 border-gray-300 rounded-md shadow-sm focus:outline-none sm:text-sm focus:ring-primary-500 focus:border-primary-500 react-select',
      className
    ),
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.keyCode === 27) {
        e.stopPropagation();
        selectRef?.current?.blur();
      }
    },
    components: {
      DropdownIndicator,
      IndicatorSeparator: null,
    },
    styles: customStyles,
    ...rest,
  };

  return isCreatable ? (
    <CreatableSelect
      formatCreateLabel={(userInput: string) => `Select "${userInput}"`}
      {...selectProps}
    />
  ) : (
    <Select {...selectProps} />
  );
};

export default SearchSelect;
