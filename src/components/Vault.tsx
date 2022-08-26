import React, { ReactElement, forwardRef, useEffect, useState } from 'react';

import { BASE_URL } from '../constants/urls';
import { ConnectionsProvider } from '../utils/useConnections';
import Modal from './Modal';
import { ModalContent } from './ModalContent';
import { ToastProvider } from '@apideck/components';
import jwtDecode from 'jwt-decode';

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
    unifiedApi,
    serviceId,
    unifyBaseUrl = BASE_URL,
  },
  ref
) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [jwt, setJwt] = useState<string | null>(null);
  const [consumerId, setConsumerId] = useState<string | null>(null);
  const [appId, setAppId] = useState<string | null>(null);

  const onCloseModal = () => {
    setIsOpen(false);
    if (onClose) {
      onClose();
    }
  };

  useEffect(() => {
    if (open) {
      if (token) {
        setIsOpen(true);
      } else {
        console.error(NO_TOKEN_MESSAGE);
      }
    }
  }, [open, token]);

  useEffect(() => {
    if (token?.length) {
      let decoded;

      try {
        decoded =
          jwtDecode<{ application_id: string; consumer_id: string }>(token);

        setJwt(token);
        setConsumerId(decoded.consumer_id);
        setAppId(decoded.application_id);
      } catch (e) {
        console.error(e);
        console.error(INVALID_TOKEN_MESSAGE);
        setJwt(null);
        setConsumerId(null);
        setAppId(null);
      }
    }
  }, [token]);

  const shouldRenderModal = (token && token?.length > 0 && isOpen) || trigger;

  return (
    <div id="react-vault">
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
              appId={appId as string}
              consumerId={consumerId as string}
              token={jwt as string}
              isOpen={isOpen}
              unifiedApi={unifiedApi}
              serviceId={serviceId}
              connectionsUrl={`${unifyBaseUrl}/vault/connections`}
            >
              <ModalContent onClose={onCloseModal} />
            </ConnectionsProvider>
          </ToastProvider>
        </Modal>
      ) : null}
    </div>
  );
});
