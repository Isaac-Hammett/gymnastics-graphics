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
 * - Add/Edit contact modal with role selection
 *
 * Reference: docs/PRD-Production-Checklist/PLAN-Production-Checklist-2026-01-24.md
 */

import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  UserGroupIcon,
  PhoneIcon,
  EnvelopeIcon,
  UserIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
  TrashIcon,
  PencilIcon,
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
 * Contact role options for dropdown
 */
const ROLE_OPTIONS = Object.entries(CONTACT_ROLES).map(([id, { label, icon }]) => ({
  id,
  label,
  icon,
}));

/**
 * ContactEditModal - Modal for adding/editing a contact
 *
 * @param {boolean} isOpen - Whether modal is open
 * @param {Function} onClose - Close callback
 * @param {Function} onSave - Save callback: (contactId, contactData) => Promise<void>
 * @param {Function} onDelete - Delete callback: (contactId) => Promise<void>
 * @param {string} teamName - Display name of the team
 * @param {Object} existingContact - Existing contact data for editing (null for new)
 * @param {string} existingRoleId - Existing role ID for editing (null for new)
 */
function ContactEditModal({ isOpen, onClose, onSave, onDelete, teamName, existingContact, existingRoleId }) {
  const isEditing = !!existingContact;

  // Form state
  const [roleId, setRoleId] = useState(existingRoleId || '');
  const [name, setName] = useState(existingContact?.name || '');
  const [phone, setPhone] = useState(existingContact?.phone || '');
  const [email, setEmail] = useState(existingContact?.email || '');
  const [notes, setNotes] = useState(existingContact?.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset form when modal opens/closes
  const handleClose = useCallback(() => {
    setRoleId(existingRoleId || '');
    setName(existingContact?.name || '');
    setPhone(existingContact?.phone || '');
    setEmail(existingContact?.email || '');
    setNotes(existingContact?.notes || '');
    setShowDeleteConfirm(false);
    onClose();
  }, [existingContact, existingRoleId, onClose]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!roleId) {
      toast.error('Please select a role');
      return;
    }
    if (!name.trim()) {
      toast.error('Please enter a name');
      return;
    }

    setIsSaving(true);
    try {
      await onSave(roleId, {
        name: name.trim(),
        role: CONTACT_ROLES[roleId]?.label || roleId,
        phone: phone.trim() || null,
        email: email.trim() || null,
        notes: notes.trim() || null,
      });
      toast.success(isEditing ? 'Contact updated' : 'Contact added');
      handleClose();
    } catch (error) {
      toast.error('Failed to save contact');
    } finally {
      setIsSaving(false);
    }
  }, [roleId, name, phone, email, notes, isEditing, onSave, handleClose]);

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (!existingRoleId) return;

    setIsDeleting(true);
    try {
      await onDelete(existingRoleId);
      toast.success('Contact deleted');
      handleClose();
    } catch (error) {
      toast.error('Failed to delete contact');
    } finally {
      setIsDeleting(false);
    }
  }, [existingRoleId, onDelete, handleClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div
        className="bg-zinc-800 rounded-xl shadow-xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-700">
          <h3 className="text-lg font-semibold text-white">
            {isEditing ? 'Edit Contact' : 'Add Contact'}
          </h3>
          <button
            onClick={handleClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="px-4 py-4 space-y-4">
          {/* Team name display */}
          <div className="text-sm text-zinc-400">
            Team: <span className="text-zinc-200">{teamName}</span>
          </div>

          {/* Role dropdown */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Role <span className="text-red-400">*</span>
            </label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              disabled={isEditing} // Can't change role when editing
              className={`w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 ${
                isEditing ? 'opacity-60 cursor-not-allowed' : ''
              }`}
            >
              <option value="">Select a role...</option>
              {ROLE_OPTIONS.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.icon} {role.label}
                </option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Smith"
              className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="610-555-1234"
              className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jsmith@university.edu"
              className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Best reached before 3pm..."
              rows={2}
              className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-700">
          {/* Delete button (only when editing) */}
          {isEditing && !showDeleteConfirm && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors"
            >
              <TrashIcon className="w-4 h-4" />
              Delete
            </button>
          )}

          {/* Delete confirmation */}
          {isEditing && showDeleteConfirm && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">Delete?</span>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-2 py-1 bg-red-600 hover:bg-red-500 disabled:bg-zinc-600 rounded text-sm text-white transition-colors"
              >
                {isDeleting ? '...' : 'Yes'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-sm text-zinc-300 transition-colors"
              >
                No
              </button>
            </div>
          )}

          {/* Spacer when not editing */}
          {!isEditing && <div />}

          {/* Save/Cancel buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm text-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-600 rounded-lg text-sm text-white transition-colors"
            >
              {isSaving ? 'Saving...' : isEditing ? 'Save' : 'Add Contact'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
    <div className="group bg-zinc-700/50 rounded-lg p-3">
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

        {/* Edit button */}
        <button
          onClick={onEdit}
          className="p-1.5 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-600 rounded opacity-0 group-hover:opacity-100 transition-all"
          title="Edit contact"
        >
          <PencilIcon className="w-3.5 h-3.5" />
        </button>
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
 * @param {Function} onUpdateContact - Callback to save contact: (teamKey, roleId, data) => Promise<void>
 * @param {Function} onDeleteContact - Callback to delete contact: (teamKey, roleId) => Promise<void>
 * @param {boolean} collapsed - Whether panel starts collapsed
 */
export default function TeamContactsPanel({
  teamKeys = [],
  contacts = {},
  teamNames = [],
  onUpdateContact,
  onDeleteContact,
  collapsed: initialCollapsed = false
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [activeTeamKey, setActiveTeamKey] = useState(teamKeys[0] || null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null); // { roleId, data } or null for new
  const [editingTeamKey, setEditingTeamKey] = useState(null);

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

  // Open modal for adding a new contact
  const handleAddContact = useCallback(() => {
    if (activeTeamKey) {
      setEditingTeamKey(activeTeamKey);
      setEditingContact(null);
      setModalOpen(true);
    }
  }, [activeTeamKey]);

  // Open modal for editing an existing contact
  const handleEditContact = useCallback((teamKey, roleId, contact) => {
    setEditingTeamKey(teamKey);
    setEditingContact({ roleId, data: contact });
    setModalOpen(true);
  }, []);

  // Save contact (add or update)
  const handleSaveContact = useCallback(async (roleId, contactData) => {
    if (!editingTeamKey || !onUpdateContact) return;
    await onUpdateContact(editingTeamKey, roleId, contactData);
  }, [editingTeamKey, onUpdateContact]);

  // Delete contact
  const handleDeleteContactModal = useCallback(async (roleId) => {
    if (!editingTeamKey || !onDeleteContact) return;
    await onDeleteContact(editingTeamKey, roleId);
  }, [editingTeamKey, onDeleteContact]);

  // Close modal
  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    setEditingContact(null);
    setEditingTeamKey(null);
  }, []);

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
                  onEdit={() => handleEditContact(activeTeamKey, roleId, contact)}
                />
              ))}

              {/* Add more button */}
              {onUpdateContact && (
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

      {/* Contact Edit Modal */}
      <ContactEditModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveContact}
        onDelete={handleDeleteContactModal}
        teamName={getDisplayName(editingTeamKey, teamKeys.indexOf(editingTeamKey))}
        existingContact={editingContact?.data}
        existingRoleId={editingContact?.roleId}
      />
    </div>
  );
}
