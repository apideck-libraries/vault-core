import React, {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import useSWR, { useSWRConfig } from 'swr';

import { CONNECTIONS_URL } from '../constants/urls';
import { Connection } from '../types/Connection';
import { FormField } from '../types/FormField';
import { useToast } from '@apideck/components';

interface ContextProps {
  jwt: string;
  appId: string;
  consumerId: string;
  connections: Connection[];
  selectedConnection?: Connection;
  setSelectedConnection?: (connection: Connection) => void;
  getResourceConfig?: () => any;
  updateConnection: (
    api: string,
    serviceId: string,
    values: any,
    resource?: string
  ) => any;
  deleteConnection: (connection: Connection) => any;
  resources: { resource: string; defaults: FormField[] }[];
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
  const [resources, setResources] = useState<
    { resource: string; defaults: FormField[] }[]
  >([]);
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
    values: any,
    resource?: string
  ) => {
    try {
      setIsUpdating(true);
      let updateUrl = `${CONNECTIONS_URL}/${api}/${serviceId}`;
      if (resource) updateUrl = `${updateUrl}/${resource}/config`;

      const response = await fetch(updateUrl, {
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
        mutate(updateUrl, updatedDetail, false);
        setSelectedConnection({ ...selectedConnection, ...result.data });
        if (resource) getResourceConfig();
        addToast({
          title: `Successfully updated ${result.data?.name}`,
          description: '',
          type: 'success',
          autoClose: true,
        });
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
      addToast({
        title: `Successfully deleted ${connection.name}`,
        type: 'success',
        autoClose: true,
      });
    } catch (error: any) {
      console.error(error);
      addToast({
        title: 'Updating failed',
        description: error.message,
        type: 'error',
      });
      return error;
    }
  };

  const fetchConfig = async (resource: string) => {
    if (!selectedConnection) return;
    const raw = await fetch(
      `${CONNECTIONS_URL}/${selectedConnection.unified_api}/${selectedConnection.service_id}/${resource}/config`,
      {
        headers: getHeaders(),
      }
    );
    const { data } = await raw.json();

    return { resource, defaults: data.configuration };
  };

  const getResourceConfig = async () => {
    const requests: any = [];
    selectedConnection?.configurable_resources.forEach((resource: any) => {
      requests.push(fetchConfig(resource));
    });

    try {
      setIsUpdating(true);
      const responses = await Promise.all(requests);
      setResources(responses);
    } catch (error) {
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    if (!selectedConnection && resources?.length) {
      setResources([]);
    }
  }, [selectedConnection]);

  const contextValue = useMemo(
    () => ({
      connections: data?.data?.sort((a: Connection, b: Connection) =>
        a.name?.localeCompare(b.name)
      ),
      resources,
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
      getResourceConfig,
    }),
    [isUpdating, selectedConnection, data, dataDetail, isOpen, resources]
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
