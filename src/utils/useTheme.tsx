import React, { createContext, useContext } from 'react';
import { ThemeSettings } from '../types/ThemeSettings';

interface ContextProps {
  theme: ThemeSettings;
}

const ThemeContext = createContext<Partial<ContextProps>>({});

interface Props {
  theme: ThemeSettings;
  children: React.ReactNode;
}

export const ThemeProvider = ({ theme, children }: Props) => {
  return (
    <ThemeContext.Provider value={{ theme }}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  return useContext(ThemeContext) as ContextProps;
};
