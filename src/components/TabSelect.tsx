import React, { Fragment } from 'react';

import { Tab } from '@headlessui/react';

/*
  This example requires Tailwind CSS v2.0+

  This example requires some changes to your config:

  ```
  // tailwind.config.js
  module.exports = {
    // ...
    plugins: [
      // ...
      require('@tailwindcss/forms'),
    ],
  }
  ```
*/

function classNames(...classes) {
  return classes.filter(Boolean).join(' ');
}

export default function TabSelect({ tabs }) {
  return (
    <Tab.Group>
      <Tab.List>
        {tabs.map((tab) => (
          <Tab
            className={({ selected }) =>
              classNames(
                selected
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                'w-1/2 py-4 px-2 text-center border-b-2 font-medium text-sm'
              )
            }
          >
            {({ selected }) => (
              <Fragment>
                {tab.name}
                {tab.count ? (
                  <span
                    className={classNames(
                      selected
                        ? 'bg-primary-100 text-primary-600'
                        : 'bg-gray-100 text-gray-900',
                      'hidden ml-3 py-0.5 px-2.5 rounded-full text-xs font-medium md:inline-block'
                    )}
                  >
                    {tab.count}
                  </span>
                ) : null}
              </Fragment>
            )}
          </Tab>
        ))}
      </Tab.List>
      <Tab.Panels
        className="border-t border-gray-200 overflow-y-auto"
        style={{ maxHeight: 485 }}
      >
        {tabs.map((tab, i: number) => (
          <Tab.Panel key={i}>{tab.content}</Tab.Panel>
        ))}
      </Tab.Panels>
    </Tab.Group>
  );
}
