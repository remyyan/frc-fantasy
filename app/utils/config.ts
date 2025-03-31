// Configuration for the FRC Fantasy application
import { ACTIVE_CONFIG } from './globals';

// TBA API
export const TBA_API_KEY = 'ZsbRGTknrkbJAl3OBXVaRh8loiP9ecki3Ag2q1DpExs7yRg9g0RVsXTY3edbMBQO';
export const TBA_API_BASE_URL = 'https://www.thebluealliance.com/api/v3';

// Statbotics API (for EPA ratings)
export const STATBOTICS_API_BASE_URL = 'https://api.statbotics.io/v3';

// Fantasy game configuration
export const FANTASY_CONFIG = {
  totalBudget: ACTIVE_CONFIG.budget, // Total budget for fantasy team
  maxTeams: ACTIVE_CONFIG.maxTeams, // Maximum number of teams per fantasy team
  eventIds: ACTIVE_CONFIG.eventIds,
  eventName: ACTIVE_CONFIG.eventName,
  eventDates: ACTIVE_CONFIG.eventDates,
  eventLocation: ACTIVE_CONFIG.eventLocation,
  
  // Timestamp for when the competition begins (teams can't be edited after this)
  competitionStartTime: ACTIVE_CONFIG.competitionStartTime,
  
  // Helper function to check if editing is allowed
  isEditingAllowed: function() {
    return Date.now() < this.competitionStartTime;
  }
}; 