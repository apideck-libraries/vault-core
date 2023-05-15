import { Dialog, Transition } from '@headlessui/react';
import React, {
  CSSProperties,
  Fragment,
  ReactNode,
  useEffect,
  useState,
} from 'react';

import classNames from 'classnames';
import { createPortal } from 'react-dom';
import Logo from './Logo';

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
    <Transition.Root appear show={isOpen} as={Fragment}>
      <Dialog
        as="div"
        onClose={onClose}
        style={style}
        className="apideck react-vault"
      >
        <div
          data-testid="backdrop"
          id="react-vault"
          className={classNames(
            'fixed inset-0 z-40 group overflow-y-auto bg-gray-400 bg-opacity-75',
            className
          )}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-8 h-8 absolute right-6 top-6 cursor-pointer text-gray-100 hover:text-white"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>

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
                className="inline-block w-full text-left max-w-sm p-6 my-12 lg:my-16 align-middle transition-all transform bg-white shadow-xl rounded-lg"
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
        </div>
      </Dialog>
    </Transition.Root>
  );

  return mounted ? createPortal(modalComponent, document.body) : null;
};

export default Modal;
