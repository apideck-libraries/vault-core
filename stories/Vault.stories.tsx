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
    // unifyBaseUrl="http://localhost:3050"
    token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZWRpcmVjdF91cmkiOiI8c3RyaW5nPiIsImNvbnN1bWVyX21ldGFkYXRhIjp7ImFjY291bnRfbmFtZSI6IjxzdHJpbmc-IiwidXNlcl9uYW1lIjoiPHN0cmluZz4iLCJlbWFpbCI6IjxzdHJpbmc-IiwiaW1hZ2UiOiI8c3RyaW5nPiJ9LCJjdXN0b21fY29uc3VtZXJfc2V0dGluZ3MiOnsiZWl1c21vZF8xMSI6NDkwMjI5NiwidmVuaWFtX2MiOmZhbHNlfSwidGhlbWUiOnsiZmF2aWNvbiI6IjxzdHJpbmc-IiwibG9nbyI6IjxzdHJpbmc-IiwicHJpbWFyeV9jb2xvciI6IjxzdHJpbmc-Iiwic2lkZXBhbmVsX2JhY2tncm91bmRfY29sb3IiOiI8c3RyaW5nPiIsInNpZGVwYW5lbF90ZXh0X2NvbG9yIjoiPHN0cmluZz4iLCJ2YXVsdF9uYW1lIjoiPHN0cmluZz4iLCJwcml2YWN5X3VybCI6IjxzdHJpbmc-IiwidGVybXNfdXJsIjoiPHN0cmluZz4ifSwic2V0dGluZ3MiOnsidW5pZmllZF9hcGlzIjpbImVtYWlsIiwiY3VzdG9tZXItc3VwcG9ydCJdLCJoaWRlX3Jlc291cmNlX3NldHRpbmdzIjpmYWxzZSwic2FuZGJveF9tb2RlIjpmYWxzZSwiaXNvbGF0aW9uX21vZGUiOmZhbHNlLCJzZXNzaW9uX2xlbmd0aCI6IjFoIiwic2hvd19sb2dzIjp0cnVlLCJzaG93X3N1Z2dlc3Rpb25zIjpmYWxzZSwic2hvd19zaWRlYmFyIjp0cnVlLCJhdXRvX3JlZGlyZWN0IjpmYWxzZSwiaGlkZV9ndWlkZXMiOmZhbHNlLCJhbGxvd19hY3Rpb25zIjpbImRpc2FibGUiLCJkaXNhYmxlIl19LCJjb25zdW1lcl9pZCI6InRlc3QtY29uc3VtZXItbmV3IiwiYXBwbGljYXRpb25faWQiOiJQSk5NWEdiUG81M2kwN2tmSVZkMzBpbXVCVVEzSlJDbGNRZm5JVmQ0Iiwic2NvcGVzIjpbXSwiZGF0YV9zY29wZXMiOnsiZW5hYmxlZCI6ZmFsc2V9LCJpYXQiOjE3NTY5OTEzMTgsImV4cCI6MTc1Njk5NDkxOH0.mI4tFmyOgWuvQyiDJfEC-sSxvzFSWZTxYK6kx6KdZO0"
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
    <button className="p-2 border rounded shadow">
      Open Single Connection
    </button>
  ),
  unifiedApi: 'accounting',
  serviceId: 'xero',
};

export const SettingsView = Template.bind({});
SettingsView.args = {
  trigger: (
    <button className="p-2 border rounded shadow">Open settings view</button>
  ),
  unifiedApi: 'crm',
  serviceId: 'copper',
  initialView: 'settings',
};

export const ConfigurableResourcesView = Template.bind({});
ConfigurableResourcesView.args = {
  trigger: (
    <button className="p-2 border rounded shadow">
      Open configurable resources
    </button>
  ),
  unifiedApi: 'crm',
  serviceId: 'hubspot',
  initialView: 'configurable-resources',
};

export const CusotmMappingView = Template.bind({});
CusotmMappingView.args = {
  trigger: (
    <button className="p-2 border rounded shadow">Open custom mapping</button>
  ),
  unifiedApi: 'accounting',
  serviceId: 'quickbooks',
  initialView: 'custom-mapping',
};

export const AutoStartAuthorization = Template.bind({});
AutoStartAuthorization.args = {
  trigger: (
    <button className="p-2 border rounded shadow">
      Open auto start authorization
    </button>
  ),
  unifiedApi: 'accounting',
  serviceId: 'quickbooks',
  autoStartAuthorization: true,
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

export const WithConsumer = Template.bind({});
WithConsumer.args = {
  showConsumer: true,
};

export const InDutch = Template.bind({});
InDutch.args = {
  locale: 'nl',
};

export const InFrench = Template.bind({});
InFrench.args = {
  locale: 'fr',
};

export const InGerman = Template.bind({});
InGerman.args = {
  locale: 'de',
};

export const InSpanish = Template.bind({});
InSpanish.args = {
  locale: 'es',
};

export const ShowLanguageSwitch = Template.bind({});
ShowLanguageSwitch.args = {
  showLanguageSwitch: true,
  showButtonLayout: true,
};

export const ButtonLayout = Template.bind({});
ButtonLayout.args = {
  showButtonLayout: true,
  showLanguageSwitch: true,
  // unifiedApi: 'issue-tracking',
  // serviceId: 'xero',
};
