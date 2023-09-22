import { Button, TextInput, useDebounce } from '@apideck/components';
import { Menu, Transition } from '@headlessui/react';
import classNames from 'classnames';

import Fuse from 'fuse.js';
import React, {
  ChangeEvent,
  Fragment,
  RefObject,
  cloneElement,
  useEffect,
  useRef,
  useState,
} from 'react';

interface Props {
  onSelect: (field: any) => void;
  properties: any;
  isLoading: boolean;
  triggerComponent?: any;
  triggerComponentProps?: any;
  className?: string;
  buttonRef?: any;
  customFields: any; // todo
}

const FieldSelector = ({
  onSelect,
  properties,
  isLoading,
  triggerComponent,
  triggerComponentProps,
  className = '',
  customFields,
  buttonRef,
}: Props) => {
  const [selectedObjectProperty, setSelectedObjectProperty] =
    useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const isCustomFieldMapping = !!customFields?.length;
  const [mode, setMode] = useState<'custom' | 'root' | 'advanced'>(
    isCustomFieldMapping ? 'custom' : 'root'
  );
  const [list, setList] = useState<any>([]);
  const debouncedSearchTerm = useDebounce(searchTerm, 250);
  const [fieldMappingString, setFieldMappingString] = useState();
  const searchInputRef: any = useRef();

  useEffect(() => {
    if (debouncedSearchTerm) {
      const mapped = properties.map((p: any) => {
        return {
          name: p[0],
          value: p[1],
        };
      });

      const fuse = new Fuse(mapped, {
        keys: ['name'],
        threshold: 0.4,
      });
      const results = fuse.search(debouncedSearchTerm);

      let propResults = {};
      results.forEach((result: Fuse.FuseResult<any>) => {
        propResults = { ...propResults, [result.item.name]: result.item.value };
      });

      setList(
        Object.keys(propResults)?.length ? Object.entries(propResults) : []
      );
    }
    searchInputRef?.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearchTerm]);

  const propsToShow = searchTerm.length ? list : properties;

  const renderMenuItem = ({ title, type, properties, items, ...rest }: any) => {
    const isSelectable =
      (type === 'array' && !items?.properties) || // array of strings, numbers, etc.
      (type !== 'array' && type !== 'object');

    return (
      <Menu.Item>
        {({ active }) => (
          <button
            type="button"
            className={`${
              active ? 'bg-primary-500 text-white' : 'text-gray-900'
            } group flex w-full items-center rounded-md px-2 py-2 text-sm justify-between`}
            onClick={(e) => {
              // if (type === 'customField') {
              //   onSelect({ type, ...rest });
              //   onSelect({
              //     title,
              //     mode: 'manual',
              //     description: rest?.['finder'],
              //   });
              //   return;
              // }
              if (isSelectable) {
                onSelect({ title, type, ...rest });
                return;
              }
              e.preventDefault();
              setSelectedObjectProperty({
                title,
                properties: items?.properties || properties,
                previousObjectProperty: selectedObjectProperty,
              });
            }}
          >
            <div className="flex items-center space-x-2 truncate">
              <span>{title}</span>
              <span
                className={`italic text-gray-400 text-xs ${
                  active ? 'text-primary-200' : ''
                }`}
              >
                {type === 'null' ? 'unknown' : type}
              </span>
            </div>
            {/* {!isSelectable && <HiOutlineChevronRight className="h-4 w-4" />} */}
          </button>
        )}
      </Menu.Item>
    );
  };

  /* If selectedObjectProperty is present, we only want to render the items inside of that object */
  const propertiesToRender = selectedObjectProperty
    ? Object.entries(selectedObjectProperty.properties)
    : propsToShow;

  const noFieldsFound =
    mode !== 'advanced' && !isLoading && !propertiesToRender?.length;

  const tabs = [
    ...(isCustomFieldMapping
      ? [
          {
            id: 'custom',
            name: 'Custom fields',
            current: mode === 'custom',
          },
        ]
      : [
          {
            id: 'root',
            name: 'Root fields',
            current: mode === 'root',
          },
        ]),
    {
      id: 'advanced',
      name: 'Advanced',
      current: mode === 'advanced',
    },
  ];

  return (
    <Menu
      as="div"
      className={classNames('relative w-full text-left z-10', className)}
      id="field-selector"
    >
      {({ open }) => (
        <Fragment>
          {triggerComponent ? (
            <Menu.Button {...triggerComponentProps} ref={buttonRef}>
              {cloneElement(triggerComponent, { open })}
            </Menu.Button>
          ) : (
            <Menu.Button className="inline-flex w-full justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75">
              Select field
              {/* <HiOutlineChevronDown
                className="ml-2 -mr-1 h-5 w-5 text-primary-200 hover:text-primary-100"
                aria-hidden="true"
              /> */}
            </Menu.Button>
          )}

          <Transition
            enter="transition duration-100 ease-out"
            enterFrom="transform scale-95 opacity-0"
            enterTo="transform scale-100 opacity-100 top-8"
            leave="transition duration-75 ease-out"
            leaveFrom="transform scale-100 opacity-100"
            leaveTo="transform scale-95 opacity-0"
          >
            <Menu.Items
              className="absolute z-40 mt-2 w-[calc(100%-0px)] left-[0px] origin-top-right divide-y divide-gray-100 overflow-hidden bg-white shadow-lg ring-1 ring-gray-200 rounded-b-2xl focus:outline-none"
              style={{ top: -50 }}
            >
              <div className="px-3 pb-2 max-h-[330px] 2xl:max-h-[380px] overflow-y-auto divide-y divide-gray-200">
                <nav
                  className="-mb-px flex space-x-6 -mx-3 border-b px-3"
                  aria-label="Tabs"
                >
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setMode(tab.id)}
                      type="button"
                      className={classNames(
                        tab.current
                          ? 'border-gray-700 text-gray-900 font-medium'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                        'group inline-flex items-center py-2 mt-1 border-b text-xs'
                      )}
                    >
                      <span>{tab.name}</span>
                    </button>
                  ))}
                </nav>

                {mode === 'advanced' && (
                  <div className="mb-3">
                    <div className="mt-3">
                      <label
                        htmlFor="fieldMapping"
                        className="block text-sm font-medium leading-5 text-gray-700"
                      >
                        Enter a field mapping.
                      </label>
                      <TextInput
                        placeholder="$['address']['example']"
                        className="mt-1"
                        name="fieldMapping"
                        onChange={(e: any) =>
                          setFieldMappingString(e.target.value)
                        }
                      />
                      <div className="flex justify-end">
                        <Menu.Item>
                          <Button
                            text="Confirm"
                            size="small"
                            className="mt-2"
                            disabled={!fieldMappingString}
                            onClick={() => {
                              onSelect({
                                title: fieldMappingString,
                                mode: 'manual',
                                description: fieldMappingString,
                              });
                            }}
                          />
                        </Menu.Item>
                      </div>
                    </div>
                  </div>
                )}

                {/* If selectedObjectProperty is not null, render a back button */}
                {mode === 'root' && selectedObjectProperty ? (
                  <Menu.Item as="div">
                    {({ active }) => (
                      <button
                        className={`${
                          active ? '' : 'text-gray-900 rounded-lg'
                        } group flex w-full fade-left items-center mt-2.5 px-2 hover:bg-gray-100 py-2 mb-2 text-sm font-semibold border-b text-gray-900 hover:text-gray-600 border bg-gray-50 rounded-md sm:text-sm focus:ring-transparent border-gray-200`}
                        onClick={(e) => {
                          e.preventDefault();
                          setSelectedObjectProperty(
                            selectedObjectProperty?.previousObjectProperty
                          );
                        }}
                      >
                        {/* <HiOutlineChevronLeft className="h-4 w-4 ml-2.5 mr-2.5" /> */}
                        {selectedObjectProperty?.title}
                      </button>
                    )}
                  </Menu.Item>
                ) : (
                  mode !== 'advanced' &&
                  (!noFieldsFound || searchTerm?.length > 0) && (
                    <div className="px-1.5 py-3">
                      <SearchInput
                        value={searchTerm}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setSearchTerm(event.target.value)
                        }
                        searchInputRef={searchInputRef}
                        autoFocus={true}
                        placeholder={
                          mode === 'root'
                            ? 'Search properties'
                            : 'Search fields'
                        }
                      />
                    </div>
                  )
                )}
                {mode === 'root' &&
                  propertiesToRender?.map(
                    (property: { [key: string]: any }, index: number) =>
                      renderMenuItem({
                        title: property[0],
                        ...property[1],
                        index,
                      })
                  )}
                {mode === 'custom' &&
                  customFields.map((field) =>
                    renderMenuItem({
                      title: field?.name || field?.id,
                      type: 'customField',
                      description: field?.['finder'],
                      ...field,
                    })
                  )}
                {isLoading && !properties?.length && (
                  <div className="mx-1.5 mt-1.5">
                    {[...new Array(7).keys()]?.map((i: number) => {
                      return (
                        <div
                          className="bg-gray-300 h-5 group flex w-full items-center rounded-md mb-2 animate-pulse"
                          key={i}
                        />
                      );
                    })}
                  </div>
                )}

                {mode === 'root' && noFieldsFound && (
                  <div className="p-3 py-5 text-sm text-gray-500">
                    No fields found for mapping.
                  </div>
                )}

                {mode === 'custom' && customFields?.length === 0 && (
                  <div className="p-3 py-5 text-sm text-gray-500">
                    No custom fields found for mapping.
                  </div>
                )}
              </div>
            </Menu.Items>
          </Transition>
        </Fragment>
      )}
    </Menu>
  );
};

interface SearchInputProps {
  value: string;
  searchInputRef: RefObject<HTMLInputElement>;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
  placeholder?: string;
}

const SearchInput = ({
  value,
  searchInputRef,
  onChange,
  autoFocus,
  placeholder = 'Search connectors',
}: SearchInputProps) => {
  return (
    <div className="relative fade-in">
      <div className="absolute left-0 flex items-center pt-[11px] pl-2.5 pointer-events-none">
        <svg
          className="w-4 h-4 text-gray-400"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
            clipRule="evenodd"
          />
        </svg>
      </div>
      <input
        name="search"
        type="text"
        ref={searchInputRef}
        placeholder={placeholder}
        value={value}
        className="w-full text-gray-600 border bg-gray-100 rounded-md sm:text-sm focus:ring-transparent border-gray-100 focus:border-gray-200 placeholder-gray-400 pl-8"
        autoComplete="off"
        onChange={onChange}
        data-testid="search-input"
        autoFocus={autoFocus}
      />
    </div>
  );
};

export default FieldSelector;
