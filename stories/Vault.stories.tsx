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
    token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZWRpcmVjdF91cmkiOiJodHRwczovL3BsYXRmb3JtLmFwaWRlY2suY29tL3ZhdWx0IiwiY29uc3VtZXJfbWV0YWRhdGEiOnsiYWNjb3VudF9uYW1lIjoiQXBpZGVjayBTYW5kYm94IiwidXNlcl9uYW1lIjoiSmFrZSIsImltYWdlIjoiaHR0cHM6Ly91bmF2YXRhci5ub3cuc2gvamFrZUBhcGlkZWNrLmNvbSJ9LCJ0aGVtZSI6eyJmYXZpY29uIjoiaHR0cHM6Ly93d3cuYXBpZGVjay5jb20vc3RhdGljL2Zhdmljb24ucG5nIiwibG9nbyI6bnVsbCwicHJpbWFyeV9jb2xvciI6IiMwMzA0NWUiLCJwcml2YWN5X3VybCI6Imh0dHBzOi8vY29tcGxpYW5jZS5hcGlkZWNrLmNvbS9wcml2YWN5LXBvbGljeSIsInNpZGVwYW5lbF9iYWNrZ3JvdW5kX2NvbG9yIjoiIzE2MjYzZiIsInNpZGVwYW5lbF90ZXh0X2NvbG9yIjoiI0ZGRkZGRiIsInRlcm1zX3VybCI6Imh0dHBzOi8vd3d3LnRlcm1zZmVlZC5jb20vdGVybXMtY29uZGl0aW9ucy85NTdjODVjMWIwODlhZTllMzIxOWM4M2VmZjY1Mzc3ZSIsInZhdWx0X25hbWUiOiJBcGlkZWNrIFNhbmRib3gifSwic2V0dGluZ3MiOnsic2FuZGJveF9tb2RlIjp0cnVlfSwiY29uc3VtZXJfaWQiOiJ0ZXN0LWNvbnN1bWVyIiwiYXBwbGljYXRpb25faWQiOiJjZmFack9SZ2FIMlBNUXBJY2pUcGZoRVJJcElFVUpIZXYwOXVjalRwIiwic2NvcGVzIjpbXSwiaWF0IjoxNjY5MTA4Nzk2LCJleHAiOjE2NjkxMTIzOTZ9.16jtYJRistRSAxzppkMcF_sruYqXcyVKLALAI1XhZxw"
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
