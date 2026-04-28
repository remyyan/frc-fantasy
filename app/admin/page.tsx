"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';
import { useEvent } from '../contexts/EventContext';
import { getAllFantasyTeams, FantasyTeam, EventConfig, getBypassEmails, setBypassEmails } from '../utils/firebase';

// ─── Blank new-event form ──────────────────────────────────────────────────
const BLANK_EVENT_FORM = {
  eventName: '',
  eventDates: '',
  eventLocation: '',
  eventIdsRaw: '',        // comma-separated TBA keys
  divisionNamesRaw: '',   // JSON object string or empty
  competitionStartDate: '',
  budget: '40000',
  maxTeams: '6',
};

const AdminPage = () => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fantasyTeams, setFantasyTeams] = useState<FantasyTeam[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

  // Event management state
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventForm, setEventForm] = useState(BLANK_EVENT_FORM);
  const [eventSaving, setEventSaving] = useState(false);
  const [eventMsg, setEventMsg] = useState('');
  const [eventErr, setEventErr] = useState('');
  const [activatingId, setActivatingId] = useState<string | null>(null);

  // Bypass email state
  const [bypassEmails, setBypassEmailsState] = useState<string[]>([]);
  const [bypassEmailsLoading, setBypassEmailsLoading] = useState(true);
  const [newBypassEmail, setNewBypassEmail] = useState('');
  const [bypassMsg, setBypassMsg] = useState('');

  const { user } = useAuth();
  const { allEvents, activeEvent, adminCreateEvent, adminSetActiveEvent, adminUpdateEvent, loading: eventsLoading } = useEvent();

  const handleUpdateEPACache = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError('');
      setMessage('');
      
      // Call the admin API endpoint
      const response = await fetch('/api/admin/update-epa', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to update EPA cache');
      }
      
      setMessage(`Successfully updated EPA cache for ${data.teamsUpdated} teams`);
    } catch (err) {
      console.error('Error updating EPA cache:', err);
      setError(err instanceof Error ? err.message : 'Failed to update EPA cache');
    } finally {
      setLoading(false);
    }
  };

  const handleCacheDivisionTeams = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError('');
      setMessage('');
      
      // Call the admin API endpoint to cache division teams
      const response = await fetch('/api/admin/cache-divisions', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to cache division teams');
      }
      
      setMessage(`Successfully cached ${data.teamsUpdated} teams across ${data.divisionsUpdated} divisions`);
    } catch (err) {
      console.error('Error caching division teams:', err);
      setError(err instanceof Error ? err.message : 'Failed to cache division teams');
    } finally {
      setLoading(false);
    }
  };

  // ── Data Migration: tag untagged teams AND leagues with a selected event ─
  const [migratingEventId, setMigratingEventId] = useState('');
  const [migrating, setMigrating] = useState(false);
  const [migrateMsg, setMigrateMsg] = useState('');

  const handleMigrateAll = async () => {
    if (!migratingEventId) { setMigrateMsg('Select an event first.'); return; }
    setMigrating(true);
    setMigrateMsg('Migrating…');
    try {
      const { getAllFantasyTeams, updateFantasyTeam, getAllLeagues, updateLeague } = await import('../utils/firebase');

      // ── Teams ──────────────────────────────────────────────────────────
      const teams = await getAllFantasyTeams();
      const untaggedTeams = teams.filter(t => !t.eventId);
      console.log(`[migrate] ${teams.length} total teams, ${untaggedTeams.length} untagged`);
      console.log(`[migrate] target eventId: ${migratingEventId}`);

      let teamSuccess = 0;
      const teamErrors: string[] = [];
      for (const t of untaggedTeams) {
        try {
          if (!t.id) { teamErrors.push(`team ${t.name ?? '?'}: missing id`); continue; }
          await updateFantasyTeam(t.id, { eventId: migratingEventId });
          console.log(`[migrate] ✓ team ${t.id} (${t.name}) → ${migratingEventId}`);
          teamSuccess++;
        } catch (e) {
          const msg = `team ${t.id} (${t.name}): ${e instanceof Error ? e.message : 'failed'}`;
          console.error(`[migrate] ✗ ${msg}`);
          teamErrors.push(msg);
        }
      }

      // ── Leagues ────────────────────────────────────────────────────────
      const leagues = await getAllLeagues();
      const untaggedLeagues = leagues.filter((l: any) => !l.eventId);
      console.log(`[migrate] ${leagues.length} total leagues, ${untaggedLeagues.length} untagged`);

      let leagueSuccess = 0;
      const leagueErrors: string[] = [];
      for (const l of untaggedLeagues) {
        try {
          if (!l.id) { leagueErrors.push(`league ${l.name ?? '?'}: missing id`); continue; }
          await updateLeague(l.id, { eventId: migratingEventId });
          console.log(`[migrate] ✓ league ${l.id} (${l.name}) → ${migratingEventId}`);
          leagueSuccess++;
        } catch (e) {
          const msg = `league ${l.id} (${l.name}): ${e instanceof Error ? e.message : 'failed'}`;
          console.error(`[migrate] ✗ ${msg}`);
          leagueErrors.push(msg);
        }
      }

      const evName = allEvents.find(e => e.id === migratingEventId)?.eventName ?? migratingEventId;
      const errSummary = [...teamErrors, ...leagueErrors];
      setMigrateMsg(
        `✅ Tagged ${teamSuccess}/${untaggedTeams.length} team(s) and ${leagueSuccess}/${untaggedLeagues.length} league(s) → "${evName}". ` +
        `(${teams.length - untaggedTeams.length} teams and ${leagues.length - untaggedLeagues.length} were already tagged.)` +
        (errSummary.length ? ` ⚠️ ${errSummary.length} error(s) — see browser console.` : '')
      );
    } catch (err) {
      console.error('[migrate] fatal error', err);
      setMigrateMsg(`Error: ${err instanceof Error ? err.message : 'Migration failed'}`);
    } finally {
      setMigrating(false);
    }
  };

  // ── Event management handlers ──────────────────────────────────────────
  const handleSaveEvent = async () => {
    setEventSaving(true);
    setEventMsg('');
    setEventErr('');
    try {
      const eventIds = eventForm.eventIdsRaw.split(',').map(s => s.trim()).filter(Boolean);
      if (!eventIds.length) throw new Error('At least one TBA event key is required');
      if (!eventForm.eventName) throw new Error('Event name is required');
      if (!eventForm.competitionStartDate) throw new Error('Competition start date/time is required');

      // Parse division names from the raw text: "key1:Name1, key2:Name2"
      const divisionNames: Record<string, string> = {};
      if (eventForm.divisionNamesRaw.trim()) {
        eventForm.divisionNamesRaw.split(',').forEach(pair => {
          const [k, ...rest] = pair.split(':');
          if (k && rest.length) divisionNames[k.trim()] = rest.join(':').trim();
        });
      } else {
        eventIds.forEach((id, i) => { divisionNames[id] = `Division ${i + 1}`; });
      }

      const payload = {
        eventIds,
        eventName: eventForm.eventName,
        eventDates: eventForm.eventDates,
        eventLocation: eventForm.eventLocation,
        competitionStartTime: new Date(eventForm.competitionStartDate).getTime(),
        budget: parseInt(eventForm.budget, 10),
        maxTeams: parseInt(eventForm.maxTeams, 10),
        divisionNames,
      };

      if (editingEventId) {
        await adminUpdateEvent(editingEventId, payload);
        setEventMsg('Event updated!');
      } else {
        await adminCreateEvent({ ...payload, isActive: false, isCompleted: false });
        setEventMsg('Event created! Use "Set Active" to make it the current event.');
      }
      setEventForm(BLANK_EVENT_FORM);
      setEditingEventId(null);
      setShowEventForm(false);
    } catch (err) {
      setEventErr(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setEventSaving(false);
    }
  };

  const handleSetActive = async (eventId: string) => {
    setActivatingId(eventId);
    setEventMsg('');
    setEventErr('');
    try {
      await adminSetActiveEvent(eventId);
      setEventMsg('Active event updated!');
    } catch (err) {
      setEventErr(err instanceof Error ? err.message : 'Failed to set active event');
    } finally {
      setActivatingId(null);
    }
  };

  const handleToggleCompleted = async (event: EventConfig) => {
    if (!event.id) return;
    try {
      await adminUpdateEvent(event.id, { isCompleted: !event.isCompleted });
      setEventMsg(`Event marked as ${event.isCompleted ? 'active' : 'completed'}.`);
    } catch (err) {
      setEventErr(err instanceof Error ? err.message : 'Failed to update event');
    }
  };

  // Check if user is a valid admin
  const isAdmin = user && user.email === 'remyan.yc@gmail.com';

  useEffect(() => {
    if (!user || !isAdmin) {
      setFantasyTeams([]);
      return;
    }

    setTeamsLoading(true);
    getAllFantasyTeams()
      .then((teams) => setFantasyTeams(teams))
      .catch((err) => {
        console.error('Error loading fantasy teams:', err);
        setError('Failed to load fantasy teams');
      })
      .finally(() => setTeamsLoading(false));

    // Load bypass emails
    setBypassEmailsLoading(true);
    getBypassEmails()
      .then(emails => setBypassEmailsState(emails))
      .finally(() => setBypassEmailsLoading(false));
  }, [user, isAdmin]);

  // ── Bypass email handlers ──────────────────────────────────────────────
  const handleAddBypassEmail = async () => {
    const email = newBypassEmail.trim().toLowerCase();
    if (!email || bypassEmails.includes(email)) return;
    const updated = [...bypassEmails, email];
    await setBypassEmails(updated);
    setBypassEmailsState(updated);
    setNewBypassEmail('');
    setBypassMsg(`Added ${email}`);
  };

  const handleRemoveBypassEmail = async (email: string) => {
    const updated = bypassEmails.filter(e => e !== email);
    await setBypassEmails(updated);
    setBypassEmailsState(updated);
    setBypassMsg(`Removed ${email}`);
  };

  // ── Edit event helper ──────────────────────────────────────────────────
  const handleEditEvent = (ev: EventConfig) => {
    const divisionNamesRaw = Object.entries(ev.divisionNames || {})
      .map(([k, v]) => `${k}:${v}`).join(', ');
    // Format timestamp to datetime-local string
    const d = new Date(ev.competitionStartTime);
    const pad = (n: number) => String(n).padStart(2, '0');
    const competitionStartDate = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setEventForm({
      eventName: ev.eventName,
      eventDates: ev.eventDates ?? '',
      eventLocation: ev.eventLocation ?? '',
      eventIdsRaw: ev.eventIds.join(', '),
      divisionNamesRaw,
      competitionStartDate,
      budget: String(ev.budget),
      maxTeams: String(ev.maxTeams),
    });
    setEditingEventId(ev.id!);
    setShowEventForm(true);
    setEventMsg('');
    setEventErr('');
  };
  
  // If not authenticated or not an admin, show access denied
  if (!user || !isAdmin) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Access denied. This page is for administrators only.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Admin Panel</h1>

      {/* ── Event Management Section ──────────────────────────────────── */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Event Management</h2>
          <button
            onClick={() => {
              if (showEventForm) { setShowEventForm(false); setEditingEventId(null); setEventForm(BLANK_EVENT_FORM); }
              else { setShowEventForm(true); setEditingEventId(null); setEventForm(BLANK_EVENT_FORM); }
            }}
            className="px-3 py-1.5 text-sm rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            {showEventForm ? 'Cancel' : '+ New Event'}
          </button>
        </div>

        {eventMsg && <p className="mb-3 text-green-600 text-sm">{eventMsg}</p>}
        {eventErr && <p className="mb-3 text-red-600 text-sm">{eventErr}</p>}

        {/* New event form */}
        {showEventForm && (
          <div className="border border-gray-200 rounded-lg p-4 mb-4 space-y-3 bg-gray-50">
            <h3 className="font-medium text-gray-800">{editingEventId ? 'Edit Event' : 'Create New Event'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Event Name *</label>
                <input className="w-full border rounded px-2 py-1.5 text-sm text-black" placeholder="2026 Ontario DCMP"
                  value={eventForm.eventName} onChange={e => setEventForm(f => ({...f, eventName: e.target.value}))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Event Dates</label>
                <input className="w-full border rounded px-2 py-1.5 text-sm text-black" placeholder="April 17–19, 2026"
                  value={eventForm.eventDates} onChange={e => setEventForm(f => ({...f, eventDates: e.target.value}))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                <input className="w-full border rounded px-2 py-1.5 text-sm text-black" placeholder="Niagara Falls, ON"
                  value={eventForm.eventLocation} onChange={e => setEventForm(f => ({...f, eventLocation: e.target.value}))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Competition Start (local time) *</label>
                <input type="datetime-local" className="w-full border rounded px-2 py-1.5 text-sm text-black"
                  value={eventForm.competitionStartDate} onChange={e => setEventForm(f => ({...f, competitionStartDate: e.target.value}))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">TBA Event Keys * (comma-separated)</label>
                <input className="w-full border rounded px-2 py-1.5 text-sm text-black font-mono" placeholder="2026oncmp1, 2026oncmp2"
                  value={eventForm.eventIdsRaw} onChange={e => setEventForm(f => ({...f, eventIdsRaw: e.target.value}))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Division Names (key:Name, key:Name)</label>
                <input className="w-full border rounded px-2 py-1.5 text-sm text-black font-mono" placeholder="2026oncmp1:Science Division, 2026oncmp2:Technology Division"
                  value={eventForm.divisionNamesRaw} onChange={e => setEventForm(f => ({...f, divisionNamesRaw: e.target.value}))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Budget ($)</label>
                <input type="number" className="w-full border rounded px-2 py-1.5 text-sm text-black" placeholder="40000"
                  value={eventForm.budget} onChange={e => setEventForm(f => ({...f, budget: e.target.value}))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Max Teams per Roster</label>
                <input type="number" className="w-full border rounded px-2 py-1.5 text-sm text-black" placeholder="6"
                  value={eventForm.maxTeams} onChange={e => setEventForm(f => ({...f, maxTeams: e.target.value}))} />
              </div>
            </div>
            <button onClick={handleSaveEvent} disabled={eventSaving}
              className={`mt-2 px-4 py-2 rounded-md text-white text-sm ${eventSaving ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
              {eventSaving ? 'Saving...' : 'Save Event'}
            </button>
          </div>
        )}

        {/* Existing events list */}
        {eventsLoading ? (
          <p className="text-gray-500 text-sm">Loading events…</p>
        ) : allEvents.length === 0 ? (
          <p className="text-gray-500 text-sm">No events in Firestore yet. Create one above, or the app will use the static fallback from globals.ts.</p>
        ) : (
          <div className="space-y-2">
            {allEvents.map(ev => (
              <div key={ev.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border ${ev.isActive ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white'}`}>
                <div>
                  <span className="font-medium text-gray-800">{ev.eventName}</span>
                  {ev.isActive && <span className="ml-2 text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">ACTIVE</span>}
                  {ev.isCompleted && <span className="ml-2 text-xs bg-gray-400 text-white px-2 py-0.5 rounded-full">Completed</span>}
                  <p className="text-xs text-gray-500">{ev.eventDates} · {ev.eventIds.join(', ')}</p>
                </div>
                <div className="flex gap-2 mt-2 sm:mt-0 flex-wrap">
                  {!ev.isActive && (
                    <button onClick={() => handleSetActive(ev.id!)} disabled={activatingId === ev.id}
                      className="px-3 py-1 text-xs rounded text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400">
                      {activatingId === ev.id ? 'Setting…' : 'Set Active'}
                    </button>
                  )}
                  <button onClick={() => handleEditEvent(ev)}
                    className="px-3 py-1 text-xs rounded border border-indigo-300 text-indigo-700 hover:bg-indigo-50">
                    Edit
                  </button>
                  <button onClick={() => handleToggleCompleted(ev)}
                    className="px-3 py-1 text-xs rounded border border-gray-300 text-gray-600 hover:bg-gray-100">
                    {ev.isCompleted ? 'Mark Active' : 'Mark Completed'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Data Migration Section ─────────────────────────────────────── */}
      {allEvents.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">Data Migration</h2>
          <p className="text-gray-600 mb-4 text-sm">
            Tag existing fantasy teams that don't have an event ID yet. Use this once when first setting up events to preserve past data.
            Only teams without an <code>eventId</code> will be updated.
          </p>
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Target Event</label>
              <select value={migratingEventId} onChange={e => setMigratingEventId(e.target.value)}
                className="border rounded px-3 py-1.5 text-sm text-black">
                <option value="">— select event —</option>
                {allEvents.map(ev => (
                  <option key={ev.id} value={ev.id!}>{ev.eventName}</option>
                ))}
              </select>
            </div>
            <button onClick={handleMigrateAll} disabled={migrating || !migratingEventId}
              className={`px-4 py-2 rounded-md text-white text-sm ${migrating || !migratingEventId ? 'bg-gray-400' : 'bg-orange-600 hover:bg-orange-700'}`}>
              {migrating ? 'Migrating...' : 'Tag Untagged Teams & Leagues'}
            </button>
          </div>
          {migrateMsg && <p className="mt-2 text-sm text-gray-700">{migrateMsg}</p>}
        </div>
      )}

      {/* EPA Cache Update Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">EPA Cache Management</h2>
        <p className="text-gray-600 mb-4">
          Update the EPA cache with the latest data from Statbotics.
        </p>
        <button
          onClick={handleUpdateEPACache}
          disabled={loading}
          className={`px-4 py-2 rounded-md text-white ${
            loading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? 'Updating...' : 'Update EPA Cache'}
        </button>
        
        {message && (
          <p className="mt-2 text-green-600">{message}</p>
        )}
        {error && (
          <p className="mt-2 text-red-600">{error}</p>
        )}
      </div>
      
      {/* Division Teams Cache Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Division Teams Cache</h2>
        <p className="text-gray-600 mb-4">
          Pre-cache all teams by division for faster fantasy team creation.
        </p>
        <button
          onClick={handleCacheDivisionTeams}
          disabled={loading}
          className={`px-4 py-2 rounded-md text-white ${
            loading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? 'Caching...' : 'Cache Division Teams'}
        </button>
      </div>
      
      {/* Fantasy Teams Management Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Fantasy Teams Management</h2>
        <p className="text-gray-600 mb-4">
          As an administrator, you can create and manage multiple fantasy teams.
        </p>
        <div className="flex space-x-4">
          <a
            href="/fantasy/create"
            className="px-4 py-2 rounded-md text-white bg-green-600 hover:bg-green-700"
          >
            Create New Fantasy Team
          </a>
          <a
            href="/fantasy"
            className="px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            View My Fantasy Teams
          </a>
          <a
            href="/admin/scoring"
            className="px-4 py-2 rounded-md text-white bg-purple-600 hover:bg-purple-700"
          >
            Calculate Scores
          </a>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-2">Lock Override Email List</h2>
        <p className="text-gray-600 mb-4 text-sm">
          Accounts on this list can bypass the competition start lock and create/edit teams after the event begins.
        </p>
        {bypassEmailsLoading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : (
          <>
            <ul className="mb-3 space-y-1">
              {bypassEmails.map(email => (
                <li key={email} className="flex items-center justify-between bg-gray-50 rounded px-3 py-1.5 text-sm text-gray-800">
                  <span>{email}</span>
                  <button onClick={() => handleRemoveBypassEmail(email)}
                    className="ml-4 text-red-500 hover:text-red-700 text-xs font-medium">Remove</button>
                </li>
              ))}
              {bypassEmails.length === 0 && <li className="text-gray-400 text-sm">No emails configured.</li>}
            </ul>
            <div className="flex gap-2">
              <input
                type="email"
                value={newBypassEmail}
                onChange={e => setNewBypassEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddBypassEmail()}
                placeholder="new@email.com"
                className="border rounded px-3 py-1.5 text-sm text-black flex-1"
              />
              <button onClick={handleAddBypassEmail}
                className="px-4 py-1.5 rounded-md text-white text-sm bg-indigo-600 hover:bg-indigo-700">
                Add
              </button>
            </div>
            {bypassMsg && <p className="mt-2 text-sm text-green-600">{bypassMsg}</p>}
          </>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Manage All Fantasy Teams</h2>
        <p className="text-gray-600 mb-4">
          View and edit any fantasy team on the platform.
        </p>
        {teamsLoading ? (
          <p>Loading fantasy teams...</p>
        ) : fantasyTeams.length === 0 ? (
          <p>No fantasy teams found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team Name</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {fantasyTeams.map((team) => (
                  <tr key={team.id ?? `${team.userId}-${team.name}`}>
                    <td className="px-3 py-2 text-sm text-gray-900">{team.name}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{team.userName || team.userId}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">${team.totalCost?.toLocaleString() ?? '0'}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">{team.updatedAt ? new Date(team.updatedAt).toLocaleDateString() : '—'}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">
                      <Link
                        href={`/fantasy/${team.id}/edit`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage; 