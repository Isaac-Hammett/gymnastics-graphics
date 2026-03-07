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

import { useState, useMemo, useCallback } from 'react';
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
} from '@heroicons/react/24/solid';
import {
  ArrowLeftIcon,
  ChatBubbleLeftEllipsisIcon,
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
 */
function ChecklistProgress({ summary }) {
  const { total, complete, warnings, errors, pending, percentage } = summary;

  return (
    <div className="bg-zinc-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-lg font-semibold text-white">
          {percentage}% Complete
        </span>
        <span className="text-sm text-zinc-400">
          {complete}/{total} items
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-3 bg-zinc-700 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-green-500 transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="flex gap-4 text-sm">
        <span className="flex items-center gap-1.5">
          <CheckCircleIcon className="w-4 h-4 text-green-500" />
          <span className="text-zinc-300">{complete} complete</span>
        </span>
        {warnings > 0 && (
          <span className="flex items-center gap-1.5">
            <ExclamationTriangleIcon className="w-4 h-4 text-amber-500" />
            <span className="text-zinc-300">{warnings} warnings</span>
          </span>
        )}
        {errors > 0 && (
          <span className="flex items-center gap-1.5">
            <XCircleIcon className="w-4 h-4 text-red-500" />
            <span className="text-zinc-300">{errors} errors</span>
          </span>
        )}
        {pending > 0 && (
          <span className="flex items-center gap-1.5">
            <ClockIcon className="w-4 h-4 text-zinc-500" />
            <span className="text-zinc-300">{pending} pending</span>
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Phase tab component
 */
function PhaseTab({ phase, isActive, onClick, itemCounts }) {
  // Calculate phase completion status
  const { complete, total } = itemCounts;
  const percentage = total > 0 ? Math.round((complete / total) * 100) : 0;

  let statusIndicator;
  if (percentage === 100) {
    statusIndicator = <span className="text-green-500">✓</span>;
  } else if (percentage > 0) {
    statusIndicator = <span className="text-amber-500">◐</span>;
  } else {
    statusIndicator = <span className="text-zinc-500">○</span>;
  }

  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
      }`}
    >
      {statusIndicator}
      <span>{phase.shortName}</span>
    </button>
  );
}

/**
 * Category section component (collapsible)
 */
function ChecklistCategory({ category, expanded, onToggle, onItemToggle, onNoteChange }) {
  const completeCount = category.items.filter(i => i.status === 'complete').length;

  return (
    <div className="bg-zinc-800 rounded-lg overflow-hidden">
      {/* Category header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-700 transition-colors"
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
        <div className="px-4 pb-3 space-y-1">
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
 */
function ChecklistItem({ item, onToggle, onNoteChange }) {
  const isManual = item.type === 'manual';
  const isClickable = isManual;
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteValue, setNoteValue] = useState(item.note || '');
  const [isSaving, setIsSaving] = useState(false);

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
  const handleKeyDown = useCallback((e) => {
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
        className={`flex items-center gap-3 py-2 px-2 rounded ${
          isClickable ? 'hover:bg-zinc-700 cursor-pointer' : ''
        }`}
        onClick={isClickable ? onToggle : undefined}
      >
        {/* Status icon or checkbox */}
        {isManual ? (
          <input
            type="checkbox"
            checked={item.checked}
            onChange={onToggle}
            onClick={e => e.stopPropagation()}
            className="w-5 h-5 rounded border-2 border-zinc-500 bg-transparent checked:bg-green-500 checked:border-green-500 cursor-pointer"
          />
        ) : (
          <StatusIcon status={item.status} />
        )}

        {/* Item name */}
        <span className={`flex-1 ${item.status === 'complete' ? 'text-zinc-300' : 'text-white'}`}>
          {item.name}
        </span>

        {/* Note indicator */}
        {item.note && !showNoteInput && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowNoteInput(true);
            }}
            className="text-zinc-400 hover:text-zinc-300"
            title={item.note}
          >
            <ChatBubbleLeftEllipsisIcon className="w-4 h-4" />
          </button>
        )}

        {/* Add note button (visible on hover when no note) */}
        {!item.note && !showNoteInput && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowNoteInput(true);
            }}
            className="text-zinc-600 hover:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity text-sm"
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
            className="text-sm text-blue-400 hover:text-blue-300"
          >
            Fix
          </Link>
        )}
      </div>

      {/* Note input area */}
      {showNoteInput && (
        <div className="ml-8 mt-1 mb-2 flex gap-2" onClick={e => e.stopPropagation()}>
          <input
            type="text"
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a note..."
            autoFocus
            className="flex-1 bg-zinc-700 border border-zinc-600 rounded px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleNoteSave}
            disabled={isSaving}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-600 rounded text-sm text-white transition-colors"
          >
            {isSaving ? '...' : 'Save'}
          </button>
          <button
            onClick={() => {
              setNoteValue(item.note || '');
              setShowNoteInput(false);
            }}
            className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 rounded text-sm text-zinc-300 transition-colors"
          >
            Cancel
          </button>
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
      <header className="bg-zinc-800 border-b border-zinc-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to={`/${compId}/producer`}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold">Production Checklist</h1>
              <p className="text-sm text-zinc-400">
                {competitionConfig?.eventName || 'Competition'}
              </p>
            </div>
          </div>

          {formattedLastUpdated && (
            <span className="text-sm text-zinc-500">
              Last updated: {formattedLastUpdated}
            </span>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <ChecklistSkeleton />
        ) : (
          <div className="space-y-6">
            {/* Progress bar */}
            <ChecklistProgress summary={summary} />

            {/* Phase tabs */}
            <div className="flex gap-2 flex-wrap">
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

            {/* Two-column layout: Checklist + Contacts */}
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

              {/* Team Contacts sidebar */}
              <div className="lg:col-span-1">
                <div className="sticky top-6">
                  <TeamContactsPanel
                    teamKeys={teamKeys}
                    contacts={contacts}
                    teamNames={teamNames}
                    collapsed={activePhaseId === 'day-of-2hr' || activePhaseId === 'day-of-1hr'}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
