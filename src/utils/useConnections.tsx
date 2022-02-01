import React, {
  ReactNode,
  createContext,
  useContext,
  useMemo,
  useState,
} from 'react';
import useSWR, { useSWRConfig } from 'swr';

import { Connection } from '../types/Connection';
import { useToast } from '@apideck/components';

const CONNECTIONS_URL = `https://unify.apideck.com/vault/connections`;

interface ContextProps {
  jwt: string;
  appId: string;
  consumerId: string;
  connections: Connection[];
  selectedConnection?: Connection;
  error: any;
  isLoading: boolean;
  isUpdating: boolean;
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
  const [selectedConnection, setSelectedConnection] =
    useState<Connection | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const { mutate } = useSWRConfig();
  const { addToast } = useToast();

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

  const { data, error } = useSWR(CONNECTIONS_URL, fetcher);
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
      setIsUpdating(true);
      const response = await fetch(`${CONNECTIONS_URL}/${api}/${serviceId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (result.data) {
        const updatedList = {
          ...data,
          data: [
            result.data,
            ...data.data?.filter(
              (con: Connection) => con.id !== result.data.id
            ),
          ],
        };
        const updatedDetail = {
          ...data,
          data: result.data,
        };
        mutate(CONNECTIONS_URL, updatedList, false);
        mutate(`${CONNECTIONS_URL}/${api}/${serviceId}`, updatedDetail, false);
        setSelectedConnection(result.data);
        return result;
      } else {
        addToast({
          title: 'Updating failed',
          description: result.message,
          type: 'error',
        });
      }
      return result;
    } catch (error: any) {
      console.error(error);
      addToast({
        title: 'Updating failed',
        description: error.message,
        type: 'error',
      });
      return error;
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteConnection = async (connection: Connection) => {
    try {
      setIsUpdating(true);
      await fetch(
        `${CONNECTIONS_URL}/${connection.unified_api}/${connection.service_id}`,
        {
          method: 'DELETE',
          headers: getHeaders(),
        }
      );
      const updatedConnection = {
        ...connection,
        enabled: false,
        state: 'available',
      };
      const updatedData = {
        ...data,
        data: [
          updatedConnection,
          ...data.data?.filter((con: Connection) => con.id !== connection.id),
        ],
      };
      mutate(CONNECTIONS_URL, updatedData, false);
      setSelectedConnection(null);
    } catch (error: any) {
      console.error(error);
      addToast({
        title: 'Updating failed',
        description: error.message,
        type: 'error',
      });
      return error;
    } finally {
      setIsUpdating(false);
    }
  };

  const contextValue = useMemo(
    () => ({
      connections: data?.data?.sort((a: Connection, b: Connection) =>
        a.name?.localeCompare(b.name)
      ),
      isLoading: !error && !data,
      error: data?.detail || error,
      updateConnection,
      deleteConnection,
      selectedConnection: dataDetail?.data
        ? { ...selectedConnection, ...dataDetail?.data }
        : selectedConnection,
      mutateDetail,
      setSelectedConnection,
      isUpdating,
    }),
    [isUpdating, selectedConnection, data, dataDetail, isOpen]
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
