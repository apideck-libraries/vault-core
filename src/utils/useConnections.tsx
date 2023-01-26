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
  connectionsUrl: string;
  headers: any;
  updateConnection: (
    api: string,
    serviceId: string,
    values: any,
    resource?: string
  ) => any;
}

const ConnectionsContext = createContext<Partial<ContextProps>>({});

interface Props {
  token: string;
  appId: string;
  consumerId: string;
  isOpen: boolean;
  unifiedApi?: string;
  serviceId?: string;
  connectionsUrl: string;
  children: ReactNode;
}

export const ConnectionsProvider = ({
  token,
  appId,
  consumerId,
  isOpen,
  unifiedApi,
  serviceId,
  connectionsUrl,
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

  const headers = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      'X-APIDECK-APP-ID': appId,
      'X-APIDECK-CONSUMER-ID': consumerId,
      'X-APIDECK-AUTH-TYPE': 'JWT',
      'Content-Type': 'application/json',
    }),
    [token, appId, consumerId]
  );

  const fetcher = async (url: string) => {
    const response = await fetch(url, { headers });
    return await response.json();
  };

  const listUrl = `${connectionsUrl}${unifiedApi ? `?api=${unifiedApi}` : ''}`;
  const detailsUrl = `${connectionsUrl}/${selectedConnection?.unified_api}/${selectedConnection?.service_id}`;

  const { data, error } = useSWR(listUrl, fetcher, {
    shouldRetryOnError: false,
  });
  const { data: connectionDetails, error: detailsError } = useSWR(
    selectedConnection ? detailsUrl : null,
    fetcher,
    { shouldRetryOnError: false }
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

    if (
      configurable_resources?.length &&
      isReAuthorized &&
      !resources.length &&
      !isUpdating
    ) {
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
      let updateUrl = `${connectionsUrl}/${api}/${serviceId}`;
      if (resource) updateUrl = `${updateUrl}/${resource}/config`;

      const response = await fetch(updateUrl, {
        method: 'PATCH',
        headers,
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
          mutate(connectionsUrl, updatedList, false);
        }

        // Update selected connection and mutate client cache
        const updatedDetail = {
          ...data,
          data: result.data,
        };

        mutate(updateUrl, updatedDetail, false);
        setSelectedConnection({ ...selectedConnection, ...result.data });

        if (resource) await getResourceConfig();

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
        `${connectionsUrl}/${connection.unified_api}/${connection.service_id}`,
        {
          method: 'DELETE',
          headers,
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
      mutate(connectionsUrl, updatedData, false);
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
      `${connectionsUrl}/${selectedConnection.unified_api}/${selectedConnection.service_id}/${resource}/config`,
      { headers }
    );
    const response = await raw.json();

    if (response.error) return response;

    return { resource, defaults: response?.data?.configuration };
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
        console.error('Failed to fetch resource config', errorResponse);
        addToast({
          title: 'Failed to fetch resource config',
          description: `${errorResponse?.message} ${errorResponse?.detail?.error?.[0]?.message}`,
          type: 'error',
          autoClose: false,
        });
        setResources(responses);
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
      connectionsUrl,
      headers,
    }),
    [
      isUpdating,
      selectedConnection,
      data,
      connectionDetails,
      isOpen,
      resources,
      token,
      connectionsUrl,
    ]
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

// export default useConnections;
