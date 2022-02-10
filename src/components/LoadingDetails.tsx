import React from 'react';

const LoadingDetails = () => {
  return (
    <div className="relative -m-6 sm:rounded-lg h-full">
      <div className="grid grid-cols-3 px-6">
        <div className="mt-3" />
        <div className="w-20 h-20 -mt-8 rounded-full shadow-md mx-aut bg-gradient-to-r from-indigo-400 to-primary-500 ring-white ring-4 mx-auto animate-spin " />
        <div className="mt-3" />
      </div>
      <div className="h-full rounded-b-xl">
        <div className="flex flex-col justify-center items-center text-center p-5 md:p-6 animate-pulse">
          <div className="rounded mb-5 w-28 h-3.5 bg-gray-400" />
          <div className="rounded mb-5 w-16 h-2.5 bg-gray-400" />
          <div className="rounded mb-2 w-60 h-2 bg-gray-300" />
          <div className="rounded mb-2 w-52 h-2 bg-gray-300" />
          <div className="rounded mb-2 w-52 h-2 bg-gray-300" />
          <div className="rounded w-20 h-2 mb-5 bg-gray-300" />
          <div className="inline-flex items-center font-medium leading-none rounded-full whitespace-nowrap px-4 py-1.5 text-sm bg-gray-100 text-gray-800">
            Loading
          </div>
        </div>
      </div>
    </div>
  );
};
export default LoadingDetails;
