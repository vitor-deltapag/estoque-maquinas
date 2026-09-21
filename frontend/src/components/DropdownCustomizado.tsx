"use client";

import { useState } from "react";

export type DropdownOption = { value: string; label: string };

export default function DropdownCustomizado({
  value,
  options,
  placeholder = "",
  onChange,
}: {
  value: string;
  options: DropdownOption[];
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedLabel = options.find((opt) => opt.value === value)?.label || placeholder;

  return (
    <div className="relative w-full font-sans">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-white border border-gray-300 rounded-lg p-2.5 font-medium focus:ring-2 focus:ring-orange-500 outline-none flex justify-between items-center text-left dark:bg-gray-900 dark:border-gray-700 transition-colors"
      >
        <span className={value ? "text-gray-900 font-medium dark:text-white" : "text-gray-500"}>{selectedLabel}</span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
          <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto dark:bg-gray-900 dark:border-gray-800 transition-colors">
            {placeholder ? (
              <li
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
                className="p-2.5 text-gray-500 cursor-pointer hover:bg-orange-500 hover:text-white transition-colors text-sm"
              >
                {placeholder}
              </li>
            ) : null}
            {options.map((opt) => (
              <li
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className="p-2.5 text-gray-900 cursor-pointer hover:bg-orange-500 hover:text-white transition-colors text-sm font-medium dark:text-white"
              >
                {opt.label}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
