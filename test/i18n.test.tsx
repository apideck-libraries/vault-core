import '@testing-library/jest-dom/extend-expect';
import 'jest-location-mock';
import 'whatwg-fetch';

import * as React from 'react';

import { fetchMock, setupIntersectionObserverMock } from './mock';

import { ADDED_CONNECTIONS_RESPONSE } from './responses/with-added-connections';
import { Vault } from '../src/components/Vault';
import { act } from 'react-dom/test-utils';
import { render } from '@testing-library/react';

describe('Vault - With languages', () => {
  beforeEach(() => jest.spyOn(window, 'fetch'));
  beforeEach(() => fetchMock(ADDED_CONNECTIONS_RESPONSE));
  beforeEach(() => setupIntersectionObserverMock());

  it('should show the english text', async () => {
    let screen: any;
    await act(async () => {
      screen = render(<Vault token="token123" open locale="en" />);
    });

    expect(screen.queryByText('Available')).toBeInTheDocument();
  });
  it('should show the dutch text', async () => {
    let screen: any;
    await act(async () => {
      screen = render(<Vault token="token123" open locale="nl" />);
    });

    expect(screen.queryByText('Beschikbaar')).toBeInTheDocument();
  });
  it('should show the german text', async () => {
    let screen: any;
    await act(async () => {
      screen = render(<Vault token="token123" open locale="de" />);
    });

    expect(screen.queryByText('Verfügbar')).toBeInTheDocument();
  });
  it('should show the french text', async () => {
    let screen: any;
    await act(async () => {
      screen = render(<Vault token="token123" open locale="fr" />);
    });

    expect(screen.queryByText('Disponible')).toBeInTheDocument();
  });
  it('should show the spanish text', async () => {
    let screen: any;
    await act(async () => {
      screen = render(<Vault token="token123" open locale="es" />);
    });

    expect(screen.queryByText('Disponible')).toBeInTheDocument();
  });
});
