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
    token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzZXR0aW5ncyI6eyJoaWRlX3Jlc291cmNlX3NldHRpbmdzIjp0cnVlfSwiY29uc3VtZXJfaWQiOiJ0ZXN0LWNvbnN1bWVyIiwiYXBwbGljYXRpb25faWQiOiJBaUNrenhjcFpXdXhVUk1Va2E5ZjlXT1VSaGtPYjBIeHBLVWthIiwic2NvcGVzIjpbXSwiaWF0IjoxNjcxMTkzNTg3LCJleHAiOjE2NzExOTcxODd9.GnDXyj24U7A7HznuexOYdPwfGvr4OknVVP_iMwYzQ_8"
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
