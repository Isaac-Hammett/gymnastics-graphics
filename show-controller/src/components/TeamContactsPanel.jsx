/**
 * TeamContactsPanel - Contact management panel for production checklist
 *
 * Displays team contacts with tabs for each team in the competition.
 * Supports N teams (1-7) based on competition type.
 *
 * Features:
 * - Team tabs (dynamic count)
 * - Contact list with role icons
 * - Click-to-call (tel:) and click-to-email (mailto:)
 * - Add/Edit contact functionality (modal in Task 19)
 *
 * Reference: docs/PRD-Production-Checklist/PLAN-Production-Checklist-2026-01-24.md
 */

import { useState } from 'react';
import {
  UserGroupIcon,
  PhoneIcon,
  EnvelopeIcon,
  UserIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/solid';
import {
  PlusIcon,
} from '@heroicons/react/24/outline';

/**
 * Standard contact roles
 */
export const CONTACT_ROLES = {
  'head-coach': { label: 'Head Coach', icon: '👤' },
  'assistant-coach': { label: 'Assistant Coach', icon: '👤' },
  'sid': { label: 'Sports Information Director', icon: '📋' },
  'camera-op-primary': { label: 'Camera Operator', icon: '📹' },
  'camera-op-backup': { label: 'Camera Op (Backup)', icon: '📹' },
  'venue-operations': { label: 'Venue Operations', icon: '🏟️' },
  'scoring-operations': { label: 'Scoring Operations', icon: '📊' },
};

/**
 * Get display name from team key
 */
function getTeamDisplayName(teamKey, teamNames) {
  // Try to find matching team name in the provided list
  if (teamNames && teamKey) {
    const keyLower = teamKey.toLowerCase();
    for (const name of teamNames) {
      // Simple match: school name matches start of team key
      const normalized = name.toLowerCase().replace(/\s+/g, '-');
      if (keyLower.startsWith(normalized)) {
        return name;
      }
    }
  }
  // Fallback: convert team key to display name
  return teamKey
    ? teamKey
        .replace(/-mens$/, '')
        .replace(/-womens$/, '')
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    : 'Unknown Team';
}

/**
 * Single contact card
 */
function ContactCard({ contact, roleId, onEdit }) {
  const roleInfo = CONTACT_ROLES[roleId] || { label: roleId, icon: '👤' };

  return (
    <div className="bg-zinc-700/50 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {/* Role and name */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">{roleInfo.icon}</span>
            <span className="text-xs text-zinc-400">{roleInfo.label}</span>
          </div>
          <div className="font-medium text-white truncate">
            {contact.name || 'No name'}
          </div>
        </div>
      </div>

      {/* Contact methods */}
      <div className="mt-2 flex flex-wrap gap-2">
        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            className="inline-flex items-center gap-1.5 px-2 py-1 bg-zinc-600 hover:bg-zinc-500 rounded text-sm text-zinc-200 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <PhoneIcon className="w-3.5 h-3.5" />
            <span className="text-xs">{contact.phone}</span>
          </a>
        )}
        {contact.email && (
          <a
            href={`mailto:${contact.email}`}
            className="inline-flex items-center gap-1.5 px-2 py-1 bg-zinc-600 hover:bg-zinc-500 rounded text-sm text-zinc-200 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <EnvelopeIcon className="w-3.5 h-3.5" />
            <span className="text-xs truncate max-w-[120px]">{contact.email}</span>
          </a>
        )}
      </div>

      {/* Notes */}
      {contact.notes && (
        <div className="mt-2 text-xs text-zinc-400 italic">
          {contact.notes}
        </div>
      )}
    </div>
  );
}

/**
 * Empty state when no contacts exist for a team
 */
function EmptyContacts({ teamName, onAddContact }) {
  return (
    <div className="text-center py-6">
      <UserGroupIcon className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
      <p className="text-zinc-400 text-sm mb-3">
        No contacts for {teamName}
      </p>
      <button
        onClick={onAddContact}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded text-sm text-white transition-colors"
      >
        <PlusIcon className="w-4 h-4" />
        Add Contact
      </button>
    </div>
  );
}

/**
 * Team tab button
 */
function TeamTab({ teamKey, teamName, isActive, onClick, contactCount }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors flex items-center gap-1.5 ${
        isActive
          ? 'bg-blue-600 text-white'
          : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
      }`}
    >
      <span className="truncate max-w-[80px]">{teamName}</span>
      {contactCount > 0 && (
        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
          isActive ? 'bg-blue-500' : 'bg-zinc-600'
        }`}>
          {contactCount}
        </span>
      )}
    </button>
  );
}

