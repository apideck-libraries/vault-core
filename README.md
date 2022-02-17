# React Vault

A React component to embed [Apideck Vault](https://www.apideck.com/products/vault) in any React application.

Sign up for a free account at [apideck.com](https://app.apideck.com/signup) to obtain an API key and App ID.

## Usage

Install the component

```sh
yarn add @apideck/react-vault
```

Create a [Vault session](https://developers.apideck.com/apis/vault/reference#operation/sessionsCreate) inside your application to get a JSON Web Token.
It's recommended to do this server-side, so you don't expose your API key.

With `@apideck/node`:

```sh
yarn add @apideck/node
```

```js
import { Apideck } from '@apideck/node';

const apideck = new Apideck({
  apiKey: 'REPLACE_WITH_API_KEY',
  appId: 'REPLACE_WITH_APP_ID',
  consumerId: 'REPLACE_WITH_CONSUMER_ID',
});

const { data } = await apideck.vault.sessionsCreate();

console.log('JWT:', data.session_token);
```

Pass the JWT together with your App ID and a consumer ID to the Vault component

```js
import { Vault } from '@apideck/react-vault';
import '@apideck/react-vault/dist/styles.css'; // Only if not using Tailwind CSS already

const MyApp = () => {
  return (
    <Vault
      trigger={<button>Open Vault</button>}
      jwt="REPLACE_WITH_SESSION_TOKEN"
      appId="REPLACE_WITH_APP_ID"
      consumerId="REPLACE_WITH_CONSUMER_ID"
    />
  );
};
```

### Properties

| Property        | Type    | Required | Default | Description                                                                |
| --------------- | ------- | -------- | ------- | -------------------------------------------------------------------------- |
| appId           | string  | true     | -       | The ID of your Unify application                                           |
| consumerId      | string  | true     | -       | The ID of the consumer which you want to fetch integrations from           |
| jwt             | string  | true     | -       | The JSON Web Token returned from the Create Session call                   |
| trigger         | element | false    | -       | The component that should trigger the Vault modal on click                 |
| showAttribution | boolean | false    | true    | Show "Powered by Apideck" in the backdrop of the modal backdrop            |
| open            | boolean | false    | false   | Opens the Vault modal if set to true                                       |
| onClose         | event   | false    | -       | Function that gets called when the modal is closed                         |
| unifiedApi      | string  | false    | -       | When unifiedApi and serviceId are provided Vault opens a single connection |
| serviceId       | string  | false    | -       | When unifiedApi and serviceId are provided Vault opens a single connection |

### Using Tailwind?

The Vault modal is styled using [Tailwind CSS](https://tailwindcss.com/). If you were to use the Vault component in a project that also uses Tailwind CSS, you can omit the CSS file import, and include the package in the content or purge path of the `tailwind.config.js`.

```js
// tailwind.config.js

// Tailwind 3+
module.exports = {
  content: [
    './node_modules/@apideck/react-vault/**/*.js',
  ],
  ...
}

// Tailwind 1 or 2
module.exports = {
  purge: [
    './node_modules/@apideck/react-vault/**/*.js',
  ],
  ...
}
```
