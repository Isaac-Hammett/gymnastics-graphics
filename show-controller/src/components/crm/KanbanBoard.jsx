import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PhoneIcon,
  CheckIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/solid';
import toast from 'react-hot-toast';
import KebabMenu from './KebabMenu';
import { STAFF_STATUS, getStaffStatusLabel, getStaffStatusColor, getRoleLabel } from '../../hooks/useCommentaryStaff';

const KANBAN_COLUMNS = [
  { status: STAFF_STATUS.ASSIGNED, label: 'Assigned' },
  { status: STAFF_STATUS.INVITED, label: 'Invited' },
  { status: STAFF_STATUS.CONFIRMED, label: 'Confirmed' },
  { status: STAFF_STATUS.BRIEFED, label: 'Briefed' },
  { status: STAFF_STATUS.DECLINED, label: 'Declined' },
];

// Forward-only status flow indices for drag validation
const STATUS_ORDER = {
  [STAFF_STATUS.ASSIGNED]: 0,
  [STAFF_STATUS.INVITED]: 1,
  [STAFF_STATUS.CONFIRMED]: 2,
  [STAFF_STATUS.BRIEFED]: 3,
};

function isValidDrop(fromStatus, toStatus) {
  if (fromStatus === toStatus) return false;
  // Cannot drag out of declined
  if (fromStatus === STAFF_STATUS.DECLINED) return false;
  // Any status → declined is always allowed
  if (toStatus === STAFF_STATUS.DECLINED) return true;
  // Cannot drag into a lower status (backward)
  const fromIdx = STATUS_ORDER[fromStatus];
  const toIdx = STATUS_ORDER[toStatus];
  if (fromIdx === undefined || toIdx === undefined) return false;
  return toIdx > fromIdx;
}

/**
 * KanbanBoard — drag-and-drop pipeline board for commentary assignments.
 */
