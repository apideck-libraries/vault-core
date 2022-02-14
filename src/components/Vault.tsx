import React, {
  Fragment,
  ReactElement,
  forwardRef,
  useEffect,
  useState,
} from 'react';

import { ConnectionsProvider } from '../utils/useConnections';
import Logo from './Logo';
import Modal from './Modal';
import { ModalContent } from './ModalContent';
import { ToastProvider } from '@apideck/components';

export interface Props {
  /**
   * The ID of your Unify application
   */
  appId: string;
  /**
   * The ID of the consumer which you want to fetch files from
   */
  consumerId: string;
  /**
   * The JSON Web Token returned from the Create Session call
   */
  jwt: string;
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
    appId,
    consumerId,
    jwt,
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

  const handleClick = () => {
    const hasProvidedCredentials = appId && consumerId && jwt;
    if (hasProvidedCredentials) {
      setIsOpen(true);
    } else {
      console.error(
        'You need to provide appId, consumerId and jwt to use Vault'
      );
    }
  };

  return (
    <Fragment>
      {trigger
        ? React.cloneElement(trigger, { onClick: () => handleClick(), ref })
        : null}
      <Modal isOpen={isOpen} onClose={() => onCloseModal()}>
        <ToastProvider>
          <ConnectionsProvider
            appId={appId}
            consumerId={consumerId}
            jwt={jwt}
            isOpen={isOpen}
            unifiedApi={unifiedApi}
            serviceId={serviceId}
          >
            <ModalContent onClose={onCloseModal} />
          </ConnectionsProvider>
        </ToastProvider>
      </Modal>
      {showAttribution ? (
        <a
          className="z-50 fixed flex text-sm text-center text-gray-100 bottom-5 left-[calc(50% - 85px)] lg:left-5 xl:left-6 xl:bottom-6"
          href="https://apideck.com/products/unify"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by <Logo className="h-5" />
        </a>
      ) : null}
    </Fragment>
  );
});
