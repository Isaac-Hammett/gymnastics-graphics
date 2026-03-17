import { useState, useEffect, useRef } from 'react';
import { EllipsisVerticalIcon } from '@heroicons/react/24/solid';

/**
 * KebabMenu — three-dot overflow menu for assignment cards.
 * Accepts sections: [{ label, items: [{ label, icon, onClick, danger, disabled, hidden }] }]
 */
export default function KebabMenu({ sections }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
        title="More actions"
      >
        <EllipsisVerticalIcon className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg py-1 z-50 w-56 shadow-lg">
          {sections.map((section, si) => {
            const visibleItems = section.items.filter(item => !item.hidden);
            if (visibleItems.length === 0) return null;

            return (
              <div key={si}>
                {si > 0 && <div className="border-t border-zinc-700 my-1" />}
                <div className="px-3 py-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                  {section.label}
                </div>
                {visibleItems.map((item, ii) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={ii}
                      onClick={() => {
                        if (item.disabled) return;
                        item.onClick();
                        setOpen(false);
                      }}
                      disabled={item.disabled}
                      className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition-colors disabled:opacity-50 ${
                        item.danger
                          ? 'text-red-400 hover:bg-red-900/30'
                          : 'text-zinc-300 hover:bg-zinc-700'
                      }`}
                    >
                      {Icon && <Icon className="w-3.5 h-3.5 flex-shrink-0" />}
                      {item.label}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
