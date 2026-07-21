import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { ORIGINS, readMode } from './origins';

// Middle iframe, served from [::1] — cross-origin to both the top-level host
// (localhost) and the widget it embeds (127.0.0.1). Its only job is to add a
// second cross-origin boundary above the widget, matching OCTA's nesting.

const mode = readMode();
const widgetSrc = `${ORIGINS.widget}/grant-handoff/widget.html?opener=${mode}`;

const App = () => (
  <div style={{ margin: 0, fontFamily: 'system-ui' }}>
    <div
      style={{
        padding: '4px 12px',
        font: '11px/1.4 system-ui',
        color: '#334155',
        background: '#e2e8f0',
      }}
    >
      middle iframe · <code>{ORIGINS.middle}</code> (cross-origin to host and
      widget)
    </div>
    <iframe
      title="widget"
      src={widgetSrc}
      style={{ width: '100%', height: 'calc(100vh - 84px)', border: 'none' }}
    />
  </div>
);

ReactDOM.render(<App />, document.getElementById('root'));
