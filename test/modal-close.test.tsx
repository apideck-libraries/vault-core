import '@testing-library/jest-dom/extend-expect';
import 'jest-location-mock';
import 'whatwg-fetch';

import * as React from 'react';

import { fetchMock, setupIntersectionObserverMock } from './mock';
import { fireEvent, render, waitFor } from '@testing-library/react';

import { NO_ADDED_CONNECTIONS_RESPONSE } from './responses/no-added-connections';
import { Vault } from '../src/components/Vault';
import { act } from 'react-dom/test-utils';

describe('Vault - Modal close affordances', () => {
  beforeEach(() => jest.spyOn(window, 'fetch'));
  beforeEach(() => fetchMock(NO_ADDED_CONNECTIONS_RESPONSE));
  beforeEach(() => setupIntersectionObserverMock());

  it('renders a persistent backdrop close button', async () => {
    let screen: any;
    await act(async () => {
      screen = render(<Vault token="token123" open />);
    });

    expect(screen.getByTestId('modal-close')).toBeInTheDocument();
  });

  it('calls onClose when the backdrop close button is clicked', async () => {
    const onClose = jest.fn();
    let screen: any;
    await act(async () => {
      screen = render(<Vault token="token123" open onClose={onClose} />);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('modal-close'));
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('closes on Escape without first focusing the modal', async () => {
    const onClose = jest.fn();
    await act(async () => {
      render(<Vault token="token123" open onClose={onClose} />);
    });

    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
