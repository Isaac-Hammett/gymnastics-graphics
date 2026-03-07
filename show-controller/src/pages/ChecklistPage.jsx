/**
 * ChecklistPage - Production Checklist for Competition
 *
 * Main page for the production checklist system. Shows all pre-flight items
 * a producer must complete before going live, grouped by phase and category.
 *
 * Features:
 * - Progress bar showing overall completion
 * - Phase tabs (Setup, Pre-Prod, 2hr Before, 1hr Before)
 * - Collapsible categories
 * - Auto-validated items (show system state)
 * - Manual items (checkboxes)
 * - Skeleton loading states
 *
 * Reference: docs/PRD-Production-Checklist/PRD-Production-Checklist-2026-01-24.md
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  XMarkIcon,
} from '@heroicons/react/24/solid';
import {
  ArrowLeftIcon,
  ChatBubbleLeftEllipsisIcon,
  SparklesIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { useCompetition } from '../context/CompetitionContext';
import { useProductionChecklist } from '../hooks/useProductionChecklist';
import TeamContactsPanel from '../components/TeamContactsPanel';

/**
 * Status icon component for checklist items
 */
function StatusIcon({ status, className = '' }) {
  const iconClass = `w-5 h-5 ${className}`;

  switch (status) {
    case 'complete':
      return <CheckCircleIcon className={`${iconClass} text-green-500`} />;
    case 'warning':
      return <ExclamationTriangleIcon className={`${iconClass} text-amber-500`} />;
    case 'error':
      return <XCircleIcon className={`${iconClass} text-red-500`} />;
    case 'checking':
      return <ArrowPathIcon className={`${iconClass} text-zinc-500 animate-spin`} />;
    default:
      return <div className={`${iconClass} rounded-full border-2 border-zinc-500`} />;
  }
}

/**
 * Skeleton loading component for checklist items
 */
function ChecklistSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Progress bar skeleton */}
      <div className="bg-zinc-800 rounded-lg p-4">
        <div className="h-4 bg-zinc-700 rounded w-1/3 mb-3" />
        <div className="h-3 bg-zinc-700 rounded-full w-full mb-2" />
        <div className="flex gap-4">
          <div className="h-3 bg-zinc-700 rounded w-24" />
          <div className="h-3 bg-zinc-700 rounded w-24" />
          <div className="h-3 bg-zinc-700 rounded w-24" />
        </div>
      </div>

      {/* Phase tabs skeleton */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-10 bg-zinc-700 rounded-lg w-28" />
        ))}
      </div>

      {/* Category skeletons */}
      {[1, 2, 3].map(i => (
        <div key={i} className="bg-zinc-800 rounded-lg p-4">
          <div className="h-5 bg-zinc-700 rounded w-48 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map(j => (
              <div key={j} className="flex items-center gap-3">
                <div className="w-5 h-5 bg-zinc-700 rounded-full" />
                <div className="h-4 bg-zinc-700 rounded flex-1" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Progress bar component showing completion stats
 * Responsive: wraps stats on mobile
 */
function ChecklistProgress({ summary }) {
  const { total, complete, warnings, errors, pending, percentage } = summary;

  return (
    <div className="bg-zinc-800 rounded-lg p-3 sm:p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-base sm:text-lg font-semibold text-white">
          {percentage}% Complete
        </span>
        <span className="text-xs sm:text-sm text-zinc-400">
          {complete}/{total} items
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2.5 sm:h-3 bg-zinc-700 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-green-500 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Stats row - wraps on mobile */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm">
        <span className="flex items-center gap-1.5">
          <CheckCircleIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
          <span className="text-zinc-300">{complete} complete</span>
        </span>
        {warnings > 0 && (
          <span className="flex items-center gap-1.5">
            <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span className="text-zinc-300">{warnings} warnings</span>
          </span>
        )}
        {errors > 0 && (
          <span className="flex items-center gap-1.5">
            <XCircleIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
            <span className="text-zinc-300">{errors} errors</span>
          </span>
        )}
        {pending > 0 && (
          <span className="flex items-center gap-1.5">
            <ClockIcon className="w-4 h-4 text-zinc-500 flex-shrink-0" />
            <span className="text-zinc-300">{pending} pending</span>
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Phase tab component
 * Touch target: min 44x44px via min-h-[44px] and adequate padding
 */
function PhaseTab({ phase, isActive, onClick, itemCounts }) {
  // Calculate phase completion status
  const { complete, total } = itemCounts;
  const percentage = total > 0 ? Math.round((complete / total) * 100) : 0;

  let statusIndicator;
  if (percentage === 100) {
    statusIndicator = <span className="text-green-500" aria-hidden="true">✓</span>;
  } else if (percentage > 0) {
    statusIndicator = <span className="text-amber-500" aria-hidden="true">◐</span>;
  } else {
    statusIndicator = <span className="text-zinc-500" aria-hidden="true">○</span>;
  }

  // Screen reader text for completion status
  const srStatus = percentage === 100 ? 'complete' : percentage > 0 ? 'in progress' : 'not started';

  return (
    <button
      onClick={onClick}
      aria-pressed={isActive}
      aria-label={`${phase.shortName} phase, ${complete} of ${total} items complete, ${srStatus}`}
      className={`px-4 py-2 min-h-[44px] rounded-lg font-medium transition-colors flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
      }`}
    >
      {statusIndicator}
      <span className="hidden sm:inline">{phase.shortName}</span>
      {/* Shorter label for very small screens */}
      <span className="sm:hidden">{phase.shortName.replace(' Before', '')}</span>
    </button>
  );
}

/**
 * Category section component (collapsible)
 * Touch target: min 44x44px via min-h-[48px] header
 */
function ChecklistCategory({ category, expanded, onToggle, onItemToggle, onNoteChange }) {
  const completeCount = category.items.filter(i => i.status === 'complete').length;

  return (
    <div className="bg-zinc-800 rounded-lg overflow-hidden">
      {/* Category header - min 48px height for comfortable touch */}
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`category-${category.id}`}
        className="w-full flex items-center justify-between px-4 py-3 min-h-[48px] hover:bg-zinc-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset"
      >
        <div className="flex items-center gap-3">
          {expanded ? (
            <ChevronDownIcon className="w-5 h-5 text-zinc-400" />
          ) : (
            <ChevronRightIcon className="w-5 h-5 text-zinc-400" />
          )}
          <span className="font-medium text-white">{category.name}</span>
        </div>
        <span className="text-sm text-zinc-400">
          {completeCount}/{category.items.length}
        </span>
      </button>

      {/* Items list */}
      {expanded && (
        <div id={`category-${category.id}`} className="px-4 pb-3 space-y-1" role="group" aria-label={`${category.name} items`}>
          {category.items.map(item => (
            <ChecklistItem
              key={item.id}
              item={item}
              onToggle={() => onItemToggle(item.id)}
              onNoteChange={onNoteChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Individual checklist item component
 * Touch target: min 44x44px via min-h-[44px] and checkbox sizing
 */
function ChecklistItem({ item, onToggle, onNoteChange }) {
  const isManual = item.type === 'manual';
  const isClickable = isManual;
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteValue, setNoteValue] = useState(item.note || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showAutoAssistTooltip, setShowAutoAssistTooltip] = useState(false);

  // Handle keyboard events for item row (for non-checkbox clicks)
  const handleKeyDown = useCallback((e) => {
    if (isManual && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onToggle();
    }
  }, [isManual, onToggle]);

  // Handle note save
  const handleNoteSave = useCallback(async () => {
    if (noteValue === item.note) {
      setShowNoteInput(false);
      return;
    }
    setIsSaving(true);
    try {
      await onNoteChange(item.id, noteValue);
      setShowNoteInput(false);
    } catch (error) {
      toast.error('Failed to save note');
    } finally {
      setIsSaving(false);
    }
  }, [noteValue, item.note, item.id, onNoteChange]);

  // Handle key events for note input
  const handleNoteKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleNoteSave();
    } else if (e.key === 'Escape') {
      setNoteValue(item.note || '');
      setShowNoteInput(false);
    }
  }, [handleNoteSave, item.note]);

  return (
    <div className="group">
      <div
        role={isManual ? 'checkbox' : 'listitem'}
        aria-checked={isManual ? item.checked : undefined}
        aria-label={`${item.name}${item.detail ? `, ${item.detail}` : ''}${item.status === 'error' ? ', needs attention' : ''}`}
        tabIndex={isManual ? 0 : undefined}
        className={`flex items-center gap-3 py-2.5 sm:py-2 px-2 rounded min-h-[44px] ${
          isClickable ? 'hover:bg-zinc-700 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset' : ''
        }`}
        onClick={isClickable ? onToggle : undefined}
        onKeyDown={isManual ? handleKeyDown : undefined}
      >
        {/* Status icon or checkbox - larger on mobile for touch */}
        {isManual ? (
          <input
            type="checkbox"
            checked={item.checked}
            onChange={onToggle}
            onClick={e => e.stopPropagation()}
            tabIndex={-1}
            aria-hidden="true"
            className="w-6 h-6 sm:w-5 sm:h-5 rounded border-2 border-zinc-500 bg-transparent checked:bg-green-500 checked:border-green-500 cursor-pointer focus:outline-none flex-shrink-0"
          />
        ) : (
          <StatusIcon status={item.status} className="flex-shrink-0" />
        )}

        {/* Item name */}
        <span className={`flex-1 ${item.status === 'complete' ? 'text-zinc-300' : 'text-white'}`}>
          {item.name}
        </span>

        {/* Auto-assist hint - shows when related contact exists */}
        {item.autoAssistHint && (
          <div
            className="relative"
            onMouseEnter={() => setShowAutoAssistTooltip(true)}
            onMouseLeave={() => setShowAutoAssistTooltip(false)}
          >
            <SparklesIcon className="w-4 h-4 text-amber-400" />
            {showAutoAssistTooltip && (
              <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-zinc-700 rounded-lg shadow-lg text-sm whitespace-nowrap z-10">
                <div className="text-amber-400 font-medium">Contact on file</div>
                <div className="text-zinc-300">{item.autoAssistHint.contactName}</div>
                <div className="text-zinc-400 text-xs">{item.autoAssistHint.contactRole}</div>
              </div>
            )}
          </div>
        )}

        {/* Note indicator */}
        {item.note && !showNoteInput && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowNoteInput(true);
            }}
            aria-label={`Edit note: ${item.note}`}
            className="text-zinc-400 hover:text-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            title={item.note}
          >
            <ChatBubbleLeftEllipsisIcon className="w-4 h-4" />
          </button>
        )}

        {/* Add note button (visible on hover or focus) */}
        {!item.note && !showNoteInput && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowNoteInput(true);
            }}
            aria-label="Add note to this item"
            className="text-zinc-600 hover:text-zinc-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1"
          >
            + Note
          </button>
        )}

        {/* Detail text for auto-validated items */}
        {item.detail && (
          <span className="text-sm text-zinc-500">{item.detail}</span>
        )}

        {/* Fix link for failed auto items */}
        {item.type === 'auto' && item.status === 'error' && item.fixLink && (
          <Link
            to={item.fixLink}
            onClick={e => e.stopPropagation()}
            aria-label={`Fix ${item.name}`}
            className="text-sm text-blue-400 hover:text-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded px-1"
          >
            Fix
          </Link>
        )}
      </div>

      {/* Note input area */}
      {showNoteInput && (
        <div className="ml-8 sm:ml-8 ml-6 mt-1 mb-2 flex gap-2 flex-wrap sm:flex-nowrap" onClick={e => e.stopPropagation()}>
          <input
            type="text"
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
            onKeyDown={handleNoteKeyDown}
            placeholder="Add a note..."
            autoFocus
            className="flex-1 min-w-0 bg-zinc-700 border border-zinc-600 rounded px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
          />
          <div className="flex gap-2">
            <button
              onClick={handleNoteSave}
              disabled={isSaving}
              className="px-4 py-2 min-h-[40px] bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-600 rounded text-sm text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-800"
            >
              {isSaving ? '...' : 'Save'}
            </button>
            <button
              onClick={() => {
                setNoteValue(item.note || '');
                setShowNoteInput(false);
              }}
              className="px-4 py-2 min-h-[40px] bg-zinc-700 hover:bg-zinc-600 rounded text-sm text-zinc-300 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Display existing note when not editing */}
      {item.note && !showNoteInput && (
        <div
          className="ml-8 text-sm text-zinc-400 italic cursor-pointer hover:text-zinc-300"
          onClick={(e) => {
            e.stopPropagation();
            setShowNoteInput(true);
          }}
        >
          {item.note}
        </div>
      )}
    </div>
  );
}

/**
 * Mobile contacts drawer component
 * Slides in from the right on tablet/mobile
 */
function ContactsDrawer({ isOpen, onClose, children }) {
  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 z-40 transition-opacity lg:hidden ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-zinc-900 z-50 transform transition-transform lg:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Team Contacts"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
          <h2 className="text-lg font-semibold text-white">Team Contacts</h2>
          <button
            onClick={onClose}
            aria-label="Close contacts drawer"
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-400 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Drawer content */}
        <div className="p-4 overflow-y-auto h-[calc(100%-56px)]">
          {children}
        </div>
      </div>
    </>
  );
}

/**
 * Floating contacts button for mobile/tablet
 */
function ContactsFloatingButton({ onClick, contactCount }) {
  return (
    <button
      onClick={onClick}
      aria-label={`Open team contacts${contactCount > 0 ? `, ${contactCount} contacts` : ''}`}
      className="fixed bottom-6 right-6 lg:hidden z-30 flex items-center gap-2 px-4 py-3 min-h-[48px] bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
    >
      <UserGroupIcon className="w-5 h-5" />
      <span className="font-medium">Contacts</span>
      {contactCount > 0 && (
        <span className="px-2 py-0.5 bg-blue-500 text-xs rounded-full">
          {contactCount}
        </span>
      )}
    </button>
  );
}

/**
 * Main ChecklistPage component
 */
export default function ChecklistPage() {
  const { compId } = useCompetition();
  const {
    phases,
    summary,
    contacts,
    teamKeys,
    toggleItem,
    updateNote,
    updateContact,
    deleteContact,
    loading,
    lastUpdated,
    competitionConfig,
    teamCount,
  } = useProductionChecklist();

  // Build team names array for the contacts panel
  const teamNames = [];
  for (let i = 1; i <= teamCount; i++) {
    const name = competitionConfig?.[`team${i}Name`];
    if (name) {
      teamNames.push(name);
    }
  }

  // Active phase tab
  const [activePhaseId, setActivePhaseId] = useState('setup');

  // Expanded categories (all expanded by default)
  const [expandedCategories, setExpandedCategories] = useState(new Set());

  // Mobile contacts drawer state
  const [contactsDrawerOpen, setContactsDrawerOpen] = useState(false);

  // Count total contacts for the floating button badge
  const totalContacts = useMemo(() => {
    return Object.values(contacts || {}).reduce(
      (sum, teamContacts) => sum + Object.keys(teamContacts || {}).length,
      0
    );
  }, [contacts]);

  // Initialize expanded categories when phases load
  useMemo(() => {
    if (phases?.length && expandedCategories.size === 0) {
      const allCategories = new Set();
      phases.forEach(phase => {
        phase.categories.forEach(cat => {
          allCategories.add(cat.id);
        });
      });
      setExpandedCategories(allCategories);
    }
  }, [phases]);

  // Get active phase
  const activePhase = phases?.find(p => p.id === activePhaseId) || phases?.[0];

  // Calculate item counts per phase
  const phaseItemCounts = useMemo(() => {
    const counts = {};
    phases?.forEach(phase => {
      let complete = 0;
      let total = 0;
      phase.categories.forEach(cat => {
        cat.items.forEach(item => {
          total++;
          if (item.status === 'complete') complete++;
        });
      });
      counts[phase.id] = { complete, total };
    });
    return counts;
  }, [phases]);

  // Toggle category expansion
  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Handle item toggle with error handling
  const handleItemToggle = async (itemId) => {
    try {
      await toggleItem(itemId);
    } catch (error) {
      toast.error('Failed to update checklist item');
    }
  };

  // Format last updated timestamp
  const formattedLastUpdated = lastUpdated
    ? new Date(lastUpdated).toLocaleString()
    : null;

  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      {/* Header */}
      <header className="bg-zinc-800 border-b border-zinc-700 px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              to={`/${compId}/producer`}
              aria-label="Back to Producer view"
              className="text-zinc-400 hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded p-2 min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-bold">Production Checklist</h1>
              <p className="text-xs sm:text-sm text-zinc-400 truncate max-w-[200px] sm:max-w-none">
                {competitionConfig?.eventName || 'Competition'}
              </p>
            </div>
          </div>

          {formattedLastUpdated && (
            <span className="text-xs sm:text-sm text-zinc-500 hidden sm:block">
              Last updated: {formattedLastUpdated}
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {loading ? (
          <ChecklistSkeleton />
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {/* Progress bar */}
            <ChecklistProgress summary={summary} />

            {/* Phase tabs - horizontal scroll on mobile */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
              {phases?.map(phase => (
                <PhaseTab
                  key={phase.id}
                  phase={phase}
                  isActive={phase.id === activePhaseId}
                  onClick={() => setActivePhaseId(phase.id)}
                  itemCounts={phaseItemCounts[phase.id] || { complete: 0, total: 0 }}
                />
              ))}
            </div>

            {/* Two-column layout: Checklist + Contacts (desktop only) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Categories for active phase */}
              <div className="lg:col-span-2 space-y-4">
                {activePhase?.categories.map(category => (
                  <ChecklistCategory
                    key={category.id}
                    category={category}
                    expanded={expandedCategories.has(category.id)}
                    onToggle={() => toggleCategory(category.id)}
                    onItemToggle={handleItemToggle}
                    onNoteChange={updateNote}
                  />
                ))}
              </div>

              {/* Team Contacts sidebar - desktop only */}
              <div className="hidden lg:block lg:col-span-1">
                <div className="sticky top-6">
                  <TeamContactsPanel
                    teamKeys={teamKeys}
                    contacts={contacts}
                    teamNames={teamNames}
                    onUpdateContact={updateContact}
                    onDeleteContact={deleteContact}
                    collapsed={activePhaseId === 'day-of-2hr' || activePhaseId === 'day-of-1hr'}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile/Tablet: Floating contacts button */}
      {!loading && (
        <ContactsFloatingButton
          onClick={() => setContactsDrawerOpen(true)}
          contactCount={totalContacts}
        />
      )}

      {/* Mobile/Tablet: Contacts drawer */}
      <ContactsDrawer
        isOpen={contactsDrawerOpen}
        onClose={() => setContactsDrawerOpen(false)}
      >
        <TeamContactsPanel
          teamKeys={teamKeys}
          contacts={contacts}
          teamNames={teamNames}
          onUpdateContact={updateContact}
          onDeleteContact={deleteContact}
          collapsed={false}
        />
      </ContactsDrawer>
    </div>
  );
}
