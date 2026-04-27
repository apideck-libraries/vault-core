import '../src/styles/index.css';

import { Meta, Story } from '@storybook/react';
import { ToastProvider } from '@apideck/components';
import React from 'react';

import ConnectionForm from '../src/components/ConnectionForm';
import { Connection } from '../src/types/Connection';

const baseConnection = {
  id: 'qbd-demo',
  name: 'QuickBooks Desktop',
  service_id: 'quickbooks-desktop',
  unified_api: 'accounting',
  auth_type: 'custom',
  state: 'added',
  enabled: true,
  validation_support: false,
  custom_mappings: [],
  configuration: [],
} as unknown as Connection;

interface TemplateArgs {
  formFields: any[];
}

const meta: Meta<TemplateArgs> = {
  title: 'ConnectionForm / Field types',
};
export default meta;

const Template: Story<TemplateArgs> = ({ formFields }) => (
  <ToastProvider>
    <div
      className="apideck"
      style={{
        maxWidth: 480,
        margin: '2rem auto',
        padding: '1.5rem',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        background: 'white',
      }}
    >
      <ConnectionForm
        connection={
          { ...baseConnection, form_fields: formFields } as Connection
        }
        setCurrentView={() => {}}
        settings={{}}
      />
    </div>
  </ToastProvider>
);

export const CopyField = Template.bind({});
CopyField.args = {
  formFields: [
    {
      id: 'qbd_password',
      label: 'Web Connector Password',
      type: 'copy',
      value: 'aB3kMnPq7RsTvW2x',
      description:
        'Save this password — you will need it when QuickBooks Web Connector prompts you during setup.',
      disabled: true,
      required: false,
      placeholder: '',
      mask: false,
      options: [],
      custom_field: false,
      hidden: false,
    },
  ],
};

export const InfoField = Template.bind({});
InfoField.args = {
  formFields: [
    {
      id: 'setup_instructions',
      label: 'Setup Instructions',
      type: 'info',
      value: '',
      description:
        '1. **Open QuickBooks Desktop** — make sure your company file is open\n2. **Open Web Connector** — find it in your Start menu or QuickBooks folder\n3. **Click "Add an application"** — select the .qwc file you downloaded\n4. **Authorize in QuickBooks** — click "Yes" when prompted',
      disabled: false,
      required: false,
      placeholder: '',
      mask: false,
      options: [],
      custom_field: false,
      hidden: false,
    },
  ],
};

export const InterpolationInDescription = Template.bind({});
InterpolationInDescription.args = {
  formFields: [
    {
      id: 'qwc_download_url',
      label: '',
      type: 'text',
      value:
        'https://qbd-connect.staging.apideck.com/api/qwc?connectionId=abc_123',
      description: '',
      disabled: false,
      required: false,
      placeholder: '',
      mask: false,
      options: [],
      custom_field: false,
      hidden: true,
    },
    {
      id: 'qwc_info',
      label: 'Web Connector Setup File',
      type: 'info',
      value: '',
      description:
        '[Download your QWC file]({{qwc_download_url}})\n\nOpen this file with QuickBooks Web Connector to register the connection.',
      disabled: false,
      required: false,
      placeholder: '',
      mask: false,
      options: [],
      custom_field: false,
      hidden: false,
    },
  ],
};

export const QBDFullSetup = Template.bind({});
QBDFullSetup.args = {
  formFields: [
    {
      id: 'qbd_password',
      label: 'Web Connector Password',
      type: 'copy',
      value: 'aB3kMnPq7RsTvW2x',
      description:
        'Save this password — you will need it when QuickBooks Web Connector prompts you during setup.',
      disabled: true,
      required: false,
      placeholder: '',
      mask: false,
      options: [],
      custom_field: false,
      hidden: false,
    },
    {
      id: 'qwc_download_url',
      label: '',
      type: 'text',
      value:
        'https://qbd-connect.staging.apideck.com/api/qwc?connectionId=abc_123',
      description: '',
      disabled: false,
      required: false,
      placeholder: '',
      mask: false,
      options: [],
      custom_field: false,
      hidden: true,
    },
    {
      id: 'qwc_setup',
      label: 'Web Connector Setup File',
      type: 'info',
      value: '',
      description:
        "[⬇ Download apideck.qwc]({{qwc_download_url}})\n\nSave this file, then add it to QuickBooks Web Connector on your Windows machine by clicking 'Add an Application'.",
      disabled: false,
      required: false,
      placeholder: '',
      mask: false,
      options: [],
      custom_field: false,
      hidden: false,
    },
    {
      id: 'setup_instructions',
      label: 'How to set up Web Connector',
      type: 'info',
      value: '',
      description:
        "1. **Open QuickBooks Desktop** — Make sure your company file is open\n2. **Open Web Connector** — Find it in your Start menu or QuickBooks folder\n3. **Click 'Add an application'** — Select the .qwc file you downloaded\n4. **Authorize in QuickBooks** — Click 'Yes' when prompted to allow access\n5. **Enter the password** — Use the password shown above\n6. **Run the sync** — Check the box and click 'Update Selected'",
      disabled: false,
      required: false,
      placeholder: '',
      mask: false,
      options: [],
      custom_field: false,
      hidden: false,
    },
  ],
};
