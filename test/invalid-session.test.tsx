import '@testing-library/jest-dom/extend-expect';
import 'jest-location-mock';
import 'whatwg-fetch';

import * as React from 'react';

import { fetchMock, setupIntersectionObserverMock } from './mock';

import { INVALID_SESSION_RESPONSE } from './responses/invalid-session';
import { Vault } from '../src/components/Vault';
import { act } from 'react-dom/test-utils';
import { render } from '@testing-library/react';

describe('Vault - Invalid session', () => {
  beforeEach(() => jest.spyOn(window, 'fetch'));
  beforeEach(() => fetchMock(INVALID_SESSION_RESPONSE));
  beforeEach(() => setupIntersectionObserverMock());

  it('should show the Manage your integrations message', async () => {
    let screen: any;
    await act(async () => {
      screen = render(<Vault appId="x" consumerId="x" jwt="x" open />);
    });

    expect(screen.getByTestId('error-message')).toBeInTheDocument();
  });
});
