import '@testing-library/jest-dom/extend-expect';
import 'jest-location-mock';
import 'whatwg-fetch';

import * as React from 'react';

import { fetchMock, setupIntersectionObserverMock } from './mock';

import { ADDED_CONNECTIONS_RESPONSE } from './responses/with-added-connections';
import { Vault } from '../src/components/Vault';
import { act } from 'react-dom/test-utils';
import { render } from '@testing-library/react';

describe('Vault - With connections', () => {
  beforeEach(() => jest.spyOn(window, 'fetch'));
  beforeEach(() => fetchMock(ADDED_CONNECTIONS_RESPONSE));
  beforeEach(() => setupIntersectionObserverMock());

  it('should not show the Manage your integrations message', async () => {
    let screen: any;
    await act(async () => {
      screen = render(<Vault appId="x" consumerId="x" jwt="x" open />);
    });

    expect(
      screen.queryByText('Manage your integrations')
    ).not.toBeInTheDocument();
  });

  it('should show the tab select', async () => {
    let screen: any;
    await act(async () => {
      screen = render(<Vault appId="x" consumerId="x" jwt="x" open />);
    });

    expect(screen.queryByText('Connected')).toBeInTheDocument();
    expect(screen.queryByText('Available')).toBeInTheDocument();
  });

  it('should show the search input', async () => {
    let screen: any;
    await act(async () => {
      screen = render(<Vault appId="x" consumerId="x" jwt="x" open />);
    });

    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });

  it('should show the list of added connectors', async () => {
    let screen: any;
    await act(async () => {
      screen = render(<Vault appId="x" consumerId="x" jwt="x" open />);
    });

    expect(screen.getAllByText('ActiveCampaign')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Close')[0]).toBeInTheDocument();
  });
});
