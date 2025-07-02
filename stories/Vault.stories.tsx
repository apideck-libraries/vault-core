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
    token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0aGVtZSI6eyJsb2dvIjoiaHR0cHM6Ly93d3cuYXBpZGVjay5jb20vZmF2aWNvbi5pY28ifSwiY29uc3VtZXJfaWQiOiJkZW1vLXJlYWN0LXZhdWx0LWc1M2YwYS0yMDI1LTA3LTAxVDE0OjE0OjI3LjkxOVoiLCJhcHBsaWNhdGlvbl9pZCI6IkFpQ2t6eGNwWld1eFVSTVVrYTlmOVdPVVJoa09iMEh4cEtVa2EiLCJzY29wZXMiOltdLCJpYXQiOjE3NTE0NDQ5MjIsImV4cCI6MTc1MTQ0ODUyMn0.FSW2oZ1WKy2JjcrAMEnhkXp15nLDd73pJYnGYTpCmns"
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
  showButtonLayout: true,
};

export const ButtonLayout = Template.bind({});
ButtonLayout.args = {
  showButtonLayout: true,
  showLanguageSwitch: true,
  // unifiedApi: 'issue-tracking',
  // serviceId: 'xero',
};