export default function KanbanBoard({
  staffList,
  talentList,
  updateStatus,
  kebabSectionsForAssignment,
  sameDayConflictDetails,
}) {
  const [dragOverColumn, setDragOverColumn] = useState(null);
  const [draggingId, setDraggingId] = useState(null);

  // Group staff by status
  const byStatus = {};
  for (const col of KANBAN_COLUMNS) {
    byStatus[col.status] = staffList.filter(s => s.status === col.status);
  }

  function handleDragStart(e, assignment) {
    setDraggingId(assignment.talentId);
    e.dataTransfer.setData('text/plain', JSON.stringify({
      talentId: assignment.talentId,
      fromStatus: assignment.status,
    }));
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverColumn(null);
  }

  function handleDragOver(e, columnStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== columnStatus) {
      setDragOverColumn(columnStatus);
    }
  }

  function handleDragLeave(e, columnStatus) {
    // Only clear if actually leaving the column (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      if (dragOverColumn === columnStatus) {
        setDragOverColumn(null);
      }
    }
  }

  async function handleDrop(e, toStatus) {
    e.preventDefault();
    setDragOverColumn(null);

    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      const { talentId, fromStatus } = data;

      if (!isValidDrop(fromStatus, toStatus)) {
        toast.error(`Cannot move from ${getStaffStatusLabel(fromStatus)} to ${getStaffStatusLabel(toStatus)}`);
        return;
      }

      await updateStatus(talentId, toStatus);
      toast.success(`Status updated to ${getStaffStatusLabel(toStatus)}`);
    } catch (err) {
      toast.error('Failed to update status — check your connection');
    }
  }

  return (
    <div className="flex gap-3 h-full overflow-x-auto p-5">
      {KANBAN_COLUMNS.map(({ status, label }) => {
        const cards = byStatus[status] || [];
        const isOver = dragOverColumn === status;

        return (
          <div
            key={status}
            className={`flex-1 min-w-[220px] flex flex-col rounded-xl border transition-colors ${
              isOver
                ? 'bg-zinc-800/50 border-blue-500/50'
                : 'bg-zinc-900/50 border-zinc-800'
            }`}
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={(e) => handleDragLeave(e, status)}
            onDrop={(e) => handleDrop(e, status)}
          >
            {/* Column header */}
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-800">
              <span className="text-sm font-semibold text-zinc-300">{label}</span>
              <span className="px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-400 text-xs font-medium">
                {cards.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {cards.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-600 border border-dashed border-zinc-700 rounded-lg">
                  No talent in this status
                </div>
              ) : (
                cards.map((assignment) => {
                  const talent = talentList.find(t => t.id === assignment.talentId);
                  const isDragging = draggingId === assignment.talentId;

                  return (
                    <div
                      key={assignment.talentId}
                      draggable="true"
                      onDragStart={(e) => handleDragStart(e, assignment)}
                      onDragEnd={handleDragEnd}
                      className={`bg-zinc-800 rounded-lg border border-zinc-700 p-3 cursor-grab active:cursor-grabbing transition-opacity ${
                        isDragging ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <Link
                            to={`/talent/${assignment.talentId}`}
                            className="text-sm font-medium text-white hover:text-blue-300 transition-colors block truncate"
                          >
                            {talent?.name || assignment.talentId}
                          </Link>
                          <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            assignment.role === 'pbp' ? 'bg-blue-900/50 text-blue-300' :
                            assignment.role === 'analyst' ? 'bg-purple-900/50 text-purple-300' :
                            'bg-teal-900/50 text-teal-300'
                          }`}>
                            {getRoleLabel(assignment.role)}
                          </span>
                          {sameDayConflictDetails?.has(assignment.talentId) && (
                            <span className="relative group inline-flex ml-1">
                              <span className="px-1 py-0.5 bg-orange-700 text-orange-100 text-[10px] rounded flex items-center gap-0.5 cursor-default">
                                <ExclamationTriangleIcon className="w-2.5 h-2.5" /> Conflict
                              </span>
                              <div className="absolute left-0 top-full mt-1 bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-xs z-50 w-56 hidden group-hover:block shadow-lg">
                                <div className="font-semibold text-orange-300 mb-1">Same-day conflict</div>
                                {sameDayConflictDetails.get(assignment.talentId).map(c => (
                                  <div key={c.compId} className="text-zinc-300">
                                    {getStaffStatusLabel(c.status)} for {c.compName} as {getRoleLabel(c.role)}
                                  </div>
                                ))}
                              </div>
                            </span>
                          )}
                        </div>
                        <KebabMenu sections={kebabSectionsForAssignment(assignment, talent)} />
                      </div>

                      {talent?.phone && (
                        <a href={`tel:${talent.phone}`} className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1.5">
                          <PhoneIcon className="w-2.5 h-2.5" />
                          {talent.phone}
                        </a>
                      )}

                      {/* Primary action button */}
                      {status !== STAFF_STATUS.BRIEFED && status !== STAFF_STATUS.DECLINED && (
                        <button
                          onClick={() => {
                            const nextMap = {
                              [STAFF_STATUS.ASSIGNED]: STAFF_STATUS.INVITED,
                              [STAFF_STATUS.INVITED]: STAFF_STATUS.CONFIRMED,
                              [STAFF_STATUS.CONFIRMED]: STAFF_STATUS.BRIEFED,
                            };
                            const next = nextMap[status];
                            if (next) {
                              updateStatus(assignment.talentId, next)
                                .then(() => toast.success(`Status updated to ${getStaffStatusLabel(next)}`))
                                .catch(() => toast.error('Failed to update status'));
                            }
                          }}
                          className="mt-2 w-full flex items-center justify-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-500 rounded text-[11px] font-medium transition-colors"
                        >
                          <CheckIcon className="w-3 h-3" />
                          Mark {getStaffStatusLabel(
                            status === STAFF_STATUS.ASSIGNED ? STAFF_STATUS.INVITED :
                            status === STAFF_STATUS.INVITED ? STAFF_STATUS.CONFIRMED :
                            STAFF_STATUS.BRIEFED
                          )}
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
