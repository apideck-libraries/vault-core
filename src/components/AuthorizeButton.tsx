import React, { useState } from 'react';

import { Button } from '@apideck/components';
import { useConnections } from '../utils/useConnections';

interface Props {
  text?: string;
  authorizeUrl: string;
}

const AuthorizeButton = ({ authorizeUrl, text = 'Authorize' }: Props) => {
  const [isLoading, setIsLoading] = useState(false);
  const { mutateDetail } = useConnections();

  const handleChildWindowCLose = () => {
    mutateDetail();
    setIsLoading(false);
  };

  return (
    <Button
      text={text}
      isLoading={isLoading}
      size="large"
      className="w-full px-12 py-3 text-base font-bold leading-7 text-white transition-all duration-200 bg-gray-900 border-2 border-transparent rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 hover:bg-gray-700"
      onClick={() => {
        const child = window.open(
          authorizeUrl,
          '_blank',
          'location=no,height=800,width=600,scrollbars=yes,status=yes,left=0,top=0'
        );
        const timer = setInterval(checkChild, 500);
        setIsLoading(true);
        function checkChild() {
          if (child.closed) {
            clearInterval(timer);
            handleChildWindowCLose();
          }
        }
      }}
    />
  );
};

export default AuthorizeButton;
