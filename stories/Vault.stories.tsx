import '../src/styles/index.css';

import { Meta, Story } from '@storybook/react';
import { Props, Vault } from '../src/components/Vault';

import React from 'react';

const meta: Meta = {
  title: 'Vault',
  component: Vault,
  argTypes: {
    children: {
      control: {
        type: 'text',
      },
    },
  },
  parameters: {
    controls: { expanded: true },
  },
};

export default meta;

// First create a vault session to get a JSON Web Token

const Template: Story<Props> = (args) => (
  <Vault
    trigger={<button className="p-2 border rounded shadow">Open modal</button>}
    {...args}
    showConsumer={true}
    unifyBaseUrl="http://localhost:3050"
    token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZWRpcmVjdF91cmkiOiJodHRwczovL3ZhdWx0LmFwaWRlY2suY29tL29hdXRoL2NhbGxiYWNrIiwiY29uc3VtZXJfbWV0YWRhdGEiOnsiYWNjb3VudF9uYW1lIjoiQXBpZGVjayBTdGFnaW5nIC0gVW5pZnkiLCJ1c2VyX25hbWUiOiJKYWtlIiwiaW1hZ2UiOiJodHRwczovL3VuYXZhdGFyLmlvL2pha2VAYXBpZGVjay5jb20ifSwidGhlbWUiOnsiZmF2aWNvbiI6Imh0dHBzOi8vcmVzLmNsb3VkaW5hcnkuY29tL2FwaWRlY2svaW1hZ2UvdXBsb2FkL3YxNTk0NjQwMTA2L21hcmtldHBsYWNlcy91ZmM3MDgyYXN6emdodHZuZ3FhZS5wbmciLCJwcmltYXJ5X2NvbG9yIjoiIzVDNTFDRSIsInByaXZhY3lfdXJsIjoiaHR0cHM6Ly9jb21wbGlhbmNlLmFwaWRlY2suY29tL3ByaXZhY3ktcG9saWN5Iiwic2lkZXBhbmVsX2JhY2tncm91bmRfY29sb3IiOiIjMEUxMjQ0Iiwic2lkZXBhbmVsX3RleHRfY29sb3IiOiIjRkZGRkZGIiwidGVybXNfdXJsIjoiaHR0cHM6Ly93d3cudGVybXNmZWVkLmNvbS90ZXJtcy1jb25kaXRpb25zLzk1N2M4NWMxYjA4OWFlOWUzMjE5YzgzZWZmNjUzNzdlIiwidmF1bHRfbmFtZSI6IkFwaWRlY2sgVW5pZnkgU3RhZ2luZyJ9LCJzZXR0aW5ncyI6eyJzZXNzaW9uX2xlbmd0aCI6IjI0aCJ9LCJjb25zdW1lcl9pZCI6InRlc3QtY29uc3VtZXIiLCJhcHBsaWNhdGlvbl9pZCI6IjIyMjIiLCJzY29wZXMiOltdLCJpYXQiOjE2OTUzNjYxMjUsImV4cCI6MTY5NTQ1MjUyNX0.5r5MtssvVSI087u2mbD5JWM15RFCdOVodqiHLQHcZ-s"
  />
);

// By passing using the Args format for exported stories, you can control the props for a component for reuse in a test
// https://storybook.js.org/docs/react/workflows/unit-testing
export const Trigger = Template.bind({});
Trigger.args = {};

export const Programaticly = Template.bind({});
Programaticly.args = {
  open: true,
  onClose: () => console.log('closed'),
};

export const SingleConnection = Template.bind({});
SingleConnection.args = {
  trigger: (
    <button className="p-2 border rounded shadow">Open Pipedrive</button>
  ),
  unifiedApi: 'crm',
  serviceId: 'pipedrive',
};

export const SingleUnifiedApi = Template.bind({});
SingleUnifiedApi.args = {
  trigger: (
    <button className="p-2 border rounded shadow">
      Open File Storage connectors
    </button>
  ),
  unifiedApi: 'file-storage',
};
