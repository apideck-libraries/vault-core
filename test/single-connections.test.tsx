import '@testing-library/jest-dom/extend-expect';
import 'jest-location-mock';
import 'whatwg-fetch';

import * as React from 'react';

import { fetchMock, setupIntersectionObserverMock } from './mock';
import { render, waitFor } from '@testing-library/react';

import { Vault } from '../src/components/Vault';
import { act } from 'react-dom/test-utils';

describe('Vault - Single connection', () => {
  beforeEach(() => jest.spyOn(window, 'fetch'));
  beforeEach(() => setupIntersectionObserverMock());
  beforeEach(() => fetchMock());

  it('should not show the list of connectors, search input and the tabs', async () => {
    let screen: any;
    await act(async () => {
      screen = render(
        <Vault
          appId="x"
          consumerId="x"
          jwt="x"
          open
          unifiedApi="crm"
          serviceId="activecampaign"
          showAttribution={false}
        />
      );
    });

    expect(
      screen.queryByText('Manage your integrations')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Close')).not.toBeInTheDocument();
    expect(screen.queryByText('Search integrations')).not.toBeInTheDocument();
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
    expect(screen.queryByText('Available')).not.toBeInTheDocument();
  });

  it('should should show the connector details', async () => {
    let screen: any;
    await act(async () => {
      screen = render(
        <Vault
          appId="x"
          consumerId="x"
          jwt="x"
          open
          unifiedApi="crm"
          serviceId="activecampaign"
          showAttribution={false}
        />
      );
    });

    waitFor(() => {
      expect(
        screen.getByTestId('details-crm+activecampaign')
      ).not.toBeInTheDocument();
    });
  });

  it('should should show the status of the connection', async () => {
    let screen: any;
    await act(async () => {
      screen = render(
        <Vault
          appId="x"
          consumerId="x"
          jwt="x"
          open
          unifiedApi="crm"
          serviceId="activecampaign"
          showAttribution={false}
        />
      );
    });

    waitFor(() => {
      expect(screen.getByTestId('status-badge')).toHaveTextContent('Connected');
    });
  });
});
