import React, { useState } from 'react';

import { Button } from '@apideck/components';
import { Connection } from '../types/Connection';
import { REDIRECT_URL } from '../constants/urls';
import { useConnections } from '../utils/useConnections';
import { useSWRConfig } from 'swr';

interface Props {
  connection: Connection;
}

const AuthorizeButton = ({ connection }: Props) => {
  const [isLoading, setIsLoading] = useState(false);
  const { connectionsUrl } = useConnections();

  const { mutate } = useSWRConfig();

  const authorizeUrl = `${connection.authorize_url}&redirect_uri=${REDIRECT_URL}`;

  const handleChildWindowCLose = () => {
    mutate(
      `${connectionsUrl}/${connection?.unified_api}/${connection?.service_id}`
    );
    setIsLoading(false);
  };

  return (
    <Button
      text={`Authorize ${connection.name}`}
      isLoading={isLoading}
      size="large"
      className="w-full"
      onClick={() => {
        const child = window.open(
          authorizeUrl,
          '_blank',
          'location=no,height=750,width=550,scrollbars=yes,status=yes,left=0,top=0'
        );
        const timer = setInterval(checkChild, 500);
        setIsLoading(true);
        function checkChild() {
          if (child?.closed) {
            clearInterval(timer);
            handleChildWindowCLose();
          }
        }
      }}
    />
  );
};

export default AuthorizeButton;
