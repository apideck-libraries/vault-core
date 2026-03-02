import '@testing-library/jest-dom/extend-expect';
import 'whatwg-fetch';

import * as React from 'react';

import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { useConnectionActions } from '../src/utils/connectionActions';

const mockAddToast = jest.fn();
const mockMutate = jest.fn().mockResolvedValue({ data: {} });

jest.mock('@apideck/components', () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

jest.mock('swr', () => ({
  useSWRConfig: () => ({ mutate: mockMutate }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../src/utils/useConnections', () => ({
  useConnections: () => ({
    selectedConnection: {
      id: 'ecommerce+test-connector',
      name: 'Test Connector',
      unified_api: 'ecommerce',
      service_id: 'test-connector',
      auth_type: 'oauth2',
      state: 'authorized',
      enabled: true,
    },
    updateConnection: jest.fn(),
    connectionsUrl: 'https://unify.apideck.com/vault/connections',
    headers: {
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
    },
  }),
}));

const TestComponent = () => {
  const { handleRedirect } = useConnectionActions();
  return (
    <button
      onClick={() => handleRedirect('https://auth.example.com/authorize')}
    >
      Redirect
    </button>
  );
};

describe('connectionActions OAuth confirm flow', () => {
  let mockChild: { closed: boolean };

  beforeEach(() => {
    mockChild = { closed: false };
    jest.spyOn(window, 'open').mockReturnValue(mockChild as any);
    jest.spyOn(window, 'fetch');
    (window.fetch as any).mockImplementation(() =>
      Promise.resolve({ ok: true, status: 200, json: async () => ({}) })
    );
    mockAddToast.mockClear();
    mockMutate.mockClear();
    mockMutate.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it('adds message event listener when redirect popup opens', async () => {
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener');

    let screen: any;
    await act(async () => {
      screen = render(<TestComponent />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Redirect'));
    });

    const messageListenerCalls = addEventListenerSpy.mock.calls.filter(
      ([event]) => event === 'message'
    );
    expect(messageListenerCalls).toHaveLength(1);
  });

  it('calls confirm endpoint when oauth-confirm message is received', async () => {
    let screen: any;
    await act(async () => {
      screen = render(<TestComponent />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Redirect'));
    });

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'oauth-confirm', confirmToken: 'test-uuid' },
        })
      );
    });

    await waitFor(() => {
      const fetchCalls = (window.fetch as jest.Mock).mock.calls;
      const confirmCall = fetchCalls.find(([url]: [string]) =>
        url.includes('/vault/oauth/confirm')
      );
      expect(confirmCall).toBeDefined();
      expect(confirmCall[1]).toEqual(
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ confirm_token: 'test-uuid' }),
        })
      );
    });
  });

  it('shows error toast when confirm endpoint returns 403', async () => {
    (window.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/vault/oauth/confirm')) {
        return Promise.resolve({
          ok: false,
          status: 403,
          json: async () => ({}),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
      });
    });

    let screen: any;
    await act(async () => {
      screen = render(<TestComponent />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Redirect'));
    });

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'oauth-confirm', confirmToken: 'test-uuid' },
        })
      );
    });

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
    });
  });

  it('shows error toast when confirm endpoint fails with network error', async () => {
    (window.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/vault/oauth/confirm')) {
        return Promise.reject(new Error('Network error'));
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
      });
    });

    let screen: any;
    await act(async () => {
      screen = render(<TestComponent />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Redirect'));
    });

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'oauth-confirm', confirmToken: 'test-uuid' },
        })
      );
    });

    await waitFor(() => {
      expect(mockAddToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'error' })
      );
    });
  });

  it('removes message event listener when popup closes', async () => {
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');

    let screen: any;
    await act(async () => {
      screen = render(<TestComponent />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Redirect'));
    });

    mockChild.closed = true;

    await waitFor(
      () => {
        const removeMessageCalls = removeEventListenerSpy.mock.calls.filter(
          ([event]) => event === 'message'
        );
        expect(removeMessageCalls).toHaveLength(1);
      },
      { timeout: 2000 }
    );
  });

  it('proceeds normally when no oauth-confirm message is received', async () => {
    let screen: any;
    await act(async () => {
      screen = render(<TestComponent />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Redirect'));
    });

    // Close popup without sending any message
    mockChild.closed = true;

    await waitFor(
      () => {
        expect(mockMutate).toHaveBeenCalledWith(
          'https://unify.apideck.com/vault/connections/ecommerce/test-connector'
        );
      },
      { timeout: 2000 }
    );
  });
});
