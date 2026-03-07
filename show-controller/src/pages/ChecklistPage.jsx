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

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
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
} from '@heroicons/react/24/outline';
import { useCompetition } from '../context/CompetitionContext';
import { useProductionChecklist } from '../hooks/useProductionChecklist';

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
function ChecklistCategory({ category, expanded, onToggle, onItemToggle }) {
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
function ChecklistItem({ item, onToggle }) {
  const isManual = item.type === 'manual';
  const isClickable = isManual;

  return (
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
  );
}

/**
 * Main ChecklistPage component
 */
export default function ChecklistPage() {
  const { compId, competitionConfig } = useCompetition();
  const {
    phases,
    summary,
    toggleItem,
    loading,
    lastUpdated,
  } = useProductionChecklist();

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
      // Toast will be added in Task 8
      console.error('Failed to toggle item:', error);
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
      <main className="max-w-5xl mx-auto px-6 py-6">
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

            {/* Categories for active phase */}
            <div className="space-y-4">
              {activePhase?.categories.map(category => (
                <ChecklistCategory
                  key={category.id}
                  category={category}
                  expanded={expandedCategories.has(category.id)}
                  onToggle={() => toggleCategory(category.id)}
                  onItemToggle={handleItemToggle}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
