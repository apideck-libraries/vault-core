import 'react-app-polyfill/ie11';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Vault } from '../.';
import '../dist/tailwind.css';
import '../dist/styles.css';
import '../dist/custom.css';

const App = () => {
  return (
    <div>
      <Vault
        token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjb25zdW1lcl9tZXRhZGF0YSI6eyJhY2NvdW50X25hbWUiOiJTYW1wbGUiLCJ1c2VyX25hbWUiOiJ2YXVsdEBzYW1wbGUiLCJpbWFnZSI6Imh0dHBzOi8vdW5hdmF0YXIubm93LnNoL2pha2UifSwiY29uc3VtZXJfaWQiOiJ0ZXN0LWNvbnN1bWVyIiwiYXBwbGljYXRpb25faWQiOiIyMjIyIiwic2NvcGVzIjpbXSwiZGF0YV9zY29wZXMiOnsiZW5hYmxlZCI6ZmFsc2V9LCJpYXQiOjE3NzMwNTUyMTcsImV4cCI6MTc3MzA1ODgxN30.3eHi8rS4MQ2Ryt9VN0fWHwKYfNdVjzQO8Y9qQ15JE-c"
        unifiedApi="accounting"
        serviceId="quickbooks"
        unifyBaseUrl="https://localhost:3050"
        redirectUrl="http://localhost:3003/oauth/callback"
        trigger={<button>Open Vault</button>}
      />
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));
