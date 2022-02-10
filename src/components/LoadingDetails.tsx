import React from 'react';

interface Props {
  onClose: () => void;
}

const LoadingDetails = ({ onClose }: Props) => {
  return (
    <div className="relative -m-6 sm:rounded-lg h-full">
      <div className="grid grid-cols-3 px-6">
        <button
          className="inline-flex mt-3 items-center justify-center w-10 h-10 text-gray-900 transition-all duration-200 rounded-full hover:bg-gray-100 focus:outline-none"
          onClick={onClose}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </button>
        <div className="w-20 h-20 -mt-8 rounded-full shadow-md mx-aut bg-gradient-to-r from-indigo-500 to-primary-600 ring-white ring-4 mx-auto animate-spin " />
        <div className="flex flex-col items-end mt-3" />
      </div>
      <div className="h-full rounded-b-xl">
        <div className="flex flex-col justify-center items-center text-center p-5 md:p-6 animate-pulse">
          <div className="rounded mb-5 w-28 h-4 bg-gray-500" />
          <div className="rounded mb-5 w-16 h-2.5 bg-gray-400" />
          <div className="rounded mb-2 w-60 h-2 bg-gray-300" />
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
