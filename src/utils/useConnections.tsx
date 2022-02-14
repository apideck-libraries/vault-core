import React, {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { usePrevious, useToast } from '@apideck/components';
import useSWR, { useSWRConfig } from 'swr';

import { CONNECTIONS_URL } from '../constants/urls';
import { Connection } from '../types/Connection';
import { FormField } from '../types/FormField';

interface ContextProps {
  connections: Connection[];
  deleteConnection: (connection: Connection) => void;
  detailsError: any;
  error: any;
  isLoading: boolean;
  isLoadingDetails: boolean;
  isUpdating: boolean;
  resources: { resource: string; defaults: FormField[] }[] | [];
  selectedConnection: Connection | null;
  setSelectedConnection: (connection: Connection | null) => void;
  singleConnectionMode: boolean;
  sessionExpired: boolean;
  updateConnection: (
    api: string,
    serviceId: string,
    values: any,
    resource?: string
  ) => any;
}

const ConnectionsContext = createContext<Partial<ContextProps>>({});

interface Props {
  jwt: string;
  appId: string;
  consumerId: string;
  isOpen: boolean;
  unifiedApi?: string;
  serviceId?: string;
  children: ReactNode;
}

export const ConnectionsProvider = ({
  jwt,
  appId,
  consumerId,
  isOpen,
  unifiedApi,
  serviceId,
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

  const singleConnectionMode =
    unifiedApi?.length && serviceId?.length ? true : false;

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
  const { data: connectionDetails, error: detailsError } = useSWR(
    selectedConnection
      ? `${CONNECTIONS_URL}/${selectedConnection?.unified_api}/${selectedConnection?.service_id}`
      : null,
    fetcher
  );

  const connection = connectionDetails?.data
    ? { ...selectedConnection, ...connectionDetails?.data }
    : selectedConnection;

  const prevConnection: any = usePrevious(connection);

  useEffect(() => {
    if (singleConnectionMode) {
      // Set unified_api and service_id id as selected connection so the component only shows the connection details view
      // and useSWR gets triggered to fetch the connectionDetails
      setSelectedConnection({
        unified_api: unifiedApi,
        service_id: serviceId,
      } as Connection);
    }
  }, [singleConnectionMode]);

  useEffect(() => {
    // Enable connection if it's in singleConnectionMode and connection is not yet enabled/disabled
    if (
      unifiedApi?.length &&
      serviceId?.length &&
      prevConnection &&
      !prevConnection?.hasOwnProperty('enabled') &&
      connection?.hasOwnProperty('enabled') &&
      !connection.enabled
    ) {
      updateConnection(unifiedApi, serviceId, { enabled: true });
    }
  }, [connection]);

  useEffect(() => {
    if (!connection) return;

    const { configurable_resources, state } = connection;
    const isReAuthorized = state === 'authorized' || state === 'callable';

    if (configurable_resources?.length && isReAuthorized && !resources.length) {
      getResourceConfig();
    }
  }, [connection]);

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

      if (result?.data) {
        // Mutate list view only if we are in NOT in single connection mode
        if (!singleConnectionMode) {
          const updatedList = {
            ...data,
            data: [
              result.data,
              ...data?.data?.filter(
                (con: Connection) => con.id !== result.data.id
              ),
            ],
          };
          mutate(CONNECTIONS_URL, updatedList, false);
        }

        // Update selected connection and mutate client cache
        const updatedDetail = {
          ...data,
          data: result.data,
        };

        mutate(updateUrl, updatedDetail, false);
        setSelectedConnection({ ...selectedConnection, ...result.data });

        if (resource) getResourceConfig();

        const message = values.hasOwnProperty('enabled')
          ? `${result.data?.name} is ${values.enabled ? 'enabled' : 'disabled'}`
          : `${result.data?.name} settings are updated`;

        addToast({
          title: message,
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
    } catch (error) {
      addToast({
        title: 'Updating failed',
        description: (error as any)?.message,
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
        title: `${connection.name} has been deleted`,
        type: 'success',
        autoClose: true,
      });
    } catch (error) {
      addToast({
        title: 'Updating failed',
        description: (error as any)?.message,
        type: 'error',
      });
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
    const response = await raw.json();

    if (response.error) return response;

    return { resource, defaults: response?.data.configuration };
  };

  const getResourceConfig = async () => {
    const requests: any = [];
    const resources = connection?.configurable_resources;

    resources.forEach((resource: any) => {
      requests.push(fetchConfig(resource));
    });

    try {
      setIsUpdating(true);
      const responses: { resource: string; defaults: any }[] =
        await Promise.all(requests);
      const errorResponse: any = responses.find((res: any) => res.error);
      if (errorResponse) {
        addToast({
          title: 'Failed to fetch resource config',
          description: errorResponse?.message || errorResponse?.error,
          type: 'error',
        });
        return;
      }
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
      deleteConnection,
      sessionExpired:
        data?.status_code === 401 || connectionDetails?.status_code === 401,
      detailsError: connectionDetails?.message || detailsError,
      error: data?.message || error,
      isLoading: !error && !data,
      isLoadingDetails: connection && !connection.id,
      isUpdating,
      resources,
      selectedConnection: connection,
      setSelectedConnection,
      singleConnectionMode,
      updateConnection,
    }),
    [isUpdating, selectedConnection, data, connectionDetails, isOpen, resources]
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
