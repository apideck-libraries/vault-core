const ConsumerSection = ({ consumer }: { consumer: any }) => {
  return (
    <div className="relative px-3 py-2 flex items-center rounded-b-lg bg-gray-100 border-t">
      <div className="flex items-center justify-between w-full">
        <div className="space-x-2 flex items-center">
          <div className="flex-shrink-0 h-8 w-8 rounded-lg shadow-lg ring-2 ring-white bg-white overflow-hidden">
            <img
              className="object-cover w-full h-full"
              src={consumer?.image}
              alt={consumer?.user_name ? consumer?.user_name : 'user'}
            />
          </div>
          <div className="flex-1 min-w-0 flex-col">
            <div className="flex items-center justify-between">
              <div className="focus:outline-none">
                <span className="absolute inset-0" aria-hidden="true" />
                <p className="text-sm font-medium text-gray-900">
                  {consumer?.user_name}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {consumer?.account_name}
                </p>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500">Signed in</p>
      </div>
    </div>
  );
};

export default ConsumerSection;
