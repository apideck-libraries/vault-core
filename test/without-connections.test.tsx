import '@testing-library/jest-dom/extend-expect';
import 'jest-location-mock';
import 'whatwg-fetch';

import * as React from 'react';

import { fetchMock, setupIntersectionObserverMock } from './mock';
import {
  fireEvent,
  render,
  waitFor,
  waitForElementToBeRemoved,
} from '@testing-library/react';

import { ADD_CONNECTION_RESPONSE } from './responses/add-connection';
import { NO_ADDED_CONNECTIONS_RESPONSE } from './responses/no-added-connections';
import { Vault } from '../src/components/Vault';
import { act } from 'react-dom/test-utils';

describe('Vault - With no connections added yet', () => {
  beforeEach(() => jest.spyOn(window, 'fetch'));
  beforeEach(() => fetchMock(NO_ADDED_CONNECTIONS_RESPONSE));
  beforeEach(() => setupIntersectionObserverMock());

  it('should show the Manage your integrations message', async () => {
    let screen: any;
    await act(async () => {
      screen = render(<Vault appId="x" consumerId="x" jwt="x" open />);
    });

    expect(screen.getByText('Manage your integrations')).toBeInTheDocument();
  });

  it('should not show the tab select', async () => {
    let screen: any;
    await act(async () => {
      screen = render(<Vault appId="x" consumerId="x" jwt="x" open />);
    });

    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
    expect(screen.queryByText('Available')).not.toBeInTheDocument();
  });

  it('should show the search input', async () => {
    let screen: any;
    await act(async () => {
      screen = render(<Vault appId="x" consumerId="x" jwt="x" open />);
    });

    expect(screen.getByTestId('search-input')).toBeInTheDocument();
  });

  it('should show the list of connectors', async () => {
    let screen: any;
    await act(async () => {
      screen = render(<Vault appId="x" consumerId="x" jwt="x" open />);
    });

    expect(screen.getAllByText('ActiveCampaign')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Copper')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Close')[0]).toBeInTheDocument();
  });

  it('should search connectors', async () => {
    let screen: any;
    await act(async () => {
      screen = render(<Vault appId="x" consumerId="x" jwt="x" open />);
    });
    const searchInput = screen.getByTestId('search-input');

    // Search for Copper
    fireEvent.change(searchInput, { target: { value: 'coppper' } });

    await waitFor(() => {
      expect(screen.getByTestId('crm+copper')).toBeInTheDocument();
      expect(screen.getByTestId('lead+copper')).toBeInTheDocument();
    });

    expect(screen.queryByText('ActiveCampaign')).not.toBeInTheDocument();

    // Search for ActiveCampaign
    fireEvent.change(searchInput, { target: { value: 'active' } });

    await waitFor(() => {
      expect(screen.getByTestId('crm+activecampaign')).toBeInTheDocument();
      expect(screen.getByTestId('lead+activecampaign')).toBeInTheDocument();
    });

    expect(screen.queryByText('Copper')).not.toBeInTheDocument();
  });

  describe('Adding a connection', () => {
    beforeEach(() => jest.spyOn(window, 'fetch'));
    beforeEach(() => fetchMock(ADD_CONNECTION_RESPONSE));

    it('should show the list of connectors', async () => {
      let screen: any;
      await act(async () => {
        screen = render(<Vault appId="x" consumerId="x" jwt="x" open />);
      });

      const firstConnection = screen.getByTestId('crm+activecampaign');
      fireEvent.click(firstConnection);

      waitForElementToBeRemoved(firstConnection).then(() => {
        const connectionDetails = screen.getByTestId(
          'details-crm+activecampaign'
        );

        expect(connectionDetails).toBeInTheDocument();
      });
    });
  });
});
