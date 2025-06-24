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
    token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZWRpcmVjdF91cmkiOiJodHRwczovL3ZhdWx0LmFwaWRlY2suY29tL29hdXRoL2NhbGxiYWNrIiwiY29uc3VtZXJfbWV0YWRhdGEiOnt9LCJ0aGVtZSI6eyJmYXZpY29uIjoiaHR0cHM6Ly9yZXMuY2xvdWRpbmFyeS5jb20vYXBpZGVjay9pbWFnZS91cGxvYWQvdjE1OTQ2NDAxMDYvbWFya2V0cGxhY2VzL3VmYzcwODJhc3p6Z2h0dm5ncWFlLnBuZyIsInByaW1hcnlfY29sb3IiOiIjNUM1MUNFIiwicHJpdmFjeV91cmwiOiJodHRwczovL2NvbXBsaWFuY2UuYXBpZGVjay5jb20vcHJpdmFjeS1wb2xpY3kiLCJzaWRlcGFuZWxfYmFja2dyb3VuZF9jb2xvciI6IiMwRTEyNDQiLCJzaWRlcGFuZWxfdGV4dF9jb2xvciI6IiNGRkZGRkYiLCJ0ZXJtc191cmwiOiJodHRwczovL3d3dy50ZXJtc2ZlZWQuY29tL3Rlcm1zLWNvbmRpdGlvbnMvOTU3Yzg1YzFiMDg5YWU5ZTMyMTljODNlZmY2NTM3N2UiLCJ2YXVsdF9uYW1lIjoiQXBpZGVjayBVbmlmeSBTdGFnaW5nIn0sInNldHRpbmdzIjp7InNlc3Npb25fbGVuZ3RoIjoiMjRoIn0sImNvbnN1bWVyX2lkIjoidGVzdC1jb25zdW1lciIsImFwcGxpY2F0aW9uX2lkIjoiMjIyMiIsInNjb3BlcyI6W10sImlhdCI6MTc1MDY2ODU2MSwiZXhwIjoxNzUwNzU0OTYxfQ.O89C8xZAFV26v7LFMg3LEEuko48CI0tq1-sPXQ2rEkw"
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
};
