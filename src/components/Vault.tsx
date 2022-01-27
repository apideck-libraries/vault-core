import React, {
  Fragment,
  ReactElement,
  forwardRef,
  useEffect,
  useState,
} from 'react';

import { Modal } from './Modal';
import { ModalContent } from './ModalContent';
import { SessionProvider } from '../utils/useSession';

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
   * Title shown in the modal
   */
  title?: string;
  /**
   * Subtitle shown in the modal
   */
  subTitle?: string;
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
    title,
    // subTitle,
    showAttribution = true,
    open = false,
    onClose,
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
      <SessionProvider appId={appId} consumerId={consumerId} jwt={jwt}>
        <Modal
          isOpen={isOpen}
          onClose={() => onCloseModal()}
          showAttribution={showAttribution}
        >
          <ModalContent />
        </Modal>
      </SessionProvider>
    </Fragment>
  );
});
