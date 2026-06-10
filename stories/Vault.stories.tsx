import '../src/styles/index.css';

import { Meta, Story } from '@storybook/react';
import { Props, Vault } from '../src/components/Vault';

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
    token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZWRpcmVjdF91cmkiOiJodHRwczovL3ZhdWx0LmFwaWRlY2suY29tL29hdXRoL2NhbGxiYWNrIiwiY29uc3VtZXJfbWV0YWRhdGEiOnt9LCJ0aGVtZSI6eyJmYXZpY29uIjoiaHR0cHM6Ly9yZXMuY2xvdWRpbmFyeS5jb20vYXBpZGVjay9pbWFnZS91cGxvYWQvdjE2OTIwOTA4MDYvbWFya2V0cGxhY2VzL2Zhdmljb25fZHA0YTNsLnBuZyIsInByaW1hcnlfY29sb3IiOiIjMDMwNDVlIiwicHJpdmFjeV91cmwiOiJodHRwczovL2NvbXBsaWFuY2UuYXBpZGVjay5jb20vcHJpdmFjeS1wb2xpY3kiLCJzaWRlcGFuZWxfYmFja2dyb3VuZF9jb2xvciI6IiMxNjI2M2YiLCJzaWRlcGFuZWxfdGV4dF9jb2xvciI6IiNGRkZGRkYiLCJ0ZXJtc191cmwiOiJodHRwczovL3d3dy50ZXJtc2ZlZWQuY29tL3Rlcm1zLWNvbmRpdGlvbnMvOTU3Yzg1YzFiMDg5YWU5ZTMyMTljODNlZmY2NTM3N2UiLCJ2YXVsdF9uYW1lIjoiQXBpZGVjayBTYW1wbGVzIn0sInNldHRpbmdzIjp7InNlc3Npb25fbGVuZ3RoIjoiMjRoIn0sImNvbnN1bWVyX2lkIjoidGVzdC1jb25zdW1lciIsImFwcGxpY2F0aW9uX2lkIjoiY2ZhWnJPUmdhSDJQTVFwSWNqVHBmaEVSSXBJRVVKSGV2MDl1Y2pUcCIsInNjb3BlcyI6W10sImRhdGFfc2NvcGVzIjp7ImVuYWJsZWQiOmZhbHNlfSwiaWF0IjoxNzgxMDc4ODUwLCJleHAiOjE3ODExNjUyNTB9.KJ_WG2N-q-uEDj0nlH2prp2cNxdTsuGXUitDkpfQgAc"
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

export const ConsetHistory = Template.bind({});
ConsetHistory.args = {
  showButtonLayout: true,
  showLanguageSwitch: true,
  unifiedApi: 'accounting',
  serviceId: 'quickbooks',
  initialView: 'consent-history',
};
