import React, {
  Fragment,
  ReactElement,
  forwardRef,
  useEffect,
  useState,
} from 'react';

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
}

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
  },
  ref
) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  let decoded;

  try {
    decoded = jwtDecode<{ application_id: string; consumer_id: string }>(token);
  } catch (e: any) {
    console.error(
      'Invalid token provided. Make sure you first create a session and then provide the returned token. https://developers.apideck.com/apis/vault/reference#operation/sessionsCreate'
    );
  }

  const appId = decoded?.application_id;
  const consumerId = decoded?.consumer_id;

  const onCloseModal = () => {
    setIsOpen(false);
    if (onClose) {
      onClose();
    }
  };

  useEffect(() => {
    if (open) {
      setIsOpen(true);
    }
  }, [open]);

  return (
    <Fragment>
      {trigger
        ? React.cloneElement(trigger, { onClick: () => setIsOpen(true), ref })
        : null}
      <Modal
        isOpen={isOpen}
        onClose={() => onCloseModal()}
        showAttribution={showAttribution}
      >
        <ToastProvider>
          <ConnectionsProvider
            appId={appId}
            consumerId={consumerId}
            token={token}
            isOpen={isOpen}
            unifiedApi={unifiedApi}
            serviceId={serviceId}
          >
            <ModalContent onClose={onCloseModal} />
          </ConnectionsProvider>
        </ToastProvider>
      </Modal>
    </Fragment>
  );
});
