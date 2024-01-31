import { Dropdown } from '@apideck/components';
import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitchDropdown = ({ trigger }: { trigger?: any }) => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const languages = [
    { label: 'English', value: 'en' },
    { label: 'Nederlands', value: 'nl' },
    { label: 'Deutsch', value: 'de' },
    { label: 'Français', value: 'fr' },
    { label: 'Español', value: 'es' },
  ];

  const currentLanguage = i18n.language;

  const options = languages.map((language) => ({
    label: language.label,
    onClick: () => changeLanguage(language.value),
  }));

  const selectedLanguage = languages.find(
    (language) => language.value === currentLanguage
  );

  return (
    <Dropdown
      trigger={trigger}
      buttonClassName="px-2.5 py-1.5 text-sm"
      options={options}
      minWidth={40}
      className="font-medium z-20"
      itemsClassName="!mt-0"
      upward
      selectedOption={selectedLanguage}
    />
  );
};

export default LanguageSwitchDropdown;
