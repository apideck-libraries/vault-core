import { usePrevious, useToast } from '@apideck/components';
import React, {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import useSWR, { useSWRConfig } from 'swr';

import { useTranslation } from 'react-i18next';
import { Connection, ConsentState } from '../types/Connection';
import { FormField } from '../types/FormField';

interface ContextProps {
  connections: Connection[];
  deleteConnection: (connection: Connection) => void;
  denyConsent: (connection: Connection, resources: any) => Promise<void>;
  grantConsent: (connection: Connection, resources: any) => Promise<void>;
  revokeConsent: (connection: Connection, resources: any) => Promise<void>;
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
  unifyBaseUrl: string;
  headers: any;
  token?: string;
  connectionsUrl?: string;
  updateConnection: (options: {
    unifiedApi: string;
    serviceId: string;
    values: any;
    resource?: string;
    quiet?: boolean;
  }) => Promise<Connection | null>;
  fetchResourceSchema: (resource: string) => Promise<any>;
  fetchResourceExample: (resource: string) => Promise<any>;
  fetchCustomFields: (resource: string) => Promise<any>;
  fetchConsentRecords: (connection: Connection) => Promise<any>;
}

const ConnectionsContext = createContext<Partial<ContextProps>>({});

interface Props {
  token: string;
  appId: string;
  consumerId: string;
  isOpen: boolean;
  unifiedApi?: string;
  serviceId?: string;
  children: ReactNode;
  onClose: () => any;
  onConnectionChange?: (connection: Connection) => any;
  onConnectionDelete?: (connection: Connection) => any;
  unifyBaseUrl: string;
}

export const ConnectionsProvider = ({
  token,
  appId,
  consumerId,
  isOpen,
  unifiedApi,
  serviceId,
  unifyBaseUrl,
  children,
  onConnectionChange,
  onConnectionDelete,
  onClose,
}: Props) => {
  const [selectedConnection, setSelectedConnection] =
    useState<Connection | null>(null);
  const [resources, setResources] = useState<
    { resource: string; defaults: FormField[] }[]
  >([]);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const { mutate } = useSWRConfig();
  const { addToast } = useToast();
  const { t } = useTranslation();

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

  const listUrl = `${unifyBaseUrl}/vault/connections${
    unifiedApi ? `?api=${unifiedApi}` : ''
  }`;
  const detailsUrl = `${unifyBaseUrl}/vault/connections/${selectedConnection?.unified_api}/${selectedConnection?.service_id}`;

  const { data, error } = useSWR(listUrl, fetcher, {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
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
      updateConnection({
        unifiedApi,
        serviceId,
        values: { enabled: true },
        quiet: true,
      });
    }
  }, [connection]);

  useEffect(() => {
    if (!connection) return;

    const { configurable_resources, state, enabled } = connection;
    const isReAuthorized = state === 'authorized' || state === 'callable';

    if (
      (configurable_resources ?? []).length > 0 &&
      isReAuthorized &&
      !resources.length &&
      !isUpdating &&
      enabled
    ) {
      getResourceConfig();
    }
  }, [connection]);

  const denyConsent = async (
    connection: Connection,
    resources: any
  ): Promise<void> => {
    try {
      setIsUpdating(true);
      const consentUrl = `${unifyBaseUrl}/vault/connections/${connection.unified_api}/${connection.service_id}/consent`;
      const response = await fetch(consentUrl, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ granted: false, resources }),
      });
      const result = await response.json();

      if (response.ok && result.data) {
        addToast({
          title: t('Consent denied'),
          description: t('Access to {{name}} was denied.', {
            name: connection.name,
          }),
          type: 'warning',
        });
        setSelectedConnection(null);
        const updatedConnection = {
          ...connection,
          consent_state: ConsentState.Denied,
        };
        const updatedList = {
          ...data,
          data: data.data.map((c: Connection) =>
            c.id === connection.id ? updatedConnection : c
          ),
        };
        mutate(listUrl, updatedList, { revalidate: false });
        mutate(detailsUrl, { data: updatedConnection }, { revalidate: false });
      } else {
        addToast({
          title: t('Updating failed'),
          description: result.message || 'An unexpected error occurred.',
          type: 'error',
        });
      }
    } catch (error) {
      addToast({
        title: t('Updating failed'),
        description: (error as any)?.message,
        type: 'error',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const revokeConsent = async (
    connection: Connection,
    resources: any
  ): Promise<void> => {
    try {
      setIsUpdating(true);
      const consentUrl = `${unifyBaseUrl}/vault/connections/${connection.unified_api}/${connection.service_id}/consent`;

      const response = await fetch(consentUrl, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ granted: false, resources }),
      });

      if (response.ok) {
        addToast({
          title: t('Access revoked'),
          description: t('Access to {{name}} has been revoked.', {
            name: connection.name,
          }),
          type: 'success',
        });
        setSelectedConnection(null);
        const updatedConnection = {
          ...connection,
          consent_state: ConsentState.Revoked,
        };
        const updatedList = {
          ...data,
          data: data.data.map((c: Connection) =>
            c.id === connection.id ? updatedConnection : c
          ),
        };
        mutate(listUrl, updatedList, { revalidate: false });
        mutate(detailsUrl, { data: updatedConnection }, { revalidate: false });
      } else {
        const result = await response.json();
        addToast({
          title: t('Revocation failed'),
          description: result.message || 'An unexpected error occurred.',
          type: 'error',
        });
      }
    } catch (error) {
      addToast({
        title: t('Revocation failed'),
        description: (error as any)?.message,
        type: 'error',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const grantConsent = async (
    connection: Connection,
    resources: any
  ): Promise<void> => {
    try {
      setIsUpdating(true);
      const consentUrl = `${unifyBaseUrl}/vault/connections/${connection.unified_api}/${connection.service_id}/consent`;
      const response = await fetch(consentUrl, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ granted: true, resources }),
      });
      const result = await response.json();

      if (response.ok && result.data) {
        const updatedConnection = {
          ...connection,
          consent_state: 'granted',
        };
        const updatedList = {
          ...data,
          data: data.data.map((c: Connection) =>
            c.id === connection.id ? updatedConnection : c
          ),
        };
        mutate(listUrl, updatedList, { revalidate: false });
        mutate(detailsUrl, { data: updatedConnection }, { revalidate: false });
        addToast({
          title: t('Consent granted'),
          description: t('You can now authorize the connection.'),
          type: 'success',
        });
      } else {
        addToast({
          title: t('Updating failed'),
          description: result.message || 'An unexpected error occurred.',
          type: 'error',
        });
      }
    } catch (error) {
      addToast({
        title: t('Updating failed'),
        description: (error as any)?.message,
        type: 'error',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const updateConnection = async ({
    unifiedApi,
    serviceId,
    values,
    resource,
    quiet,
  }: {
    unifiedApi: string;
    serviceId: string;
    values: any;
    resource?: string;
    quiet?: boolean;
  }): Promise<Connection | null> => {
    try {
      setIsUpdating(true);
      let updateUrl = `${unifyBaseUrl}/vault/connections/${unifiedApi}/${serviceId}`;
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
          mutate(`${unifyBaseUrl}/vault/connections`, updatedList, false);
        }

        // Update selected connection and mutate client cache
        const updatedDetail = {
          ...data,
          data: result.data,
        };

        mutate(updateUrl, updatedDetail, false);
        setSelectedConnection({ ...selectedConnection, ...result.data });

        if (resource) await getResourceConfig();

        if (!quiet) {
          const message = values.hasOwnProperty('enabled')
            ? `${result.data?.name} is ${
                values.enabled ? t('enabled') : t('disabled')
              }`
            : `${result.data?.name} ${t('settings are updated')}`;

          addToast({
            title: message,
            description: '',
            type: 'success',
            autoClose: true,
          });
        }

        onConnectionChange?.(result.data);

        return result.data;
      } else {
        addToast({
          title: t('Updating failed'),
          description: result.message,
          type: 'error',
        });
      }
      return null;
    } catch (error) {
      addToast({
        title: t('Updating failed'),
        description: (error as any)?.message,
        type: 'error',
      });
      return null;
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteConnection = async (connection: Connection) => {
    try {
      await fetch(
        `${unifyBaseUrl}/vault/connections/${connection.unified_api}/${connection.service_id}`,
        {
          method: 'DELETE',
          headers,
        }
      );

      if (singleConnectionMode) {
        // Clear the specific connection details cache to prevent stale data
        const detailsUrl = `${unifyBaseUrl}/vault/connections/${connection.unified_api}/${connection.service_id}`;
        mutate(detailsUrl, undefined, false);
        onClose();
      } else {
        const updatedConnection: Connection = {
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
        mutate(listUrl, updatedData, false);
        onConnectionDelete?.(updatedConnection);
        setSelectedConnection(null);
        addToast({
          title: t('{{connectionName}} is deleted', {
            connectionName: connection.name,
          }),
          type: 'success',
          autoClose: true,
        });
      }
    } catch (error) {
      addToast({
        title: `Deleting ${connection.name} connection failed`,
        description: (error as any)?.message,
        type: 'error',
      });
    }
  };

  const fetchConsentRecords = async (connection: Connection) => {
    try {
      const response = await fetch(
        `${unifyBaseUrl}/vault/connections/${connection.unified_api}/${connection.service_id}/consent`,
        { headers }
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch consent records');
      }
      return result.data;
    } catch (error) {
      addToast({
        title: t('Failed to fetch consent records'),
        description: (error as any)?.message,
        type: 'error',
      });
      return [];
    }
  };

  const fetchConfig = async (resource: string) => {
    if (!selectedConnection) return;
    const raw = await fetch(
      `${unifyBaseUrl}/vault/connections/${selectedConnection.unified_api}/${selectedConnection.service_id}/${resource}/config`,
      { headers }
    );
    const response = await raw.json();

    if (response.error) return response;

    return { resource, defaults: response?.data?.configuration };
  };

  const fetchCustomMapping = async (resource: string) => {
    if (!selectedConnection) return;

    try {
      const raw = await fetch(
        `${unifyBaseUrl}/vault/connections/${selectedConnection.unified_api}/${selectedConnection.service_id}/${resource}/custom-mapping`,
        { headers }
      );
      const response = await raw.json();

      if (response.error) {
        addToast({
          title: 'Failed to fetch custom mappings',
          description: response?.error?.message || response?.error,
          type: 'error',
        });
        return response;
      }
      return { resource, defaults: response?.data?.configuration };
    } catch (error) {
      console.error(error);
      addToast({
        title: 'Failed to fetch custom mappings',
        description: (error as Error)?.message,
        type: 'error',
      });
    }
  };

  const fetchResourceSchema = async (resource?: string) => {
    if (!selectedConnection || !resource) return;
    try {
      const raw = await fetch(
        `${unifyBaseUrl}/vault/connections/${selectedConnection.unified_api}/${selectedConnection.service_id}/${resource}/schema`,
        { headers }
      );

      return await raw.json();
    } catch (error) {
      console.error(error);
      addToast({
        title: 'Failed to fetch schema',
        description: (error as Error)?.message,
        type: 'error',
      });
    }
  };

  const fetchResourceExample = async (resource?: string) => {
    if (!selectedConnection || !resource) return;
    try {
      const raw = await fetch(
        `${unifyBaseUrl}/vault/connections/${selectedConnection.unified_api}/${selectedConnection.service_id}/${resource}/example`,
        { headers }
      );

      return await raw.json();
    } catch (error) {
      console.error(error);
      addToast({
        title: 'Failed to fetch example',
        description: (error as Error)?.message,
        type: 'error',
      });
    }
  };

  const fetchCustomFields = async (resource?: string) => {
    if (!selectedConnection || !resource) return;
    try {
      const raw = await fetch(
        `${unifyBaseUrl}/vault/connections/${selectedConnection.unified_api}/${selectedConnection.service_id}/${resource}/custom-fields`,
        { headers }
      );

      return await raw.json();
    } catch (error) {
      console.error(error);
      addToast({
        title: 'Failed to fetch custom fields',
        description: (error as Error)?.message,
        type: 'error',
      });
    }
  };

  const getResourceConfig = async () => {
    const requests: any = [];
    const resources = connection?.configurable_resources;

    resources?.forEach((resource: any) => {
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
      error: data?.message || error?.message,
      isLoading: !error && !data,
      isLoadingDetails: connection && !connection.id,
      isUpdating,
      resources,
      selectedConnection: connection,
      setSelectedConnection,
      singleConnectionMode,
      updateConnection,
      headers,
      token,
      fetchResourceSchema,
      fetchResourceExample,
      fetchCustomFields,
      fetchCustomMapping,
      fetcher,
      unifyBaseUrl,
      connectionsUrl: `${unifyBaseUrl}/vault/connections`,
      denyConsent,
      revokeConsent,
      grantConsent,
      fetchConsentRecords,
    }),
    [
      isUpdating,
      selectedConnection,
      data,
      connectionDetails,
      isOpen,
      resources,
      token,
      error,
      detailsError,
      fetchResourceSchema,
      denyConsent,
      revokeConsent,
      grantConsent,
      fetchConsentRecords,
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
