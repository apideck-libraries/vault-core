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
  describe('showAttribution enforcement', () => {
    // The behaviour change. Previously the prop was an independent veto, so any
    // plan could suppress the badge from client code.
    it('ignores showAttribution={false} when the account is not entitled', async () => {
      const screen = await renderVault(
        { attribution: { hidden: false, hideable: false } },
        { showAttribution: false }
      );

      expect(screen.queryByText('Powered by')).toBeInTheDocument();
    });

    it('honours showAttribution={false} when the account is entitled', async () => {
      const screen = await renderVault(
        { attribution: { hidden: false, hideable: true } },
        { showAttribution: false }
      );

      expect(screen.queryByText('Powered by')).not.toBeInTheDocument();
    });

    // Enforcement keys on hideable === false, a positive "not entitled" signal.
    // unify omits the claim entirely for sessions minted without an account
    // (management sessions), and older deployments never send it — those must keep
    // honouring the prop rather than silently having it stop working.
    it('honours showAttribution={false} when there is no attribution claim', async () => {
      const screen = await renderVault({}, { showAttribution: false });

      expect(screen.queryByText('Powered by')).not.toBeInTheDocument();
    });

    it('honours showAttribution={false} when the claim omits hideable', async () => {
      const screen = await renderVault(
        { attribution: { hidden: false } },
        { showAttribution: false }
      );

      expect(screen.queryByText('Powered by')).not.toBeInTheDocument();
    });

    // hidden always wins, regardless of the prop.
    it('keeps the pill hidden when the claim says hidden even with showAttribution={true}', async () => {
      const screen = await renderVault(
        { attribution: { hidden: true, hideable: true } },
        { showAttribution: true }
      );

      expect(screen.queryByText('Powered by')).not.toBeInTheDocument();
    });
  });
});