/**
 * TeamContactsPanel - Main component
 *
 * @param {string[]} teamKeys - Array of team keys for the competition
 * @param {Object} contacts - Contacts data by team key: { [teamKey]: { [roleId]: contactData } }
 * @param {string[]} teamNames - Array of team display names (parallel to teamKeys)
 * @param {Function} onAddContact - Callback when user wants to add a contact (opens modal)
 * @param {Function} onEditContact - Callback when user wants to edit a contact
 * @param {boolean} collapsed - Whether panel starts collapsed
 */
export default function TeamContactsPanel({
  teamKeys = [],
  contacts = {},
  teamNames = [],
  onAddContact,
  onEditContact,
  collapsed: initialCollapsed = false
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [activeTeamKey, setActiveTeamKey] = useState(teamKeys[0] || null);

  // Get contacts for active team
  const activeTeamContacts = contacts[activeTeamKey] || {};
  const contactEntries = Object.entries(activeTeamContacts);

  // Count total contacts
  const totalContacts = Object.values(contacts).reduce(
    (sum, teamContacts) => sum + Object.keys(teamContacts || {}).length,
    0
  );

  // Get contact count per team
  const getContactCount = (teamKey) => {
    return Object.keys(contacts[teamKey] || {}).length;
  };

  // Get display name for a team key
  const getDisplayName = (teamKey, index) => {
    if (teamNames[index]) return teamNames[index];
    return getTeamDisplayName(teamKey, teamNames);
  };

  // Handle adding contact for active team
  const handleAddContact = () => {
    if (onAddContact && activeTeamKey) {
      onAddContact(activeTeamKey);
    }
  };

  // Empty state for no teams
  if (teamKeys.length === 0) {
    return (
      <div className="bg-zinc-800 rounded-xl p-4">
        <div className="flex items-center gap-2 text-zinc-400">
          <UserGroupIcon className="w-5 h-5" />
          <span className="font-medium">Team Contacts</span>
        </div>
        <div className="text-center py-4 text-zinc-500 text-sm">
          No teams configured
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <UserGroupIcon className="w-5 h-5 text-zinc-400" />
          <span className="font-medium text-white">Team Contacts</span>
          {totalContacts > 0 && (
            <span className="px-2 py-0.5 bg-zinc-700 text-zinc-300 text-xs rounded-full">
              {totalContacts}
            </span>
          )}
        </div>
        {collapsed ? (
          <ChevronDownIcon className="w-5 h-5 text-zinc-400" />
        ) : (
          <ChevronUpIcon className="w-5 h-5 text-zinc-400" />
        )}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4">
          {/* Team tabs */}
          {teamKeys.length > 1 && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {teamKeys.map((teamKey, index) => (
                <TeamTab
                  key={teamKey}
                  teamKey={teamKey}
                  teamName={getDisplayName(teamKey, index)}
                  isActive={activeTeamKey === teamKey}
                  onClick={() => setActiveTeamKey(teamKey)}
                  contactCount={getContactCount(teamKey)}
                />
              ))}
            </div>
          )}

          {/* Single team label (when only 1 team) */}
          {teamKeys.length === 1 && (
            <div className="text-sm text-zinc-400 mb-3">
              {getDisplayName(teamKeys[0], 0)}
            </div>
          )}

          {/* Contacts list */}
          {contactEntries.length > 0 ? (
            <div className="space-y-2">
              {contactEntries.map(([roleId, contact]) => (
                <ContactCard
                  key={roleId}
                  contact={contact}
                  roleId={roleId}
                  onEdit={() => onEditContact?.(activeTeamKey, roleId, contact)}
                />
              ))}

              {/* Add more button */}
              {onAddContact && (
                <button
                  onClick={handleAddContact}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-dashed border-zinc-600 hover:border-zinc-500 rounded-lg text-sm text-zinc-400 hover:text-zinc-300 transition-colors"
                >
                  <PlusIcon className="w-4 h-4" />
                  Add Contact
                </button>
              )}
            </div>
          ) : (
            <EmptyContacts
              teamName={getDisplayName(activeTeamKey, teamKeys.indexOf(activeTeamKey))}
              onAddContact={handleAddContact}
            />
          )}
        </div>
      )}
    </div>
  );
}
