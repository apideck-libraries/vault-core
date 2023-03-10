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
    token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyZWRpcmVjdF91cmkiOiJodHRwczovL2FjbWUuY29tIiwiY29uc3VtZXJfbWV0YWRhdGEiOnsiYWNjb3VudF9uYW1lIjoiJ0N1c3RvbWVyIG9mIEFjbWUnIENvbXBhbnkiLCJlbWFpbCI6InBhdWwuaHVkc29uQGN1c3RvbWVyLW9mLWFjbWUuY29tIiwidXNlcl9uYW1lIjoiRGF2ZSBDdXN0b21lciIsImltYWdlIjoiaHR0cHM6Ly9hcGkudWlmYWNlcy5jby9vdXItY29udGVudC9kb25hdGVkLzFIXzdBeFAwLmpwZyJ9LCJ0aGVtZSI6eyJmYXZpY29uIjoiaHR0cHM6Ly9zdGF0aWMud2l4c3RhdGljLmNvbS9tZWRpYS8yY2Q0M2JfMGE3Y2E5ZmZjMzFiNDcxMDk2MTljOGQ1YWQ4NzcyOGJ-bXYyLnBuZy92MS9maWxsL3dfMzIwLGhfMjk3LHFfOTAvMmNkNDNiXzBhN2NhOWZmYzMxYjQ3MTA5NjE5YzhkNWFkODc3Mjhifm12Mi5wbmciLCJ2YXVsdF9uYW1lIjoiQWNtZSBDb3JwIiwicHJpbWFyeV9jb2xvciI6IiM4MDM5ZGYiLCJzaWRlcGFuZWxfYmFja2dyb3VuZF9jb2xvciI6IiMzZTAwNzUiLCJzaWRlcGFuZWxfdGV4dF9jb2xvciI6IiNmZmYifSwic2V0dGluZ3MiOnsic2Vzc2lvbl9sZW5ndGgiOiIxdyIsImlzb2xhdGlvbl9tb2RlIjp0cnVlLCJoaWRlX2d1aWRlcyI6ZmFsc2V9LCJjb25zdW1lcl9pZCI6ImZvb2JhciIsImFwcGxpY2F0aW9uX2lkIjoib1o2aHAzazZldzNvOEZNaEZHZWdIWVZpYTZDRUt5S1JxRlAxRkdlZyIsInNjb3BlcyI6W10sImlhdCI6MTY3ODM1NjgyNywiZXhwIjoxNjc4OTYxNjI3fQ.CQsaJE_VNKtkQVL8fPdvbcRza_1mH3B3_olzMOwMK4Y"
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
