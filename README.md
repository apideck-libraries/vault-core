# React Vault

A React component to embed [Apideck Vault](https://www.apideck.com/products/vault) in any React application.

Go to the [developer docs](https://developers.apideck.com/guides/react-vault) for a step-by-step guide.

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

console.log('JWT:', data.session_token);
```

Pass the JWT together with your App ID and a consumer ID to the Vault component

```js
import { Vault } from '@apideck/react-vault';

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

If you are NOT using [Tailwind CSS](https://tailwindcss.com/) in your project, make your to include the styles in your project:

```js
import '@apideck/react-vault/dist/styles.css';
```

If you are using [Tailwind CSS](https://tailwindcss.com/) you should include the package path in the content path of the `tailwind.config.js`.
Also make sure you have the Tailwindcss Forms plugin installed.

```js
// tailwind.config.js

module.exports = {
  content: [
    './node_modules/@apideck/react-vault/**/*.js',
  ],
  plugins: [require('@tailwindcss/forms')]
  ...
}
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
