import React, { useState } from 'react';

import { Connection } from '../types/Connection';

const ResourceList = ({
  connection,
  setSelectedResource,
}: {
  connection: Connection;
  setSelectedResource: (resource: string) => void;
}) => {
  return (
    <div className="overflow-hidden bg-white border rounded-md">
      <ul className="divide-y divide-gray-200">
        {connection?.configurable_resources.map(
          (resource: string, index: number) => {
            return (
              <li key={`resource-${index}`}>
                <ResourceListItem
                  resource={resource}
                  setSelectedResource={setSelectedResource}
                />
              </li>
            );
          }
        )}
      </ul>
    </div>
  );
};

const ResourceListItem = ({ resource, setSelectedResource }) => {
  return (
    <button
      className="flex w-full capitalize items-center justify-between px-4 py-3 text-sm font-medium text-gray-800 sm:px-6 hover:bg-gray-50"
      onClick={() => setSelectedResource(resource)}
    >
      {resource}
    </button>
  );
};

export default ResourceList;
