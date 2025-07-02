import React, {
  ReactElement,
  forwardRef,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { ToastProvider } from '@apideck/components';
import jwtDecode from 'jwt-decode';
import { useTranslation } from 'react-i18next';
import { BASE_URL } from '../constants/urls';
import { Connection } from '../types/Connection';
import { ConnectionViewType } from '../types/ConnectionViewType';
import { Session } from '../types/Session';
import '../utils/i18n';
import { ConnectionsProvider } from '../utils/useConnections';
import { SessionProvider } from '../utils/useSession';
import Modal from './Modal';
import { ModalContent } from './ModalContent';

export interface Props {
  /**
   * The JSON Web Token returned from the Create Session call
   */
  token: string;
  /**
   * The component that should trigger the File Picker modal on click
   */
  trigger?: ReactElement;
  /**
   * Show powered by Apideck in the modal backdrop
   */
  showAttribution?: boolean;
  /**
   * Opens the file picker if set to true
   */
  open?: boolean;
  /**
   * Callback function that gets called when the modal is closed
   */
  onClose?: () => any;
  /**
   * Callback function that gets called when the user updates a connection. This can be linking their account, filling out settings or adding a new connection
   */
  onConnectionChange?: (connection: Connection) => any;
  /**
   * Callback function that gets called when the user deletes a connection
   */
  onConnectionDelete?: (connection: Connection) => any;
  /**
   * Optionally you can filter connection on API. You can also provide the unifiedApi to go straight to the connection details view.
   * It that case make sure you also pass the serviceId.
   */
  unifiedApi?: string;
  /**
   * Optionally you can give a serviceId to go straight to the connection details view
   * Make sure you also pass the unifiedApi
   */
  serviceId?: string;
  /**
   * Optionally you can give a unifyBaseUrl for changing the base url of the unified API
   * Should only be used for local development or in a staging environment
   */
  unifyBaseUrl?: string;

  /**
   * Optionally you can show the consumer metadata information in the modal
   * The consumer metadata should be provided when creating a session
   * @default false
   * */
  showConsumer?: boolean;

  /**
   * Optionally you can directly open one of the following views: 'configurable-resources', 'custom-mapping', 'settings'
   * @default false
   * */
  initialView?: ConnectionViewType;

  /**
   * Optionally you can directly and one of the following locales: 'en', 'nl', 'fr', 'es', and 'de'.
   * @default en
   * */
  locale?: string;

  /**
   * Optionally you can show the language switch dropdown in the modal
   * @default false
   * */
  showLanguageSwitch?: boolean;

  /**
   * Use button layout instead of dropdown menu in TopBar for connection actions
   * @default false
   * */
  showButtonLayout?: boolean;
}

const SESSION_MESSAGE = `Make sure you first create a session and then provide the returned token to the component. https://developers.apideck.com/apis/vault/reference#operation/sessionsCreate`;
const INVALID_TOKEN_MESSAGE = `Invalid token provided to React Vault. ${SESSION_MESSAGE}`;
const NO_TOKEN_MESSAGE = `No token provided to React Vault. ${SESSION_MESSAGE}`;

/**
 * The Apideck Vault component
 */
export const Vault = forwardRef<HTMLElement, Props>(function Vault(
  {
    token,
    trigger,
    showAttribution = true,
    open = false,
    onClose,
    onConnectionChange,
    onConnectionDelete,
    unifiedApi,
    serviceId,
    unifyBaseUrl = BASE_URL,
    showConsumer = false,
    initialView,
    locale = 'en',
    showLanguageSwitch = false,
    showButtonLayout = false,
  },
  ref
) {
  const dataScopesEnabledForTesting = false; // TODO: Remove this when done with local testing

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [jwt, setJwt] = useState<string | null>(null);
  const [session, setSession] = useState<Session>({});
  const { i18n } = useTranslation();

  const onCloseModal = () => {
    if (isOpen) {
      setIsOpen(false);
      if (onClose) onClose();
    }
  };

  useEffect(() => {
    if (locale !== i18n.language) {
      i18n.changeLanguage(locale);
    }
  }, [locale]);

  useEffect(() => {
    if (open && !token) {
      console.error(NO_TOKEN_MESSAGE);
      return;
    }
    if (open && token && !isOpen) {
      setIsOpen(open);
      return;
    }
    if (!open && isOpen) {
      onCloseModal();
    }
  }, [open, token]);

  useEffect(() => {
    if (token?.length) {
      try {
        const decoded = jwtDecode<Session>(token);

        setJwt(token);
        setSession(decoded);
      } catch (e) {
        if (process.env.NODE_ENV !== 'test') {
          console.error(e);
          console.error(INVALID_TOKEN_MESSAGE);
        }
        setJwt(null);
        setSession({} as unknown as Session);
      }
    }
  }, [token]);

  // TODO: Keep for now, I'll remove this later when done with local testing
  const sessionWithMockedScopes = useMemo(() => {
    if (!dataScopesEnabledForTesting) {
      return session;
    }
    return {
      ...session,
      data_scopes: {
        enabled: true,
        modified: new Date().toISOString(),
        resources: {
          'hris.employees': {
            id: { read: true, write: false },
            first_name: { read: true, write: true },
            last_name: { read: true, write: true },
            email: { read: true, write: true },
            'employment.job_title': { read: true, write: true },
          },
          'hris.departments': {
            id: { read: true, write: false },
            name: { read: true, write: true },
          },
          'accounting.invoices': {
            id: { read: true, write: false },
            type: { read: true, write: true },
            status: { read: false, write: true },
            date: { read: true, write: true },
            total: { read: true, write: true },
            'customer.name': { read: true, write: true },
            'customer.id': { read: true, write: true },
            'customer.email': { read: true, write: true },
            'customer.phone': { read: true, write: true },
            'customer.address': { read: true, write: true },
          },
        },
      },
    };
  }, [session, dataScopesEnabledForTesting]);

  const shouldRenderModal = (token && token?.length > 0 && isOpen) || trigger;

  return (
    <div id="react-vault" className="apideck">
      {trigger
        ? React.cloneElement(trigger, { onClick: () => setIsOpen(true), ref })
        : null}
      {shouldRenderModal ? (
        <Modal
          isOpen={token && token?.length > 0 && isOpen}
          onClose={() => onCloseModal()}
          showAttribution={showAttribution}
        >
          <ToastProvider>
            <ConnectionsProvider
              appId={session?.application_id as string}
              consumerId={session?.consumer_id as string}
              token={jwt as string}
              isOpen={isOpen}
              onClose={onCloseModal}
              onConnectionChange={onConnectionChange}
              onConnectionDelete={onConnectionDelete}
              unifiedApi={unifiedApi}
              serviceId={serviceId}
              unifyBaseUrl={unifyBaseUrl}
            >
              <SessionProvider session={sessionWithMockedScopes}>
                <ModalContent
                  onClose={onCloseModal}
                  onConnectionChange={onConnectionChange}
                  consumer={
                    showConsumer ? session?.consumer_metadata : undefined
                  }
                  initialView={initialView}
                  showLanguageSwitch={showLanguageSwitch}
                  showButtonLayout={showButtonLayout}
                />
              </SessionProvider>
            </ConnectionsProvider>
          </ToastProvider>
        </Modal>
      ) : null}
    </div>
  );
});
