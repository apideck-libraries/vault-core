import MarkdownToJsx from 'markdown-to-jsx';
import React from 'react';

export const Markdown = ({ children }) => {
  return (
    <MarkdownToJsx
      options={{
        overrides: {
          a: {
            component: ({ href, children, title }) => (
              <a
                href={href}
                title={title}
                target="_blank"
                rel="noreferrer noopener"
              >
                {children}
              </a>
            ),
          },
        },
      }}
    >
      {children}
    </MarkdownToJsx>
  );
};
