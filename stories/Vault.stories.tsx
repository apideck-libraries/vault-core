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
    // unifyBaseUrl="https://localhost:3050"
    token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZWRpcmVjdF91cmkiOiJodHRwczovL3ZhdWx0LmFwaWRlY2suY29tL29hdXRoL2NhbGxiYWNrIiwiY29uc3VtZXJfbWV0YWRhdGEiOnsiYWNjb3VudF9uYW1lIjoiQXBpZGVjayBTYW5kYm94ICIsInVzZXJfbmFtZSI6Ikpha2UiLCJpbWFnZSI6Imh0dHBzOi8vdW5hdmF0YXIuaW8vamFrZUBhcGlkZWNrLmNvbSJ9LCJ0aGVtZSI6eyJmYXZpY29uIjoiaHR0cHM6Ly9yZXMuY2xvdWRpbmFyeS5jb20vYXBpZGVjay9pbWFnZS91cGxvYWQvdjE2OTIwOTA4MDYvbWFya2V0cGxhY2VzL2Zhdmljb25fZHA0YTNsLnBuZyIsInByaW1hcnlfY29sb3IiOiIjMDMwNDVlIiwicHJpdmFjeV91cmwiOiJodHRwczovL2NvbXBsaWFuY2UuYXBpZGVjay5jb20vcHJpdmFjeS1wb2xpY3kiLCJzaWRlcGFuZWxfYmFja2dyb3VuZF9jb2xvciI6IiMxNjI2M2YiLCJzaWRlcGFuZWxfdGV4dF9jb2xvciI6IiNGRkZGRkYiLCJ0ZXJtc191cmwiOiJodHRwczovL3d3dy50ZXJtc2ZlZWQuY29tL3Rlcm1zLWNvbmRpdGlvbnMvOTU3Yzg1YzFiMDg5YWU5ZTMyMTljODNlZmY2NTM3N2UiLCJ2YXVsdF9uYW1lIjoiQXBpZGVjayBTYW1wbGVzIn0sInNldHRpbmdzIjp7InNlc3Npb25fbGVuZ3RoIjoiMjRoIn0sImNvbnN1bWVyX2lkIjoidGVzdC1jb25zdW1lciIsImFwcGxpY2F0aW9uX2lkIjoiY2ZhWnJPUmdhSDJQTVFwSWNqVHBmaEVSSXBJRVVKSGV2MDl1Y2pUcCIsInNjb3BlcyI6W10sImlhdCI6MTcwNjE3Njc0NywiZXhwIjoxNzA2MjYzMTQ3fQ.1uAkPkYkCkFRy0E2c2Sqc9kzgsUA2hlGcekyqdFerV4"
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
    <button className="p-2 border rounded shadow">Open Singe Connection</button>
  ),
  unifiedApi: 'crm',
  serviceId: 'act',
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
      Open configuruable resources
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
