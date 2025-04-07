// Global configuration variables that can be switched between different events
// 
// HOW TO SWITCH BETWEEN CONFIGURATIONS:
// 1. To use Ontario Provincial Championship: Set ACTIVE_CONFIG to ONTARIO_PROVINCIALS_CONFIG
// 2. To use FIRST Championship (Worlds): Set ACTIVE_CONFIG to WORLDS_CONFIG
// 3. After changing the configuration, run the admin API to cache teams:
//    curl -X POST http://localhost:3000/api/admin/cache-divisions
//
// You can also toggle between configurations directly in this file by changing the ACTIVE_CONFIG line.

import { fetchTeamsFromFIRST } from './firstTeams';

// Event configuration for 2025 FIRST Championship - Houston
export const WORLDS_CONFIG = {
  eventIds: [
    // '2024arc'
    // '2024cur'
    // '2024dal'
    // '2024gal'
    // '2024hop'
    // '2024joh'
    // '2024mil'
    // '2024new'
    '2025cmptx' // FIRST Championship (overall)
  ],
  eventName: '2025 FIRST Championship - Houston',
  eventDates: 'April 16th to April 19th, 2025',
  eventLocation: 'Houston, TX, USA',
  competitionStartTime: new Date('2025-04-16T08:00:00-05:00').getTime(),
  budget: 75000,
  maxTeams: 10,
  // Function to check if editing is allowed (before competition starts)
  isEditingAllowed: function() {
    return Date.now() < this.competitionStartTime;
  }
};

// Event configuration for 2025 Ontario Provincial Championship
export const ONTARIO_PROVINCIALS_CONFIG = {
  eventIds: [
    // '2025oncmp',   // Main event
    '2025oncmp1',  // Science Division
    '2025oncmp2'   // Technology Division
  ],
  eventName: '2025 Ontario Provincial Championship',
  eventDates: 'April 3rd to April 5th, 2025',
  eventLocation: 'Mississauga, ON, Canada',
  competitionStartTime: new Date('2025-04-03T12:00:00-04:00').getTime(),
  budget: 40000,
  maxTeams: 6,
  // Function to check if editing is allowed (before competition starts)
  isEditingAllowed: function() {
    return Date.now() < this.competitionStartTime;
  }
};

// Toggle between configurations by changing this line
// Set to either WORLDS_CONFIG or ONTARIO_PROVINCIALS_CONFIG
export const ACTIVE_CONFIG = WORLDS_CONFIG;

// Mapping of event keys to readable names
export const EVENT_NAME_MAP: Record<string, string> = {
  // Worlds divisions
  // '2025cmptx': 'Championship',
  
  // Ontario Provincial Championship divisions
  '2025oncmp1': 'Division 1',
  '2025oncmp2': 'Division 2'
}; 