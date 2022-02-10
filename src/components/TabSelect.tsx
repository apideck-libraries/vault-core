import React, { Fragment, ReactNode } from 'react';

import { Tab } from '@headlessui/react';
import classNames from 'classnames';

interface Props {
  tabs: Tab[];
}

interface Tab {
  name: string;
  count: number;
  content: ReactNode;
}

const TabSelect = ({ tabs }: Props) => {
  return (
    <Tab.Group>
      <Tab.List>
        {tabs.map((tab: Tab, i: number) => (
          <Tab
            key={i}
            className={({ selected }) =>
              classNames(
                selected
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                'w-1/2 py-4 px-2 text-center border-b-2 font-medium text-sm',
                {
                  'w-full': tabs.length === 1,
                  'w-1/2': tabs.length === 2,
                  'w-1/3': tabs.length === 3,
                  'w-1/4': tabs.length === 4,
                  'w-1/5': tabs.length === 5,
                }
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
        {tabs.map((tab: Tab, i: number) => (
          <Tab.Panel key={`tab-${i}`}>{tab.content}</Tab.Panel>
        ))}
      </Tab.Panels>
    </Tab.Group>
  );
};

export default TabSelect;
