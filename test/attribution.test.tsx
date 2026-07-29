import '@testing-library/jest-dom/extend-expect';
import 'jest-location-mock';
import 'whatwg-fetch';

import * as React from 'react';

import { fetchMock, setupIntersectionObserverMock } from './mock';

import { NO_ADDED_CONNECTIONS_RESPONSE } from './responses/no-added-connections';
import { Vault } from '../src/components/Vault';
import { act } from 'react-dom/test-utils';
import { render } from '@testing-library/react';

// jwt-decode does not verify signatures, so an unsigned token is enough to
// drive the session the component reads.
const tokenWithClaims = (claims: Record<string, unknown>) => {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');

  return [
    encode({ alg: 'HS256', typ: 'JWT' }),
    encode({
      application_id: 'app-1',
      consumer_id: 'consumer-1',
      ...claims,
    }),
    'not-a-real-signature',
  ].join('.');
};

describe('Vault - Apideck attribution', () => {
  beforeEach(() => jest.spyOn(window, 'fetch'));
  beforeEach(() => fetchMock(NO_ADDED_CONNECTIONS_RESPONSE));
  beforeEach(() => setupIntersectionObserverMock());

  const renderVault = async (
    claims: Record<string, unknown>,
    props: Record<string, unknown> = {}
  ) => {
    let screen: any;
    await act(async () => {
      screen = render(
        <Vault token={tokenWithClaims(claims)} open {...props} />
      );
    });
    return screen;
  };

  it('shows the pill for a token with no attribution claim', async () => {
    const screen = await renderVault({});

    expect(screen.queryByText('Powered by')).toBeInTheDocument();
  });

  it('shows the pill when the claim says it is not hidden', async () => {
    const screen = await renderVault({
      attribution: { hidden: false, hideable: true },
    });

    expect(screen.queryByText('Powered by')).toBeInTheDocument();
  });

  it('hides the pill when the claim says it is hidden', async () => {
    const screen = await renderVault({
      attribution: { hidden: true, hideable: true },
    });

    expect(screen.queryByText('Powered by')).not.toBeInTheDocument();
  });

  // The prop and the claim are independent vetoes for now. Enforcing
  // entitlement against the prop is a separate follow-up, so an unentitled
  // caller passing showAttribution={false} must still hide the pill.
  it('still honours showAttribution={false} when the claim allows the pill', async () => {
    const screen = await renderVault(
      { attribution: { hidden: false, hideable: false } },
      { showAttribution: false }
    );

    expect(screen.queryByText('Powered by')).not.toBeInTheDocument();
  });
});
