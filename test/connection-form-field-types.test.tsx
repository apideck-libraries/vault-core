import '@testing-library/jest-dom/extend-expect';
import 'jest-location-mock';
import 'whatwg-fetch';

import * as React from 'react';

import { render } from '@testing-library/react';
import { fetchMock, setupIntersectionObserverMock } from './mock';

import { act } from 'react-dom/test-utils';
import ConnectionForm from '../src/components/ConnectionForm';
import { Connection } from '../src/types/Connection';
import { INVALID_SESSION_RESPONSE } from './responses/invalid-session';

jest.mock('../src/utils/useConnections', () => ({
  useConnections: () => ({ updateConnection: jest.fn() }),
}));

const baseConnection: Connection = {
  id: 'crm+test',
  name: 'Test',
  service_id: 'test',
  unified_api: 'crm',
  auth_type: 'apiKey',
  state: 'added',
  enabled: true,
  tag_line: '',
  icon: '',
  logo: '',
  website: '',
  custom_mappings: [],
  configuration: [],
  form_fields: [],
} as unknown as Connection;

const renderForm = async (formFields: any[]) => {
  let screen: any;
  await act(async () => {
    screen = render(
      <ConnectionForm
        connection={{ ...baseConnection, form_fields: formFields } as Connection}
        setCurrentView={() => {}}
        settings={{}}
      />
    );
  });
  return screen;
};

describe('ConnectionForm - type: "copy" field', () => {
  beforeEach(() => jest.spyOn(window, 'fetch'));
  beforeEach(() => fetchMock(INVALID_SESSION_RESPONSE));
  beforeEach(() => setupIntersectionObserverMock());

  const copyField = {
    id: 'qbd_password',
    label: 'QBD Password',
    value: 'aB3kMnPq7RsTvW2x',
    placeholder: '',
    mask: false,
    type: 'copy',
    required: false,
    description: 'Generated password for the QBD connection',
    disabled: true,
    options: [],
    custom_field: false,
    hidden: false,
  };

  it('renders a disabled TextInput with the field value', async () => {
    const screen = await renderForm([copyField]);
    const input = screen.getByTestId('qbd_password') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input).toBeDisabled();
    expect(input.value).toBe('aB3kMnPq7RsTvW2x');
  });

  it('renders a copy button next to the input', async () => {
    const screen = await renderForm([copyField]);
    // canBeCopied renders a button with title "Copy" inside @apideck/components TextInput
    const copyButton = screen.getByTestId('qbd_password-copy-button');
    expect(copyButton).toBeInTheDocument();
  });

  it('renders the field label', async () => {
    const screen = await renderForm([copyField]);
    expect(screen.getByText('QBD Password')).toBeInTheDocument();
  });

  it('renders the markdown description', async () => {
    const screen = await renderForm([copyField]);
    expect(
      screen.getByText('Generated password for the QBD connection')
    ).toBeInTheDocument();
  });
});

describe('ConnectionForm - type: "info" field', () => {
  beforeEach(() => jest.spyOn(window, 'fetch'));
  beforeEach(() => fetchMock(INVALID_SESSION_RESPONSE));
  beforeEach(() => setupIntersectionObserverMock());

  const baseInfoField = {
    id: 'setup_instructions',
    label: 'Setup Instructions',
    value: '',
    placeholder: '',
    mask: false,
    type: 'info',
    required: false,
    disabled: false,
    options: [],
    custom_field: false,
    hidden: false,
  };

  it('renders the markdown description content', async () => {
    const screen = await renderForm([
      { ...baseInfoField, description: '**Bold text** here' },
    ]);
    const bold = screen.getByText('Bold text');
    expect(bold).toBeInTheDocument();
    expect(bold.tagName.toLowerCase()).toBe('strong');
  });

  it('does not render any input or textarea', async () => {
    const screen = await renderForm([
      { ...baseInfoField, description: 'Hello' },
    ]);
    expect(screen.queryByTestId('setup_instructions')).not.toBeInTheDocument();
    const inputs = screen.container.querySelectorAll('input, textarea');
    expect(inputs.length).toBe(0);
  });

  it('renders the label when present', async () => {
    const screen = await renderForm([
      { ...baseInfoField, description: 'Hi' },
    ]);
    expect(screen.getByText('Setup Instructions')).toBeInTheDocument();
  });

  it('renders without a label', async () => {
    const screen = await renderForm([
      { ...baseInfoField, label: '', description: 'No label here' },
    ]);
    expect(screen.getByText('No label here')).toBeInTheDocument();
  });

  it('renders complex Markdown (lists, links, bold)', async () => {
    const description =
      '1. **Step one**\n2. Visit [Apideck](https://apideck.com)\n';
    const screen = await renderForm([
      { ...baseInfoField, description },
    ]);
    expect(screen.getByText('Step one')).toBeInTheDocument();
    const link = screen.getByText('Apideck') as HTMLAnchorElement;
    expect(link.tagName.toLowerCase()).toBe('a');
    expect(link.getAttribute('href')).toBe('https://apideck.com');
  });
});

