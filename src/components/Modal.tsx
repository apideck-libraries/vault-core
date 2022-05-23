import { Dialog, Transition } from '@headlessui/react';
import React, {
  CSSProperties,
  Fragment,
  ReactNode,
  useEffect,
  useState,
} from 'react';

import Logo from './Logo';
import classNames from 'classnames';
import { createPortal } from 'react-dom';

export interface Props extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  onClose: () => void;
  isOpen: boolean;
  className?: string;
  style?: CSSProperties;
  showAttribution?: boolean;
}

const Modal: any = ({
  children,
  onClose,
  isOpen = false,
  showAttribution,
  className = '',
  style = {},
}: Props) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const modalComponent = (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        className={classNames(
          'fixed inset-0 z-40 overflow-y-auto bg-gray-400 bg-opacity-75',
          className
        )}
        onClose={onClose}
        style={style}
        data-testid="backdrop"
        id="react-vault-backdrop"
      >
        <div className="min-h-screen px-4 text-center">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Dialog.Overlay className="fixed inset-0" />
          </Transition.Child>

          {/* This element is to trick the browser into centering the modal contents. */}
          <span
            className="inline-block h-screen align-middle"
            aria-hidden="true"
          >
            &#8203;
          </span>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <div
              className="inline-block w-full text-left max-w-sm p-6 my-12 lg:my-16 align-middle transition-all transform bg-white shadow-xl rounded-xl"
              id="react-vault-modal"
            >
              {children}
            </div>
          </Transition.Child>
          {showAttribution ? (
            <a
              className="fixed flex text-sm text-center text-gray-100 bottom-5 left-[calc(50% - 85px)] lg:left-5 xl:left-6 xl:bottom-6"
              href="https://apideck.com/products/unify"
              target="_blank"
              rel="noopener noreferrer"
            >
              Powered by <Logo className="h-5" />
            </a>
          ) : null}
        </div>
      </Dialog>
    </Transition>
  );

  return mounted ? createPortal(modalComponent, document.body) : null;
};

export default Modal;
