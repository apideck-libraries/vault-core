import '@testing-library/jest-dom/extend-expect';
import 'jest-location-mock';
import 'whatwg-fetch';

import * as React from 'react';

import { fetchMock, setupIntersectionObserverMock } from './mock';
import { fireEvent, render } from '@testing-library/react';

import { ADDED_CONNECTIONS_RESPONSE } from './responses/with-added-connections';
import { Connection } from '../src/types/Connection';
import ConnectionForm from '../src/components/ConnectionForm';
import { INVALID_SESSION_RESPONSE } from './responses/invalid-session';
import { act } from 'react-dom/test-utils';

const mockFunction = jest.fn();

const mockResponse = {
  updateConnection: mockFunction,
};

jest.mock('../src/utils/useConnections', () => {
  return {
    useConnections: () => {
      return mockResponse;
    },
  };
});

describe('Connection form - Invalid session', () => {
  beforeEach(() => jest.spyOn(window, 'fetch'));
  beforeEach(() => fetchMock(INVALID_SESSION_RESPONSE));
  beforeEach(() => setupIntersectionObserverMock());

  it('should render the connection form', async () => {
    let screen: any;
    await act(async () => {
      screen = render(
        <ConnectionForm
          connection={ADDED_CONNECTIONS_RESPONSE.data[0] as Connection}
          setShowSettings={() => {}}
        />
      );
    });

    expect(screen.getByTestId('connection-form')).toBeInTheDocument();
  });

  it('should submit the connection form', async () => {
    let screen: any;
    const baseUrl = 'https://apideck1600217394.justtesting.com';
    const apiKey = 'abcdefg';

    await act(async () => {
      screen = render(
        <ConnectionForm
          connection={ADDED_CONNECTIONS_RESPONSE.data[0] as Connection}
          setShowSettings={() => {}}
        />
      );

      const inputUrl = screen.getByTestId('base_url');
      const inputKey = screen.getByTestId('api_key');
      const submit = screen.getByText('Save');

      fireEvent.change(inputUrl, {
        target: { value: baseUrl },
      });
      fireEvent.change(inputKey, {
        target: { value: apiKey },
      });

      fireEvent.click(submit);
    });

    expect(mockFunction).toHaveBeenCalledWith('crm', 'activecampaign', {
      settings: {
        api_key: apiKey,
        base_url: baseUrl,
      },
    });
  });
});
