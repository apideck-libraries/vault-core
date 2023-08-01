import React, { createContext, useContext } from 'react';
import { Session } from '../types/Session';

interface ContextProps {
  session: Session;
}

const SessionContext = createContext<Partial<ContextProps>>({});

interface Props {
  session: Session;
  children: React.ReactNode;
}

export const SessionProvider = ({ session, children }: Props) => {
  return (
    <SessionContext.Provider value={{ session }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  return useContext(SessionContext) as ContextProps;
};
