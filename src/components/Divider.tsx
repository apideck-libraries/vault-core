import React from 'react';

const Divider = ({ text }: { text?: string }) => {
  return (
    <div className="relative py-4 -mx-5 p-5 md:-mx-6">
      <div className="absolute inset-0 flex items-center" aria-hidden="true">
        <div className="w-full border-t border-gray-300" />
      </div>
      {text ? (
        <div className="relative flex justify-center">
          <span className="px-2 bg-white text-sm text-gray-500">{text}</span>
        </div>
      ) : null}
    </div>
  );
};

export default Divider;
