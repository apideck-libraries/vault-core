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
    token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZWRpcmVjdF91cmkiOiJodHRwczovL3BsYXRmb3JtLmFwaWRlY2suY29tL3ZhdWx0IiwiY29uc3VtZXJfbWV0YWRhdGEiOnsiYWNjb3VudF9uYW1lIjoiQXBpZGVjayBTYW5kYm94IiwidXNlcl9uYW1lIjoiSmFrZSIsImltYWdlIjoiaHR0cHM6Ly91bmF2YXRhci5ub3cuc2gvamFrZUBhcGlkZWNrLmNvbSJ9LCJ0aGVtZSI6eyJmYXZpY29uIjoiaHR0cHM6Ly9yZXMuY2xvdWRpbmFyeS5jb20vYXBpZGVjay9pbWFnZS91cGxvYWQvdjE2MjcwNDU0OTkvbWFya2V0cGxhY2VzL2hsY3owenpsMHZkcmhpZnF5eHdqLnBuZyIsInByaW1hcnlfY29sb3IiOiIjMTQyNDNiIiwicHJpdmFjeV91cmwiOiJodHRwczovL2NvbXBsaWFuY2UuYXBpZGVjay5jb20vcHJpdmFjeS1wb2xpY3kiLCJzaWRlcGFuZWxfYmFja2dyb3VuZF9jb2xvciI6IiMxNDI0M2IiLCJzaWRlcGFuZWxfdGV4dF9jb2xvciI6IiNGRkZGRkYiLCJ0ZXJtc191cmwiOiJodHRwczovL3d3dy50ZXJtc2ZlZWQuY29tL3Rlcm1zLWNvbmRpdGlvbnMvOTU3Yzg1YzFiMDg5YWU5ZTMyMTljODNlZmY2NTM3N2UiLCJ2YXVsdF9uYW1lIjoiVmF1bHQgRGVtbyJ9LCJzZXR0aW5ncyI6eyJzZXNzaW9uX2xlbmd0aCI6IjI0aCJ9LCJjb25zdW1lcl9pZCI6InRlc3QtY29uc3VtZXIiLCJhcHBsaWNhdGlvbl9pZCI6IkFpQ2t6eGNwWld1eFVSTVVrYTlmOVdPVVJoa09iMEh4cEtVa2EiLCJzY29wZXMiOltdLCJpYXQiOjE2NzExODA2NzQsImV4cCI6MTY3MTI2NzA3NH0.pmgQooPRxy0bfPLbuOd5OABhIlVYEq_c23nKKDS5jqE"
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
