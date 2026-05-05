import '@testing-library/jest-dom/extend-expect';

import * as React from 'react';
import { cleanup, render } from '@testing-library/react';

import StatusBadge from '../src/components/StatusBadge';
import { Connection } from '../src/types/Connection';
import '../src/utils/i18n';

const baseConnection = (overrides: Partial<Connection>): Connection =>
  ({
    id: 'ecommerce+shopify',
    service_id: 'shopify',
    unified_api: 'ecommerce',
    name: 'Shopify',
    icon: 'https://example.com/icon.png',
    enabled: true,
    state: 'callable',
    ...overrides,
  } as Connection);

describe('StatusBadge', () => {
  afterEach(cleanup);

  describe('pending_confirmation health', () => {
    it('renders "Pending confirmation" when health is pending_confirmation', () => {
      const { getByTestId } = render(
        <StatusBadge
          connection={baseConnection({
            state: 'authorized',
            health: 'pending_confirmation',
          })}
        />
      );

      const badge = getByTestId('status-badge');
      expect(badge).toHaveTextContent('Pending confirmation');
    });

    it('uses the yellow palette (bg-yellow-100 text-yellow-800)', () => {
      const { getByTestId } = render(
        <StatusBadge
          connection={baseConnection({
            state: 'authorized',
            health: 'pending_confirmation',
          })}
        />
      );

      const badge = getByTestId('status-badge');
      expect(badge.className).toContain('bg-yellow-100');
      expect(badge.className).toContain('text-yellow-800');
    });

    it('takes precedence over the state switch', () => {
      const { getByTestId } = render(
        <StatusBadge
          connection={baseConnection({
            state: 'authorized',
            health: 'pending_confirmation',
          })}
        />
      );

      const badge = getByTestId('status-badge');
      expect(badge).toHaveTextContent('Pending confirmation');
      expect(badge).not.toHaveTextContent('Input required');
      expect(badge).not.toHaveTextContent('Needs configuration');
    });
  });

  describe('existing behaviour (no health field)', () => {
    it('renders "Connected" for state=callable', () => {
      const { getByTestId } = render(
        <StatusBadge connection={baseConnection({ state: 'callable' })} />
      );

      expect(getByTestId('status-badge')).toHaveTextContent('Connected');
    });

    it('renders "Input required" for state=authorized small size', () => {
      const { getByTestId } = render(
        <StatusBadge
          connection={baseConnection({ state: 'authorized' })}
          size="small"
        />
      );

      expect(getByTestId('status-badge')).toHaveTextContent('Input required');
    });
  });
});
