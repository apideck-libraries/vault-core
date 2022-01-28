import React, {
  ReactNode,
  createContext,
  useContext,
  useMemo,
  useState,
} from 'react';

import { Connection } from '../types/Connection';
import useSWR from 'swr';

// import { useSession } from './useSession';

const CONNECTIONS_URL = `https://unify.apideck.com/vault/connections`;

interface ContextProps {
  jwt: string;
  appId: string;
  consumerId: string;
}

const ConnectionsContext = createContext<Partial<ContextProps>>({});

interface Props {
  jwt: string;
  appId: string;
  consumerId: string;
  isOpen: boolean;
  children: ReactNode;
}

export const ConnectionsProvider = ({
  jwt,
  appId,
  consumerId,
  isOpen,
  children,
}: Props) => {
  const [selectedConnection, setSelectedConnection] = useState<Connection>();

  const getHeaders = () => {
    return {
      Authorization: `Bearer ${jwt}`,
      'X-APIDECK-APP-ID': appId,
      'X-APIDECK-CONSUMER-ID': consumerId,
      'X-APIDECK-AUTH-TYPE': 'JWT',
      'Content-Type': 'application/json',
    };
  };

  const fetcher = async (url: string) => {
    const response = await fetch(url, {
      headers: getHeaders(),
    });
    return await response.json();
  };

  const { data, error, mutate } = useSWR(CONNECTIONS_URL, fetcher);
  const { data: dataDetail, mutate: mutateDetail } = useSWR(
    selectedConnection
      ? `${CONNECTIONS_URL}/${selectedConnection?.unified_api}/${selectedConnection?.service_id}`
      : null,
    fetcher
  );

  const updateConnection = async (
    api: string,
    serviceId: string,
    values: any
  ) => {
    try {
      const response = await fetch(`${CONNECTIONS_URL}/${api}/${serviceId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(values),
      });
      const result = await response.json();
      mutate();
      return result;
    } catch (error) {
      console.error(error);
      return error;
    }
  };

  const deleteConnection = async (connectionId: string) => {
    // TODO
    console.log(connectionId, mutate);
  };

  const contextValue = useMemo(
    () => ({
      connections: data?.data,
      isLoading: !error && !data,
      isError: data?.detail || error,
      updateConnection,
      deleteConnection,
      selectedConnection: dataDetail?.data
        ? { ...selectedConnection, ...dataDetail?.data }
        : selectedConnection,
      mutateDetail,
      setSelectedConnection,
    }),
    [selectedConnection, data, dataDetail, isOpen]
  );

  return (
    <ConnectionsContext.Provider value={contextValue}>
      {children}
    </ConnectionsContext.Provider>
  );
};

export const useConnections = () => {
  return useContext(ConnectionsContext) as ContextProps;
};