describe('ConnectionForm - {{field_id}} description interpolation', () => {
  beforeEach(() => jest.spyOn(window, 'fetch'));
  beforeEach(() => fetchMock(INVALID_SESSION_RESPONSE));
  beforeEach(() => setupIntersectionObserverMock());

  it('resolves a single token to the referenced field value', async () => {
    const screen = await renderForm([
      {
        id: 'url',
        label: 'URL',
        value: 'https://example.com',
        type: 'text',
        placeholder: '',
        mask: false,
        required: false,
        disabled: false,
        options: [],
        custom_field: false,
        hidden: true,
      },
      {
        id: 'info',
        label: 'Info',
        value: '',
        type: 'info',
        placeholder: '',
        mask: false,
        required: false,
        disabled: false,
        options: [],
        custom_field: false,
        hidden: false,
        description: 'Visit {{url}}',
      },
    ]);
    expect(screen.getByText(/Visit https:\/\/example\.com/)).toBeInTheDocument();
  });

  it('resolves multiple tokens', async () => {
    const screen = await renderForm([
      {
        id: 'first',
        label: 'First',
        value: 'A',
        type: 'text',
        placeholder: '',
        mask: false,
        required: false,
        disabled: false,
        options: [],
        custom_field: false,
        hidden: true,
      },
      {
        id: 'second',
        label: 'Second',
        value: 'B',
        type: 'text',
        placeholder: '',
        mask: false,
        required: false,
        disabled: false,
        options: [],
        custom_field: false,
        hidden: true,
      },
      {
        id: 'info',
        label: '',
        value: '',
        type: 'info',
        placeholder: '',
        mask: false,
        required: false,
        disabled: false,
        options: [],
        custom_field: false,
        hidden: false,
        description: '{{first}} and {{second}}',
      },
    ]);
    expect(screen.getByText('A and B')).toBeInTheDocument();
  });

  it('replaces unresolved tokens with an empty string', async () => {
    const screen = await renderForm([
      {
        id: 'info',
        label: '',
        value: '',
        type: 'info',
        placeholder: '',
        mask: false,
        required: false,
        disabled: false,
        options: [],
        custom_field: false,
        hidden: false,
        description: 'before{{nonexistent}}after',
      },
    ]);
    expect(screen.getByText('beforeafter')).toBeInTheDocument();
  });

  it('passes through descriptions without tokens unchanged', async () => {
    const screen = await renderForm([
      {
        id: 'info',
        label: '',
        value: '',
        type: 'info',
        placeholder: '',
        mask: false,
        required: false,
        disabled: false,
        options: [],
        custom_field: false,
        hidden: false,
        description: 'Plain description with no tokens',
      },
    ]);
    expect(
      screen.getByText('Plain description with no tokens')
    ).toBeInTheDocument();
  });

  it('resolves tokens inside Markdown links', async () => {
    const screen = await renderForm([
      {
        id: 'download_url',
        label: 'Download URL',
        value: 'https://files.example.com/foo.qwc',
        type: 'text',
        placeholder: '',
        mask: false,
        required: false,
        disabled: false,
        options: [],
        custom_field: false,
        hidden: true,
      },
      {
        id: 'info',
        label: '',
        value: '',
        type: 'info',
        placeholder: '',
        mask: false,
        required: false,
        disabled: false,
        options: [],
        custom_field: false,
        hidden: false,
        description: '[Download]({{download_url}})',
      },
    ]);
    const link = screen.getByText('Download') as HTMLAnchorElement;
    expect(link.tagName.toLowerCase()).toBe('a');
    expect(link.getAttribute('href')).toBe(
      'https://files.example.com/foo.qwc'
    );
  });
});
