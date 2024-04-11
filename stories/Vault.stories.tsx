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
    token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZWRpcmVjdF91cmkiOiJodHRwczovL215c2Fhcy5jb20vZGFzaGJvYXJkIiwiY29uc3VtZXJfbWV0YWRhdGEiOnsiYWNjb3VudF9uYW1lIjoiU3BhY2VYIiwidXNlcl9uYW1lIjoiRWxvbiBNdXNrIiwiZW1haWwiOiJlbG9uQG11c2suY29tIiwiaW1hZ2UiOiJodHRwczovL3d3dy5zcGFjZXguY29tL3N0YXRpYy9pbWFnZXMvc2hhcmUuanBnIn0sImN1c3RvbV9jb25zdW1lcl9zZXR0aW5ncyI6eyJmZWF0dXJlX2ZsYWdfMSI6dHJ1ZSwidGF4X3JhdGVzIjpbeyJpZCI6IjYiLCJsYWJlbCI6IjYlIn0seyJpZCI6IjIxIiwibGFiZWwiOiIyMSUifV19LCJ0aGVtZSI6eyJmYXZpY29uIjoiaHR0cHM6Ly9yZXMuY2xvdWRpbmFyeS5jb20vcG9zdG1hbi9pbWFnZS91cGxvYWQvdF90ZWFtX2xvZ28vdjE2Mjk4ODY5NTgvdGVhbS9lM2JkN2RhZTRiODQ0MTliOWVjMGQzNGQ4NTVlMTE4MTZlOTRhY2QxYWY4OTRiMjNkYTQ0ZTkyNzA4ZTAzYTgxIiwicHJpbWFyeV9jb2xvciI6IiMyODZlZmEiLCJwcml2YWN5X3VybCI6Imh0dHBzOi8vY29tcGxpYW5jZS5hcGlkZWNrLmNvbS9wcml2YWN5LXBvbGljeSIsInNpZGVwYW5lbF9iYWNrZ3JvdW5kX2NvbG9yIjoiIzI4NmVmYSIsInNpZGVwYW5lbF90ZXh0X2NvbG9yIjoiI0ZGRkZGRiIsInRlcm1zX3VybCI6Imh0dHBzOi8vd3d3LnRlcm1zZmVlZC5jb20vdGVybXMtY29uZGl0aW9ucy85NTdjODVjMWIwODlhZTllMzIxOWM4M2VmZjY1Mzc3ZSIsInZhdWx0X25hbWUiOiJBcGlkZWNrIFZhdWx0In0sInNldHRpbmdzIjp7InVuaWZpZWRfYXBpcyI6WyJjcm0iLCJocmlzIiwicG9zIiwiZmlsZS1zdG9yYWdlIl0sImhpZGVfcmVzb3VyY2Vfc2V0dGluZ3MiOmZhbHNlLCJzYW5kYm94X21vZGUiOmZhbHNlLCJpc29sYXRpb25fbW9kZSI6ZmFsc2UsInNlc3Npb25fbGVuZ3RoIjoiMzBtIiwic2hvd19sb2dzIjp0cnVlLCJzaG93X3N1Z2dlc3Rpb25zIjpmYWxzZSwic2hvd19zaWRlYmFyIjp0cnVlLCJhdXRvX3JlZGlyZWN0IjpmYWxzZX0sImNvbnN1bWVyX2lkIjoidGVzdC1jb25zdW1lciIsImFwcGxpY2F0aW9uX2lkIjoiMjIyMiIsInNjb3BlcyI6W10sImlhdCI6MTcxMjg0MTkzNSwiZXhwIjoxNzEyODQzNzM1fQ.IO6kcAqYTCiCKWhNw6TCPkIF45YvQgw1wRY4rgMRr6A"
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
