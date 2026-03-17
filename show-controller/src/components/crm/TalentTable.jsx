import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStatusLabel, getStatusColor, wagMagLabel } from '../../hooks/useTalentRoster';
import { PhoneIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/solid';

/**
 * TalentTable - Sortable table view for talent roster with multi-select support.
 *
 * Columns: Checkbox, Name, Status, WAG/MAG, Role, Assignments, Available For, Last Outreach, Phone
 */
export default function TalentTable({ talents, assignmentsByTalent, loading, selectedIds, onSelectionChange }) {
  const navigate = useNavigate();
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const lastClickedIndex = useRef(null);

  // Selection helpers
  const isSelectable = !!onSelectionChange;
  const selectedSet = new Set(selectedIds || []);

  const handleSelectAll = useCallback((e) => {
    if (!onSelectionChange) return;
    if (e.target.checked) {
      // Select all currently visible/filtered talents
      onSelectionChange(sorted.map(t => t.id));
    } else {
      onSelectionChange([]);
    }
  }, [onSelectionChange]);

  const handleRowSelect = useCallback((talentId, index, e) => {
    if (!onSelectionChange) return;
    e.stopPropagation();

    const newSelection = new Set(selectedSet);

    if (e.shiftKey && lastClickedIndex.current !== null) {
      // Shift+click range select
      const start = Math.min(lastClickedIndex.current, index);
      const end = Math.max(lastClickedIndex.current, index);
      for (let i = start; i <= end; i++) {
        newSelection.add(sorted[i].id);
      }
    } else {
      // Regular click toggles the item
      if (newSelection.has(talentId)) {
        newSelection.delete(talentId);
      } else {
        newSelection.add(talentId);
      }
      lastClickedIndex.current = index;
    }

    onSelectionChange(Array.from(newSelection));
  }, [onSelectionChange, selectedSet]);

  function handleSort(column) {
    if (sortColumn === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDir('asc');
    }
  }

  // Sort talents
  const sorted = [...talents].sort((a, b) => {
    let aVal, bVal;

    switch (sortColumn) {
      case 'name':
        aVal = (a.name || '').toLowerCase();
        bVal = (b.name || '').toLowerCase();
        break;
      case 'status':
        // Sort by tier order: ready > has-contact > did-* > need-info
        aVal = statusTier(a.status);
        bVal = statusTier(b.status);
        break;
      case 'wagMag':
        aVal = a.wagMag || '';
        bVal = b.wagMag || '';
        break;
      case 'role':
        aVal = a.commentaryRole || '';
        bVal = b.commentaryRole || '';
        break;
      case 'assignments':
        aVal = assignmentsByTalent[a.id]?.assignments?.length || 0;
        bVal = assignmentsByTalent[b.id]?.assignments?.length || 0;
        break;
      case 'availableFor':
        aVal = assignmentsByTalent[a.id]?.availableFor?.length || 0;
        bVal = assignmentsByTalent[b.id]?.availableFor?.length || 0;
        break;
      case 'lastOutreach':
        aVal = assignmentsByTalent[a.id]?.lastOutreach || '';
        bVal = assignmentsByTalent[b.id]?.lastOutreach || '';
        break;
      default:
        aVal = '';
        bVal = '';
    }

    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="relative">
      {/* Loading indicator */}
      {loading && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-800 overflow-hidden">
          <div className="h-full w-1/3 bg-blue-500 animate-pulse" style={{ animation: 'pulse 1.5s ease-in-out infinite' }} />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800 z-10">
            <tr>
              {isSelectable && (
                <th className="px-3 py-3 w-[40px]">
                  <input
                    type="checkbox"
                    checked={sorted.length > 0 && selectedSet.size === sorted.length}
                    ref={(el) => {
                      if (el) el.indeterminate = selectedSet.size > 0 && selectedSet.size < sorted.length;
                    }}
                    onChange={handleSelectAll}
                    className="rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
                  />
                </th>
              )}
              <SortableHeader
                label="Name"
                column="name"
                sortColumn={sortColumn}
                sortDir={sortDir}
                onClick={handleSort}
                className="w-auto"
              />
              <SortableHeader
                label="Status"
                column="status"
                sortColumn={sortColumn}
                sortDir={sortDir}
                onClick={handleSort}
                className="w-[100px]"
              />
              <SortableHeader
                label="WAG/MAG"
                column="wagMag"
                sortColumn={sortColumn}
                sortDir={sortDir}
                onClick={handleSort}
                className="w-[80px]"
              />
              <SortableHeader
                label="Role"
                column="role"
                sortColumn={sortColumn}
                sortDir={sortDir}
                onClick={handleSort}
                className="w-[140px]"
              />
              <SortableHeader
                label="Assignments"
                column="assignments"
                sortColumn={sortColumn}
                sortDir={sortDir}
                onClick={handleSort}
                className="w-[200px]"
              />
              <SortableHeader
                label="Available For"
                column="availableFor"
                sortColumn={sortColumn}
                sortDir={sortDir}
                onClick={handleSort}
                className="w-[140px]"
              />
              <SortableHeader
                label="Last Outreach"
                column="lastOutreach"
                sortColumn={sortColumn}
                sortDir={sortDir}
                onClick={handleSort}
                className="w-[120px]"
              />
              <th className="px-3 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider w-[130px]">
                Phone
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {sorted.map((talent, index) => (
              <TalentRow
                key={talent.id}
                talent={talent}
                assignmentData={assignmentsByTalent[talent.id]}
                onClick={() => navigate(`/talent/${talent.id}`)}
                isSelectable={isSelectable}
                isSelected={selectedSet.has(talent.id)}
                onSelect={(e) => handleRowSelect(talent.id, index, e)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortableHeader({ label, column, sortColumn, sortDir, onClick, className }) {
  const isActive = sortColumn === column;
  return (
    <th
      className={`px-3 py-3 text-xs font-medium text-zinc-400 uppercase tracking-wider cursor-pointer hover:text-zinc-200 select-none ${className}`}
      onClick={() => onClick(column)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive ? (
          sortDir === 'asc' ? (
            <ChevronUpIcon className="w-3 h-3" />
          ) : (
            <ChevronDownIcon className="w-3 h-3" />
          )
        ) : (
          <span className="w-3" />
        )}
      </div>
    </th>
  );
}

function TalentRow({ talent, assignmentData, onClick, isSelectable, isSelected, onSelect }) {
  const statusBadge = getStatusColor(talent.status);
  const wm = wagMagLabel(talent.wagMag);
  const assignments = assignmentData?.assignments || [];
  const availableFor = assignmentData?.availableFor || [];
  const lastOutreach = assignmentData?.lastOutreach;
  const lastOutreachType = assignmentData?.lastOutreachType;
  const availabilityDot = assignmentData?.availabilityDot || 'gray';

  return (
    <tr
      onClick={onClick}
      className={`bg-zinc-950 hover:bg-zinc-900 cursor-pointer transition-colors ${isSelected ? 'bg-blue-950/30' : ''}`}
    >
      {/* Checkbox */}
      {isSelectable && (
        <td className="px-3 py-3">
          <input
            type="checkbox"
            checked={isSelected}
            onClick={onSelect}
            onChange={() => {}} // Controlled by onClick
            className="rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0"
          />
        </td>
      )}
      {/* Name */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-white">{talent.name}</span>
          {talent.canProduce && (
            <span className="px-1.5 py-0.5 bg-teal-800 text-teal-200 text-xs rounded">Producer</span>
          )}
        </div>
        {talent.affiliation && (
          <div className="text-xs text-zinc-500 mt-0.5">{talent.affiliation}</div>
        )}
      </td>

      {/* Status */}
      <td className="px-3 py-3">
        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusBadge}`}>
          {getStatusLabel(talent.status)}
        </span>
      </td>

      {/* WAG/MAG */}
      <td className="px-3 py-3">
        {talent.wagMag && (
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${wm.color}`}>
            {wm.label}
          </span>
        )}
      </td>

      {/* Role */}
      <td className="px-3 py-3 text-zinc-300 text-xs">
        {formatRole(talent.commentaryRole)}
      </td>

      {/* Assignments */}
      <td className="px-3 py-3">
        <AssignmentPills assignments={assignments} />
      </td>

      {/* Available For */}
      <td className="px-3 py-3">
        <AvailabilityIndicator dot={availabilityDot} availableFor={availableFor} />
      </td>

      {/* Last Outreach */}
      <td className="px-3 py-3 text-xs text-zinc-400">
        {lastOutreach ? (
          <span title={new Date(lastOutreach).toLocaleString()}>
            {timeAgo(lastOutreach)}
            {lastOutreachType && <span className="text-zinc-500"> ({lastOutreachType})</span>}
          </span>
        ) : (
          <span className="text-zinc-600">&mdash;</span>
        )}
      </td>

      {/* Phone */}
      <td className="px-3 py-3">
        {talent.phone ? (
          <a
            href={`tel:${talent.phone}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs"
          >
            <PhoneIcon className="w-3 h-3" />
            {talent.phone}
          </a>
        ) : (
          <span className="text-zinc-600">&mdash;</span>
        )}
      </td>
    </tr>
  );
}

function AssignmentPills({ assignments }) {
  if (!assignments || assignments.length === 0) {
    return <span className="text-zinc-600 text-xs">&mdash;</span>;
  }

  const visible = assignments.slice(0, 2);
  const remaining = assignments.length - 2;

  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((a, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs ${getAssignmentStatusColor(a.status)}`}
          title={`${a.compName} - ${formatRole(a.role)} (${a.status})`}
        >
          <span className="max-w-[100px] truncate">{a.compName}</span>
          <span className="text-[10px] opacity-80">{getRoleAbbrev(a.role)}</span>
          <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(a.status)}`} />
        </span>
      ))}
      {remaining > 0 && (
        <span className="px-1.5 py-0.5 text-xs text-zinc-500">+{remaining}</span>
      )}
    </div>
  );
}

function AvailabilityIndicator({ dot, availableFor }) {
  const count = availableFor?.length || 0;
  const dotColor = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    gray: 'bg-zinc-600',
  }[dot] || 'bg-zinc-600';

  if (count === 0 && dot === 'gray') {
    return <span className="text-zinc-600 text-xs">&mdash;</span>;
  }

  return (
    <div className="relative group">
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        {count > 0 && <span className="text-xs text-zinc-300">{count}</span>}
      </div>
      {availableFor && availableFor.length > 0 && (
        <div className="absolute left-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-xs z-50 w-52 hidden group-hover:block shadow-lg">
          <div className="font-semibold text-zinc-300 mb-1">Available for:</div>
          {availableFor.map((a, i) => (
            <div key={i} className="text-zinc-400">
              {a.compName} <span className="text-zinc-500">({a.source})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Helper functions ────────────────────────────────────────────────────────

function statusTier(status) {
  if (status === 'ready') return 0;
  if (status === 'has-contact') return 1;
  if (status?.startsWith('did-')) return 2;
  if (status === 'need-info') return 3;
  return 4;
}

function formatRole(role) {
  if (!role) return '';
  if (role === 'Play by Play / Lead') return 'Play by Play';
  if (role === 'Color / Analyst') return 'Analyst';
  if (role === 'Does not matter') return 'Flexible';
  return role;
}

function getRoleAbbrev(role) {
  if (!role) return '';
  if (role === 'Play by Play / Lead' || role === 'pbp') return 'PBP';
  if (role === 'Color / Analyst' || role === 'analyst') return 'ANA';
  if (role === 'Does not matter' || role === 'both') return 'ANY';
  return role.slice(0, 3).toUpperCase();
}

function getAssignmentStatusColor(status) {
  switch (status) {
    case 'confirmed':
    case 'briefed':
      return 'bg-green-900/50 text-green-300';
    case 'invited':
      return 'bg-blue-900/50 text-blue-300';
    case 'declined':
      return 'bg-red-900/50 text-red-300';
    default:
      return 'bg-zinc-800 text-zinc-400';
  }
}

function getStatusDotColor(status) {
  switch (status) {
    case 'confirmed':
      return 'bg-green-400';
    case 'briefed':
      return 'bg-green-500';
    case 'invited':
      return 'bg-blue-400';
    case 'declined':
      return 'bg-red-400';
    default:
      return 'bg-zinc-500';
  }
}

function timeAgo(isoDate) {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}
