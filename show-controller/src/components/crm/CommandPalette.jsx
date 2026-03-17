import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlassIcon, UserIcon, CalendarIcon, ClockIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { db, ref, get } from '../../lib/firebase';
import { SERVER_URL } from '../../lib/serverUrl';

/**
 * CommandPalette — Global search overlay (Cmd+K / Ctrl+K)
 *
 * Searches talent roster and competitions from a single input.
 * Renders via createPortal at document root level.
 */
export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  // Data caches with TTL
  const talentCacheRef = useRef({ data: null, fetchedAt: 0 });
  const competitionsCacheRef = useRef({ data: null, fetchedAt: 0 });
  const CACHE_TTL = 60 * 1000; // 60 seconds

  // Recent items from localStorage
  const [recentItems, setRecentItems] = useState([]);

  const inputRef = useRef(null);
  const resultsRef = useRef(null);
  const navigate = useNavigate();

  // Load recent items on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('crm-recent-items');
      if (stored) {
        setRecentItems(JSON.parse(stored));
      }
    } catch (e) {
      console.error('[CommandPalette] Failed to load recent items:', e);
    }
  }, []);

  // Save recent item
  const saveRecentItem = useCallback((item) => {
    setRecentItems(prev => {
      // Remove if already exists
      const filtered = prev.filter(i => i.id !== item.id || i.type !== item.type);
      // Add to front, limit to 5
      const updated = [item, ...filtered].slice(0, 5);
      try {
        localStorage.setItem('crm-recent-items', JSON.stringify(updated));
      } catch (e) {
        console.error('[CommandPalette] Failed to save recent items:', e);
      }
      return updated;
    });
  }, []);

  // Fetch talent data (cached)
  const fetchTalent = useCallback(async () => {
    const now = Date.now();
    if (talentCacheRef.current.data && (now - talentCacheRef.current.fetchedAt) < CACHE_TTL) {
      return talentCacheRef.current.data;
    }

    try {
      const snapshot = await get(ref(db, 'talentRoster'));
      const data = snapshot.val() || {};
      const talentArray = Object.entries(data).map(([id, t]) => ({
        id,
        name: t.name || 'Unknown',
        phone: t.phone || '',
        affiliation: t.affiliation || '',
        status: t.status || 'need-info',
      }));
      talentCacheRef.current = { data: talentArray, fetchedAt: now };
      return talentArray;
    } catch (err) {
      console.error('[CommandPalette] Failed to fetch talent:', err);
      return talentCacheRef.current.data || [];
    }
  }, []);

  // Fetch competitions (from server endpoint, cached)
  const fetchCompetitions = useCallback(async () => {
    const now = Date.now();
    if (competitionsCacheRef.current.data && (now - competitionsCacheRef.current.fetchedAt) < CACHE_TTL) {
      return competitionsCacheRef.current.data;
    }

    try {
      const response = await fetch(`${SERVER_URL}/api/competitions/index`);
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      const data = await response.json();
      const competitionsArray = Object.entries(data).map(([compId, c]) => ({
        id: compId,
        name: c.eventName || compId,
        meetDate: c.meetDate || '',
      }));
      competitionsCacheRef.current = { data: competitionsArray, fetchedAt: now };
      return competitionsArray;
    } catch (err) {
      console.error('[CommandPalette] Failed to fetch competitions:', err);
      return competitionsCacheRef.current.data || [];
    }
  }, []);

  // Global keydown listener for Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opening
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
      // Fetch data when opening
      setLoading(true);
      Promise.all([fetchTalent(), fetchCompetitions()])
        .finally(() => setLoading(false));
    } else {
      // Reset state when closing
      setSearchValue('');
      setDebouncedSearch('');
      setSelectedIndex(0);
    }
  }, [open, fetchTalent, fetchCompetitions]);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [debouncedSearch]);

  // Filter results
  const talentResults = (talentCacheRef.current.data || []).filter(t => {
    if (!debouncedSearch) return false;
    const query = debouncedSearch.toLowerCase();
    return (
      t.name?.toLowerCase().includes(query) ||
      t.phone?.toLowerCase().includes(query) ||
      t.affiliation?.toLowerCase().includes(query)
    );
  }).slice(0, 5);

  const competitionResults = (competitionsCacheRef.current.data || []).filter(c => {
    if (!debouncedSearch) return false;
    const query = debouncedSearch.toLowerCase();
    return c.name?.toLowerCase().includes(query);
  }).slice(0, 5);

  // Build combined results list for keyboard navigation
  const allResults = [];
  if (debouncedSearch) {
    talentResults.forEach(t => allResults.push({ type: 'talent', item: t }));
    competitionResults.forEach(c => allResults.push({ type: 'competition', item: c }));
  } else {
    recentItems.forEach(r => allResults.push({ type: 'recent', item: r }));
  }

  // Handle keyboard navigation
  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, allResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (allResults[selectedIndex]) {
        handleSelect(allResults[selectedIndex]);
      }
    }
  }

  // Scroll selected item into view
  useEffect(() => {
    if (resultsRef.current && allResults.length > 0) {
      const selectedEl = resultsRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, allResults.length]);

  // Handle item selection
  function handleSelect(result) {
    let path, recentItem;

    if (result.type === 'talent') {
      path = `/talent/${result.item.id}`;
      recentItem = { id: result.item.id, type: 'talent', name: result.item.name };
    } else if (result.type === 'competition') {
      path = `/${result.item.id}/producer`;
      recentItem = { id: result.item.id, type: 'competition', name: result.item.name };
    } else if (result.type === 'recent') {
      // Recent items already have type info
      if (result.item.type === 'talent') {
        path = `/talent/${result.item.id}`;
      } else {
        path = `/${result.item.id}/producer`;
      }
      recentItem = result.item;
    }

    if (recentItem) {
      saveRecentItem(recentItem);
    }

    setOpen(false);
    navigate(path);
  }

  // Close on click outside
  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) {
      setOpen(false);
    }
  }

  if (!open) return null;

  const content = (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh] bg-black/60"
      onClick={handleOverlayClick}
    >
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800">
          <MagnifyingGlassIcon className="w-5 h-5 text-zinc-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search talent or competitions..."
            className="flex-1 bg-transparent text-white placeholder-zinc-500 outline-none text-sm"
          />
          {searchValue && (
            <button
              onClick={() => setSearchValue('')}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 bg-zinc-800 rounded border border-zinc-700">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="max-h-[50vh] overflow-y-auto">
          {loading && (
            <div className="px-4 py-8 text-center text-zinc-500 text-sm">
              Loading...
            </div>
          )}

          {!loading && !debouncedSearch && recentItems.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Recent
              </div>
              {recentItems.map((item, idx) => (
                <ResultRow
                  key={`recent-${item.type}-${item.id}`}
                  icon={item.type === 'talent' ? ClockIcon : CalendarIcon}
                  title={item.name}
                  subtitle={item.type === 'talent' ? 'Talent' : 'Competition'}
                  selected={selectedIndex === idx}
                  dataIndex={idx}
                  onClick={() => handleSelect({ type: 'recent', item })}
                />
              ))}
            </div>
          )}

          {!loading && !debouncedSearch && recentItems.length === 0 && (
            <div className="px-4 py-8 text-center text-zinc-500 text-sm">
              Start typing to search...
            </div>
          )}

          {!loading && debouncedSearch && talentResults.length === 0 && competitionResults.length === 0 && (
            <div className="px-4 py-8 text-center text-zinc-500 text-sm">
              No results for "{debouncedSearch}"
            </div>
          )}

          {!loading && debouncedSearch && talentResults.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Talent
              </div>
              {talentResults.map((talent, idx) => (
                <ResultRow
                  key={`talent-${talent.id}`}
                  icon={UserIcon}
                  title={talent.name}
                  subtitle={talent.affiliation || talent.phone || '—'}
                  selected={selectedIndex === idx}
                  dataIndex={idx}
                  onClick={() => handleSelect({ type: 'talent', item: talent })}
                />
              ))}
            </div>
          )}

          {!loading && debouncedSearch && competitionResults.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-1.5 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                Competitions
              </div>
              {competitionResults.map((comp, idx) => {
                const resultIdx = talentResults.length + idx;
                return (
                  <ResultRow
                    key={`comp-${comp.id}`}
                    icon={CalendarIcon}
                    title={comp.name}
                    subtitle={comp.meetDate || '—'}
                    selected={selectedIndex === resultIdx}
                    dataIndex={resultIdx}
                    onClick={() => handleSelect({ type: 'competition', item: comp })}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-zinc-800 flex items-center gap-4 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-zinc-800 rounded border border-zinc-700">↑</kbd>
            <kbd className="px-1 py-0.5 bg-zinc-800 rounded border border-zinc-700">↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-zinc-800 rounded border border-zinc-700">↵</kbd>
            select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700">esc</kbd>
            close
          </span>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

// Individual result row component
function ResultRow({ icon: Icon, title, subtitle, selected, dataIndex, onClick }) {
  return (
    <button
      data-index={dataIndex}
      onClick={onClick}
      className={`w-full text-left px-4 py-2 flex items-center gap-3 transition-colors ${
        selected ? 'bg-zinc-800' : 'hover:bg-zinc-800/50'
      }`}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${selected ? 'text-blue-400' : 'text-zinc-500'}`} />
      <div className="flex-1 min-w-0">
        <div className={`text-sm truncate ${selected ? 'text-white' : 'text-zinc-300'}`}>
          {title}
        </div>
        <div className="text-xs text-zinc-500 truncate">
          {subtitle}
        </div>
      </div>
    </button>
  );
}
