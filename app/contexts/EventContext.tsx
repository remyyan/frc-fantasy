'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  EventConfig,
  getActiveEvent,
  getAllEvents,
  createEvent,
  updateEvent,
  setActiveEvent,
} from '@/app/utils/firebase';
import { ACTIVE_CONFIG, EVENT_NAME_MAP } from '@/app/utils/globals';

// ─── Build a fallback EventConfig from the static globals ──────────────────
function buildFallbackConfig(): EventConfig {
  return {
    eventIds: ACTIVE_CONFIG.eventIds,
    eventName: ACTIVE_CONFIG.eventName,
    eventDates: ACTIVE_CONFIG.eventDates,
    eventLocation: ACTIVE_CONFIG.eventLocation,
    competitionStartTime: ACTIVE_CONFIG.competitionStartTime,
    budget: ACTIVE_CONFIG.budget,
    maxTeams: ACTIVE_CONFIG.maxTeams,
    isActive: true,
    isCompleted: false,
    divisionNames: Object.fromEntries(
      ACTIVE_CONFIG.eventIds.map(id => [id, EVENT_NAME_MAP[id] || id])
    ),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ─── Context type ───────────────────────────────────────────────────────────
interface EventContextType {
  /** The currently active event config (from Firestore or fallback) */
  activeEvent: EventConfig | null;
  /** All events stored in Firestore */
  allEvents: EventConfig[];
  /** True while loading from Firestore */
  loading: boolean;
  /** Convenience: has the competition started? */
  hasCompetitionStarted: boolean;
  /** Refresh events from Firestore */
  refreshEvents: () => Promise<void>;
  /** Admin: create a new event */
  adminCreateEvent: (config: Omit<EventConfig, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  /** Admin: update an event */
  adminUpdateEvent: (eventId: string, data: Partial<EventConfig>) => Promise<void>;
  /** Admin: set the active event */
  adminSetActiveEvent: (eventId: string) => Promise<void>;
  /** Get a readable name for a TBA event key */
  getDivisionName: (eventKey: string) => string;
}

const EventContext = createContext<EventContextType>({
  activeEvent: null,
  allEvents: [],
  loading: true,
  hasCompetitionStarted: false,
  refreshEvents: async () => {},
  adminCreateEvent: async () => '',
  adminUpdateEvent: async () => {},
  adminSetActiveEvent: async () => {},
  getDivisionName: (k) => k,
});

// ─── Provider ───────────────────────────────────────────────────────────────
export function EventProvider({ children }: { children: ReactNode }) {
  const [activeEvent, setActiveEventState] = useState<EventConfig | null>(null);
  const [allEvents, setAllEvents] = useState<EventConfig[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadEvents() {
    try {
      const [active, all] = await Promise.all([getActiveEvent(), getAllEvents()]);
      if (active) {
        setActiveEventState(active);
      } else {
        // No Firestore config yet — use the static fallback so the app still works
        setActiveEventState(buildFallbackConfig());
      }
      setAllEvents(all);
    } catch (err) {
      console.error('EventContext: failed to load events, using fallback', err);
      setActiveEventState(buildFallbackConfig());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadEvents(); }, []);

  const hasCompetitionStarted = activeEvent
    ? Date.now() >= activeEvent.competitionStartTime
    : false;

  function getDivisionName(eventKey: string): string {
    return activeEvent?.divisionNames?.[eventKey]
      || EVENT_NAME_MAP[eventKey]
      || eventKey;
  }

  async function refreshEvents() {
    setLoading(true);
    await loadEvents();
  }

  async function adminCreateEvent(config: Omit<EventConfig, 'id' | 'createdAt' | 'updatedAt'>) {
    const id = await createEvent(config);
    await refreshEvents();
    return id;
  }

  async function adminUpdateEvent(eventId: string, data: Partial<EventConfig>) {
    await updateEvent(eventId, data);
    await refreshEvents();
  }

  async function adminSetActiveEvent(eventId: string) {
    await setActiveEvent(eventId);
    await refreshEvents();
  }

  return (
    <EventContext.Provider value={{
      activeEvent,
      allEvents,
      loading,
      hasCompetitionStarted,
      refreshEvents,
      adminCreateEvent,
      adminUpdateEvent,
      adminSetActiveEvent,
      getDivisionName,
    }}>
      {children}
    </EventContext.Provider>
  );
}

export const useEvent = () => useContext(EventContext);
