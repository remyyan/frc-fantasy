// Configuration for the FRC Fantasy application

// TBA API
export const TBA_API_KEY = 'ZsbRGTknrkbJAl3OBXVaRh8loiP9ecki3Ag2q1DpExs7yRg9g0RVsXTY3edbMBQO';
export const TBA_API_BASE_URL = 'https://www.thebluealliance.com/api/v3';

// Statbotics API (for EPA ratings)
export const STATBOTICS_API_BASE_URL = 'https://api.statbotics.io/v3';

// Fantasy game configuration
export const FANTASY_CONFIG = {
  totalBudget: 50000, // Total budget for fantasy team
  maxTeams: 10, // Maximum number of teams per fantasy team
  eventIds: [
    '2024arc', // Archimedes Division
    '2024cur', // Curie Division
    '2024dal', // Daly Division
    '2024gal', // Galileo Division
    '2024hop', // Hopper Division
    '2024joh', // Johnson Division
    '2024mil', // Milstein Division
    '2024new', // Newton Division
    // '2024ein', // Einstein Field
    // '2024cmptx' // FIRST Championship (overall)
  ],
  eventName: '2024 FIRST Championship - Houston',
  eventDates: 'April 17th to April 20th, 2024',
  eventLocation: 'Houston, TX, USA'
}; 