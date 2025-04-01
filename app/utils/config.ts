// Configuration for the FRC Fantasy application
import { ACTIVE_CONFIG } from './globals';

// TBA API
export const TBA_API_KEY = 'ZsbRGTknrkbJAl3OBXVaRh8loiP9ecki3Ag2q1DpExs7yRg9g0RVsXTY3edbMBQO';
export const TBA_API_BASE_URL = 'https://www.thebluealliance.com/api/v3';

// FIRST API Configuration
export const FIRST_API_USERNAME = 'remy123';
export const FIRST_API_TOKEN = '281aee60-8eb5-4bbf-b370-65802a8dd039';
export const FIRST_API_BASE_URL = 'https://frc-api.firstinspires.org/v3.0';

// Statbotics API (for EPA ratings)
export const STATBOTICS_API_BASE_URL = 'https://api.statbotics.io/v3';

// Fantasy game configuration
export const FANTASY_CONFIG = ACTIVE_CONFIG;

/**
 * Check if the competition has started yet
 */
export function hasCompetitionStarted(): boolean {
  return Date.now() >= FANTASY_CONFIG.competitionStartTime;
}

// API endpoints 