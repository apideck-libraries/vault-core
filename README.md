# Vault Core

<br />

**🚨 We recommend using the new [@apideck/vault-react](https://www.npmjs.com/package/@apideck/vault-react) package.**

<br />

---

A React component to embed [Apideck Vault](https://www.apideck.com/products/vault) in any React application.

Go to the [developer docs](https://developers.apideck.com/guides/react-vault) for a step-by-step guide.

<img src="https://user-images.githubusercontent.com/8850410/208065819-716c6e02-98c9-4df5-b687-e5acd1e3c4e5.png" width="100%" />

**React Vault** | [Vault JS](https://github.com/apideck-libraries/vault-js) | [Vue Vault](https://github.com/apideck-libraries/vue-vault)

## Usage

Install the packages

```sh
npm install @apideck/react-vault
```

Create a [Vault session](https://developers.apideck.com/apis/vault/reference#operation/sessionsCreate) inside your application to get a JSON Web Token.
It's recommended to do this server-side, so you don't expose your API key.

With `@apideck/node`:

```sh
npm install @apideck/node
```

```js
import { Apideck } from '@apideck/node';

const apideck = new Apideck({
  apiKey: 'REPLACE_WITH_API_KEY',
  appId: 'REPLACE_WITH_APP_ID',
  consumerId: 'REPLACE_WITH_CONSUMER_ID',
});

const { data } = await apideck.vault.sessionsCreate({});

console.log('Token:', data.session_token);
```

Pass the JSON Web Token to the Vault component:

```js
import { Vault } from '@apideck/react-vault';

const MyComponent = () => {
  return (
    <Vault
      token="REPLACE_WITH_SESSION_TOKEN"
      trigger={<button>Open Vault</button>}
    />
  );
};

export default MyComponent;
```

If you are NOT using [Tailwind CSS](https://tailwindcss.com/) in your project, make your to include the styles in your project:

```js
import '@apideck/react-vault/dist/styles.css';
```

If you are using [Tailwind CSS](https://tailwindcss.com/) you should include the package path in the content path of the `tailwind.config.js`.

```js
// tailwind.config.js

module.exports = {
  content: ['./node_modules/@apideck/react-vault/**/*.js'],
  plugins: [require('@tailwindcss/forms')]
  ...
}
```

If you want to scope the connection results to a single Unified API, you can do that by giving the `unifiedApi` prop. If you want to open Vault for only a single connector, you should also provide the `serviceId`.

```js
import { Vault } from '@apideck/react-vault';

const MyComponent = () => {
  return (
    <Vault
      token="REPLACE_WITH_SESSION_TOKEN"
      unifiedApi="accounting"
      serviceId="quickbooks"
      trigger={<button>Open Vault</button>}
    />
  );
};

export default MyComponent;
```

If you want to manually control the opening and closing of the modal, you can provide the `open` and `onClose` props.

```jsx
import { Button } from '@apideck/components';
import { Vault } from '@apideck/react-vault';
import { useState } from 'react';

const VaultButton = ({ token }) => {
  const [openVault, setOpenVault] = useState(false);

  const toggleVault = () => {
    setOpenVault(!openVault);
  };

  return (
    <div className="flex items-center space-x-3">
      <Button text="Open Vault" onClick={toggleVault} />
      <Vault token={token} open={openVault} onClose={toggleVault} />
    </div>
  );
};

export default VaultButton;
```

If you want to open a specific view you can pass the `initialView` prop. The available views are `settings`, `configurable-resources`, and `custom-mapping`.

```js
import { Vault } from '@apideck/react-vault';

const MyComponent = () => {
  return (
    <Vault
      token="REPLACE_WITH_SESSION_TOKEN"
      unifiedApi="accounting"
      serviceId="quickbooks"
      initialView="custom-mapping"
      trigger={<button>Open Vault</button>}
    />
  );
};

export default MyComponent;
```

If you want to provide a custom logo on top of the modal, you can set the `logo` property on the `theme` you can provide through the session. [View Vault API documentation](https://developers.apideck.com/apis/vault/reference#operation/sessionsCreate).

### Properties

| Property           | Type                             | Required | Default | Description                                                                                                                                       |
| ------------------ | -------------------------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| token              | string                           | true     | -       | The JSON Web Token returned from the Create Session call                                                                                          |
| trigger            | element                          | false    | -       | The component that should trigger the Vault modal on click                                                                                        |
| showAttribution    | boolean                          | false    | true    | Show "Powered by Apideck" in the backdrop of the modal backdrop                                                                                   |
| open               | boolean                          | false    | false   | Set the toggle to `true` to open the Vault modal, and set it to `false` to close the Vault modal                                                  |
| onClose            | () => void                       | false    | -       | Function that gets called when the modal is closed                                                                                                |
| onConnectionChange | (connection: Connection) => void | false    | -       | Function that gets called when the user updates a connection. This can be linking their account, filling out settings or adding a new connection  |
| onConnectionDelete | (connection: Connection) => void | false    | -       | Function that gets called when the user deletes a connection                                                                                      |
| unifiedApi         | string                           | false    | -       | When unifiedApi is provided it will scope the connection results to that API. If also a serviceId is provided Vault opens for a single connection |
| serviceId          | string                           | false    | -       | When unifiedApi and serviceId are provided Vault opens a single connection                                                                        |
| showConsumer       | boolean                          | false    | false   | Show the consumer metadata provided when creating a session                                                                                       |
| initialView        | ConnectionViewType               | false    | -       | Open Vault in a specific view for a connection session                                                                                            |
