import { isMessageFromPopup } from '../src/utils/oauthMessage';

const CALLBACK_ORIGIN = 'https://vault.apideck.com';

// Plain objects stand in for windows: the predicate only compares identities.
const popup = { name: 'popup' } as unknown as Window;
const otherWindow = { name: 'other' } as unknown as Window;

const message = (origin: string, source: unknown = null) =>
  new MessageEvent('message', {
    data: { type: 'oauth_complete', serviceId: 'shopify' },
    origin,
    source: source as MessageEventSource | null,
  });

describe('isMessageFromPopup', () => {
  it('accepts a message from the popup with the accepted origin', () => {
    expect(
      isMessageFromPopup(
        message(CALLBACK_ORIGIN, popup),
        popup,
        CALLBACK_ORIGIN
      )
    ).toBe(true);
  });

  it('rejects a message from the accepted origin sent by another window', () => {
    expect(
      isMessageFromPopup(
        message(CALLBACK_ORIGIN, otherWindow),
        popup,
        CALLBACK_ORIGIN
      )
    ).toBe(false);
  });

  it('rejects a message from the popup with another origin', () => {
    expect(
      isMessageFromPopup(
        message('https://evil.example', popup),
        popup,
        CALLBACK_ORIGIN
      )
    ).toBe(false);
  });

  it('rejects every message when no origin is accepted', () => {
    expect(
      isMessageFromPopup(message(CALLBACK_ORIGIN, popup), popup, null)
    ).toBe(false);
  });

  it("rejects every message when the accepted origin is the opaque 'null'", () => {
    expect(isMessageFromPopup(message('null', popup), popup, 'null')).toBe(
      false
    );
  });

  it('rejects a message without source when the popup is null', () => {
    expect(
      isMessageFromPopup(message(CALLBACK_ORIGIN), null, CALLBACK_ORIGIN)
    ).toBe(false);
  });
});
