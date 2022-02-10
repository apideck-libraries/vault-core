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
const jwt =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZWRpcmVjdF91cmkiOiJodHRwOi8vbG9jYWxob3N0OjMwMDMvIiwiY29uc3VtZXJfbWV0YWRhdGEiOnsiYWNjb3VudF9uYW1lIjoidGVzdEBzYWxlc2ZvcmNlLmNvbSIsInVzZXJfbmFtZSI6IlRlc3QgVXNlciIsImltYWdlIjoiaHR0cHM6Ly91bmF2YXRhci5ub3cuc2gvamFrZSJ9LCJzZXR0aW5ncyI6eyJzYW5kYm94X21vZGUiOnRydWV9LCJjb25zdW1lcl9pZCI6InRlc3QtY29uc3VtZXIiLCJhcHBsaWNhdGlvbl9pZCI6ImNmYVpyT1JnYUgyUE1RcEljalRwZmhFUklwSUVVSkhldjA5dWNqVHAiLCJzY29wZXMiOltdLCJpYXQiOjE2NDQ0OTgwMDQsImV4cCI6MTY0NDUwMTYwNH0.eRqQ3ICXAxc4OA6K2OMLoXQ4wL8VZeokGL8jRL_n-kI';

const Template: Story<Props> = (args) => (
  <Vault
    trigger={<button className="p-2 border rounded shadow">Open modal</button>}
    appId="cfaZrORgaH2PMQpIcjTpfhERIpIEUJHev09ucjTp"
    consumerId="test-consumer"
    jwt={jwt}
    {...args}
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
Programaticly.args = {
  unifiedApi: 'crm',
  serviceId: 'salesforce',
};
