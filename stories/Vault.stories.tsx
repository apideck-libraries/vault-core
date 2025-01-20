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
    token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZWRpcmVjdF91cmkiOiJodHRwczovL215c2Fhcy5jb20vZGFzaGJvYXJkIiwiY29uc3VtZXJfbWV0YWRhdGEiOnsiYWNjb3VudF9uYW1lIjoiU3BhY2VYIiwidXNlcl9uYW1lIjoiRWxvbiBNdXNrIiwiZW1haWwiOiJlbG9uQG11c2suY29tIiwiaW1hZ2UiOiJodHRwczovL3d3dy5zcGFjZXguY29tL3N0YXRpYy9pbWFnZXMvc2hhcmUuanBnIn0sImN1c3RvbV9jb25zdW1lcl9zZXR0aW5ncyI6eyJmZWF0dXJlX2ZsYWdfMSI6dHJ1ZSwidGF4X3JhdGVzIjpbeyJsYWJlbCI6IjYlIn0seyJsYWJlbCI6IjIxJSJ9XX0sInRoZW1lIjp7ImZhdmljb24iOiJodHRwczovL3Jlcy5jbG91ZGluYXJ5LmNvbS9hcGlkZWNrL2ljb25zL2ludGVyY29tIiwibG9nbyI6Imh0dHBzOi8vcmVzLmNsb3VkaW5hcnkuY29tL2FwaWRlY2svaWNvbnMvaW50ZXJjb20iLCJwcmltYXJ5X2NvbG9yIjoiIzI4NmVmYSIsInNpZGVwYW5lbF9iYWNrZ3JvdW5kX2NvbG9yIjoiIzI4NmVmYSIsInNpZGVwYW5lbF90ZXh0X2NvbG9yIjoiI0ZGRkZGRiIsInZhdWx0X25hbWUiOiJJbnRlcmNvbSIsInByaXZhY3lfdXJsIjoiaHR0cHM6Ly9jb21wbGlhbmNlLmFwaWRlY2suY29tL3ByaXZhY3ktcG9saWN5IiwidGVybXNfdXJsIjoiaHR0cHM6Ly93d3cudGVybXNmZWVkLmNvbS90ZXJtcy1jb25kaXRpb25zLzk1N2M4NWMxYjA4OWFlOWUzMjE5YzgzZWZmNjUzNzdlIn0sInNldHRpbmdzIjp7InVuaWZpZWRfYXBpcyI6WyJjcm0iLCJjcm0iXSwiaGlkZV9yZXNvdXJjZV9zZXR0aW5ncyI6ZmFsc2UsInNhbmRib3hfbW9kZSI6ZmFsc2UsImlzb2xhdGlvbl9tb2RlIjpmYWxzZSwic2Vzc2lvbl9sZW5ndGgiOiIzMG0iLCJzaG93X2xvZ3MiOnRydWUsInNob3dfc3VnZ2VzdGlvbnMiOmZhbHNlLCJzaG93X3NpZGViYXIiOnRydWUsImF1dG9fcmVkaXJlY3QiOmZhbHNlLCJoaWRlX2d1aWRlcyI6ZmFsc2UsImFsbG93X2FjdGlvbnMiOlsicmVhdXRob3JpemUiLCJkaXNhYmxlIl19LCJjb25zdW1lcl9pZCI6InRlc3QtY29uc3VtZXIiLCJhcHBsaWNhdGlvbl9pZCI6IjIyMjIiLCJzY29wZXMiOltdLCJpYXQiOjE3MzcxMDkxNzksImV4cCI6MTczNzExMDk3OX0.7_k7t68MEp9isZWbY5pUKaItKJteGADzXcsTqFBbBcM"
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
