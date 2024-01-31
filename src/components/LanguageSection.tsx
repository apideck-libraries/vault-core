import React from 'react';
import LanguageSwitchDropdown from './LanguageSwitchDropdown';

const LanguageSection = () => {
  return (
    <div className="relative px-3 py-2 flex items-center justify-end rounded-b-lg bg-gray-100 border-t">
      <LanguageSwitchDropdown />
    </div>
  );
};

export default LanguageSection;
