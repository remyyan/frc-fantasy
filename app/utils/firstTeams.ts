import { TeamWithCost } from './statbotics';
import { FIRST_API_BASE_URL, FIRST_API_USERNAME, FIRST_API_TOKEN } from './config';
// Import the EPA calculations from teams.ts
import { calculateTeamCost, fetchTeamsEPABatch } from './teams';

// Add extended team interface with additional properties (same as teams.ts)
interface ExtendedTeamWithCost extends TeamWithCost {
  country?: string;
  state?: string;
  rookieYear?: number;
  location?: string;
}

interface FIRSTTeam {
  teamNumber: number;
  nameShort: string;
  nameFull: string;
  city: string;
  stateProv: string;
  country: string;
  rookieYear: number;
}

/**
 * Fetch teams from the FIRST API for the Ontario Provincial Championship
 * Only used when divisions aren't available in TBA
 */
export async function fetchTeamsFromFIRST(year: string = '2025', eventCode: string = 'ONCMP'): Promise<TeamWithCost[]> {
  console.log("Fetching teams from FIRST API");
  
  try {
    // Use the FIRST API to get teams for this event
    const auth = btoa(`${FIRST_API_USERNAME}:${FIRST_API_TOKEN}`);
    const url = `${FIRST_API_BASE_URL}/${year}/teams?eventCode=${eventCode}`;
    
    console.log(`Requesting teams from FIRST API: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error(`FIRST API request failed: ${response.status} ${response.statusText}`);
      throw new Error(`FIRST API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`FIRST API returned ${data.teams?.length || 0} teams`);
    
    if (!data.teams || !Array.isArray(data.teams) || data.teams.length === 0) {
      console.warn("No teams found in FIRST API response");
      throw new Error("No teams found in FIRST API response");
    }
    
    // Get team numbers from the FIRST API response
    const teamNumbers = data.teams.map((team: FIRSTTeam) => team.teamNumber);
    console.log(`Extracted ${teamNumbers.length} team numbers from FIRST API`);
    
    // Use the same EPA calculation from teams.ts to ensure consistency
    const teamsWithEPA = await fetchTeamsEPABatch(teamNumbers);
    console.log(`Retrieved EPA data for ${teamsWithEPA.length} of ${teamNumbers.length} teams`);
    
    // Handle missing teams - add default values for any teams that don't have EPA data yet
    // We'll enhance these with data from the FIRST API
    const missingTeams = teamNumbers.filter(
      (teamNum: number) => !teamsWithEPA.some(team => team.team === teamNum)
    );
    
    if (missingTeams.length > 0) {
      console.log(`${missingTeams.length} teams did not have EPA data, assigning default values`);
      
      // Create default entries for missing teams using FIRST API data where available
      const defaultTeams = missingTeams.map((teamNum: number) => {
        // Find the corresponding FIRST team data
        const firstTeamData = data.teams.find((t: FIRSTTeam) => t.teamNumber === teamNum);
        return {
          team: teamNum,
          name: firstTeamData ? (firstTeamData.nameShort || firstTeamData.nameFull) : `Team ${teamNum}`,
          epa: 500, // Same default value as teams.ts
          cost: 1000 // Same minimum cost as teams.ts
        };
      });
      
      // Add the missing teams with default values
      teamsWithEPA.push(...defaultTeams);
    }
    
    // Enhance the existing EPA data with information from FIRST API
    const enhancedTeams = teamsWithEPA.map((team: TeamWithCost) => {
      const firstTeamData = data.teams.find((t: FIRSTTeam) => t.teamNumber === team.team);
      
      // If we found matching FIRST data, enhance the team with it
      if (firstTeamData) {
        return {
          ...team,
          name: team.name || firstTeamData.nameShort || firstTeamData.nameFull,
          country: firstTeamData.country,
          state: firstTeamData.stateProv,
          rookieYear: firstTeamData.rookieYear,
          location: `${firstTeamData.city}, ${firstTeamData.stateProv}, ${firstTeamData.country}`
        };
      }
      
      // Otherwise, return the original team data
      return team;
    });
    
    // Sort by EPA (highest first) - same as teams.ts
    return enhancedTeams.sort((a: TeamWithCost, b: TeamWithCost) => (b.epa || 0) - (a.epa || 0));
  } catch (error) {
    console.error('Error fetching teams from FIRST API:', error);
    throw error;
  }
} 