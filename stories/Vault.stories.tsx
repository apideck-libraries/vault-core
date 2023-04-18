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
    token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZWRpcmVjdF91cmkiOiJodHRwczovL2FjbWUuY29tP2Zvbz1iYXImcXV4PXF1eiIsImNvbnN1bWVyX21ldGFkYXRhIjp7InVzZXJfbmFtZSI6IkFkbWluIFRlc3RpbmcifSwidGhlbWUiOnsiZmF2aWNvbiI6Imh0dHBzOi8vc3RhdGljLndpeHN0YXRpYy5jb20vbWVkaWEvMmNkNDNiXzBhN2NhOWZmYzMxYjQ3MTA5NjE5YzhkNWFkODc3Mjhifm12Mi5wbmcvdjEvZmlsbC93XzMyMCxoXzI5NyxxXzkwLzJjZDQzYl8wYTdjYTlmZmMzMWI0NzEwOTYxOWM4ZDVhZDg3NzI4Yn5tdjIucG5nIiwidmF1bHRfbmFtZSI6IkFjbWUgQ29ycCIsInByaW1hcnlfY29sb3IiOiIjODAzOWRmIiwic2lkZXBhbmVsX2JhY2tncm91bmRfY29sb3IiOiIjM2UwMDc1Iiwic2lkZXBhbmVsX3RleHRfY29sb3IiOiIjZmZmIn0sInNldHRpbmdzIjp7InNlc3Npb25fbGVuZ3RoIjoiMXciLCJpc29sYXRpb25fbW9kZSI6dHJ1ZSwiaGlkZV9ndWlkZXMiOmZhbHNlLCJhdXRvX3JlZGlyZWN0Ijp0cnVlfSwiY29uc3VtZXJfaWQiOiJmZXdoamZvaWV3IiwiYXBwbGljYXRpb25faWQiOiIyMjIyIiwic2NvcGVzIjpbXSwiaWF0IjoxNjgwMTc3Mzk5LCJleHAiOjE2ODA3ODIxOTl9.e2yHVHaYf7NMot4pCBECVxyPmg-XpECE73y3YqiF5Pw"
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
