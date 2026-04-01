import { useState } from 'react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';

/**
 * CollapsibleSubcategory - A collapsible container for sidebar subcategory groups.
 * Used in URL Generator and Web Graphics Panel to group graphics by subcategory.
 *
 * @param {string} title - The subcategory display name
 * @param {boolean} defaultOpen - Whether to start expanded (default: true)
 * @param {React.ReactNode} children - The graphic buttons to render inside
 */
export default function CollapsibleSubcategory({ title, defaultOpen = true, children }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = () => setIsOpen(!isOpen);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <div className="mb-1">
      <button
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left text-xs font-medium text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50 rounded transition-colors"
      >
        <ChevronRightIcon
          className={`w-3 h-3 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-90' : ''
          }`}
        />
        <span>{title}</span>
      </button>
      {isOpen && (
        <div className="pl-4 mt-0.5">
          {children}
        </div>
      )}
    </div>
  );
}
