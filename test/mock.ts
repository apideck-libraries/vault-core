import { ADDED_CONNECTIONS_RESPONSE } from './responses/with-added-connections';
import { ADD_CONNECTION_RESPONSE } from './responses/add-connection';
import { CONFIG } from './responses/config';

const fetchMock = (response?: any) => {
  (window.fetch as any).mockImplementation((url: string) => {
    if (
      url === 'https://unify.apideck.com/vault/connections/crm/activecampaign'
    ) {
      return { json: async () => ADD_CONNECTION_RESPONSE };
    }

    if (url.includes('/config')) {
      return { json: async () => CONFIG };
    }

    return {
      ok: true,
      status: 200,
      json: async () => response || ADDED_CONNECTIONS_RESPONSE,
    };
  });
};

const fetchMockRejected = (response) => {
  window.fetch = jest.fn().mockImplementation(() => Promise.reject(response));
};

// Utility function that mocks the `IntersectionObserver` API. Necessary for components that rely
// on it, otherwise the tests will crash. Recommended to execute inside `beforeEach`.
const setupIntersectionObserverMock = ({
  root = null,
  rootMargin = '',
  thresholds = [],
  disconnect = () => null,
  observe = () => null,
  takeRecords = () => [],
  unobserve = () => null,
} = {}): void => {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | null = root;
    readonly rootMargin: string = rootMargin;
    readonly thresholds: ReadonlyArray<number> = thresholds;
    disconnect: () => void = disconnect;
    observe: (target: Element) => void = observe;
    takeRecords: () => IntersectionObserverEntry[] = takeRecords;
    unobserve: (target: Element) => void = unobserve;
  }

  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
  });

  Object.defineProperty(global, 'IntersectionObserver', {
    writable: true,
    configurable: true,
    value: MockIntersectionObserver,
  });
};

export { fetchMock, fetchMockRejected, setupIntersectionObserverMock };
