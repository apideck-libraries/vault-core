import { Button } from '@apideck/components';
import React, { useState } from 'react';
import { TargetField } from '../types/TargetField';
import { useConnections } from '../utils/useConnections';
import { useTheme } from '../utils/useTheme';
import TargetFieldForm from './TargetFieldForm';

const FieldMapping = ({ resources }) => {
  const { selectedConnection } = useConnections();
  const [showForm, setShowForm] = useState(false);
  const [targetFields, setTargetFields] = useState([]);
  const { theme } = useTheme();

  if (!selectedConnection) return null;

  return (
    <div className="h-full rounded-b-xl">
      <div className="text-center p-5 md:p-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900">
          Field Mappings
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          {showForm
            ? 'Create a new Target Field and mapping specific to your Apideck integration'
            : `Map fields between Apideck and ${selectedConnection?.name}.`}
        </p>
      </div>
      {showForm && (
        <TargetFieldForm
          resources={resources}
          onCreate={(targetField) => {
            setTargetFields([...targetFields, targetField]);
            setShowForm(false);
          }}
        />
      )}
      {!showForm && (
        <div className="px-5 pb-5 md:px-6 md:pb-6">
          {targetFields.length === 0 && (
            <div className="text-center border border-gray-200/80 p-5 rounded-lg shadow-sm">
              <svg
                className="mx-auto h-8 w-8 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                />
              </svg>
              <h3 className="mt-2 text-sm font-semibold text-gray-900">
                No field mappings yet
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by creating a new field mapping.
              </p>
              <div className="mt-5">
                <Button
                  type="button"
                  size="small"
                  onClick={() => setShowForm(true)}
                  style={
                    theme?.primary_color
                      ? { backgroundColor: theme.primary_color }
                      : {}
                  }
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="-ml-0.5 mr-1.5 h-4 w-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4.5v15m7.5-7.5h-15"
                    />
                  </svg>
                  New Field Mapping
                </Button>
              </div>
            </div>
          )}
          {targetFields.length > 0 && (
            <>
              <div className="flex flex-col space-y-3 mb-3">
                {targetFields?.map((targetField: TargetField) => {
                  const originField = targetField.originFields?.find(
                    (field) =>
                      field.connectorId === selectedConnection.id.split('+')[1]
                  );

                  return (
                    <div
                      key={targetField.id}
                      className="ring-1 ring-gray-200 rounded-lg bg-white overflow-hidden shadow-sm"
                    >
                      <div className="bg-gray-100 p-2 px-3 text-sm font-medium flex items-center justify-between">
                        <code style={{ fontWeight: 600 }}>
                          {targetField.name}
                        </code>
                        <button className="inline-flex items-center p-1.5 text-sm font-medium text-center text-gray-400 bg-gray-100 ring-1 ring-gray-200/70 rounded-lg hover:bg-gray-50 focus:ring-4 focus:outline-none focus:ring-gray-50">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="h-4 w-4"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                            />
                          </svg>
                        </button>
                      </div>
                      <div className="flex items-center border-t justify-between sm:justify-start sm:space-x-3 p-2 px-3">
                        <img
                          src={selectedConnection.icon}
                          alt={selectedConnection.id}
                          className="w-8 h-8 rounded-full ring-2 ring-gray-100"
                        />

                        <div className="flex-1 truncate flex flex-col">
                          <h3
                            className="text-gray-800 text-sm truncate font-medium"
                            data-testid="connector-name"
                          >
                            <code>{originField?.name}</code>
                          </h3>
                          <span className="text-xs text-gray-500 font-normal">
                            {selectedConnection?.name}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center mt-1">
                <Button
                  variant="outline"
                  size="small"
                  onClick={() => setShowForm(true)}
                  className="border-gray-200/80"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="h-4 w-4 mr-1"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6v12m6-6H6"
                    />
                  </svg>
                  Field Mapping
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default FieldMapping;
