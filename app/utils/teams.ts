import { TeamWithCost } from './statbotics';
import { TBA_API_BASE_URL, TBA_API_KEY, FANTASY_CONFIG, STATBOTICS_API_BASE_URL } from './config';
import { fetchTeamsFromFIRST } from './firstTeams';

// Add extended team interface with additional properties
interface ExtendedTeamWithCost extends TeamWithCost {
  country?: string;
  state?: string;
  rookieYear?: number;
}

/**
 * Check if TBA divisions exist
 */
async function checkIfTBADivisionsExist(eventIds: string[]): Promise<boolean> {
  console.log("Checking if TBA divisions exist...");
  
  // If the eventIds include division-specific IDs (like 'oncmp1', 'oncmp2'), 
  // we'll check if TBA has data for them
  const divisionEventIds = eventIds.filter(id => id.endsWith('1') || id.endsWith('2'));
  
  if (divisionEventIds.length === 0) {
    console.log("No division event IDs found in config");
    return false;
  }
  
  // Check the first division to see if it has teams
  try {
    const response = await fetch(`${TBA_API_BASE_URL}/event/${divisionEventIds[0]}/teams`, {
      headers: {
        'X-TBA-Auth-Key': TBA_API_KEY
      }
    });
    
    if (!response.ok) {
      console.log(`TBA API returned status ${response.status} for ${divisionEventIds[0]}`);
      return false;
    }
    
    const teams = await response.json();
    
    if (!Array.isArray(teams) || teams.length === 0) {
      console.log(`No teams found for division ${divisionEventIds[0]}`);
      return false;
    }
    
    console.log(`Found ${teams.length} teams for division ${divisionEventIds[0]}`);
    return true;
  } catch (error) {
    console.error(`Error checking TBA divisions:`, error);
    return false;
  }
}

/**
 * Fetch team information from The Blue Alliance
 */
export async function fetchTeamsFromTBA(): Promise<number[]> {
  console.log("Fetching teams from The Blue Alliance");
  const teamNumbersSet = new Set<number>();
  
  // Fetch teams from all events
  for (const eventKey of FANTASY_CONFIG.eventIds) {
    try {
      console.log(`Fetching teams for event ${eventKey}`);
      const response = await fetch(`${TBA_API_BASE_URL}/event/${eventKey}/teams`, {
        headers: {
          'X-TBA-Auth-Key': TBA_API_KEY
        }
      });
      
      if (!response.ok) {
        console.error(`Failed to fetch teams for event ${eventKey}: ${response.statusText}`);
        continue;
      }
      
      const teams = await response.json();
      console.log(`API response data for ${eventKey}: ${teams.length} teams`);
      
      if (Array.isArray(teams)) {
        teams.forEach(team => {
          if (team.team_number) {
            teamNumbersSet.add(team.team_number);
          }
        });
        console.log(`Added teams from event ${eventKey}. Total unique teams: ${teamNumbersSet.size}`);
      }
    } catch (error) {
      console.error(`Error fetching teams for event ${eventKey}:`, error);
    }
  }
  
  const teamNumbers = Array.from(teamNumbersSet);
  console.log(`Retrieved ${teamNumbers.length} total unique teams from all events`);
  return teamNumbers;
}

/**
 * Calculate cost based on EPA
 */
export function calculateTeamCost(epa: number): number {
  if (!epa || epa <= 0) {
    return 1000; // Minimum cost for teams with no data
  }

  // Statbotics EPA is on a scale of roughly 0-2000
  // Scale it down to a reasonable cost (divide by 2 to get costs in the 500-10000 range)
  const cost = Math.round(epa / 2);
  
  // Ensure cost is at least 1000
  return Math.max(cost, 1000);
}

/**
 * Fetch a single team's EPA data from Statbotics
 */
async function fetchSingleTeamEPA(teamNumber: number): Promise<ExtendedTeamWithCost | null> {
  try {
    const response = await fetch(`${STATBOTICS_API_BASE_URL}/team/${teamNumber}`);
    
    if (!response.ok) {
      console.warn(`Couldn't fetch data for team ${teamNumber}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (!data || !data.norm_epa) {
      console.warn(`No EPA data for team ${teamNumber}`);
      return null;
    }
    
    // Get the best available EPA value
    const epaValue = data.norm_epa.current || data.norm_epa.recent || data.norm_epa.mean || 0;
    const cost = calculateTeamCost(epaValue);
    
    return {
      team: teamNumber,
      name: data.name || `Team ${teamNumber}`,
      epa: epaValue,
      cost: cost,
      country: data.country,
      state: data.state,
      rookieYear: data.rookie_year
    };
  } catch (error) {
    console.error(`Error fetching EPA for team ${teamNumber}:`, error);
    return null;
  }
}

/**
 * Efficient batch fetching of team EPA data from Statbotics
 */
export async function fetchTeamsEPABatch(teamNumbers: number[]): Promise<ExtendedTeamWithCost[]> {
  console.log(`Fetching EPA data for ${teamNumbers.length} teams in efficient batches`);
  const results: ExtendedTeamWithCost[] = [];
  const batchSize = 20; // Larger batch size to improve speed (adjust as needed)
  
  // Process teams in parallel batches
  for (let i = 0; i < teamNumbers.length; i += batchSize) {
    const batchTeams = teamNumbers.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(teamNumbers.length/batchSize)}`);
    
    // Process this batch in parallel
    const promises = batchTeams.map(teamNumber => fetchSingleTeamEPA(teamNumber));
    const batchResults = await Promise.all(promises);
    
    // Filter out nulls and add valid results
    batchResults.forEach(result => {
      if (result) {
        results.push(result);
      }
    });
    
    // Add a small delay between large batches to avoid rate limiting
    if (i + batchSize < teamNumbers.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return results;
}

/**
 * Get teams for fantasy draft with real EPA data from Statbotics
 */
export async function getTeamsForFantasyDraft(): Promise<TeamWithCost[]> {
  try {
    console.log("Starting getTeamsForFantasyDraft with Statbotics EPA data");
    
    // Check if we should use TBA or FIRST API
    const divisionsExist = await checkIfTBADivisionsExist(FANTASY_CONFIG.eventIds);
    
    if (divisionsExist) {
      console.log("Using TBA API since divisions exist");
      
      // Original TBA flow
      const teamNumbers = await fetchTeamsFromTBA();
      
      if (teamNumbers.length === 0) {
        throw new Error("No teams returned from The Blue Alliance");
      }
      
      // Get EPA data from Statbotics in efficient batches
      const teamsWithEPA = await fetchTeamsEPABatch(teamNumbers);
      console.log(`Retrieved EPA data for ${teamsWithEPA.length} of ${teamNumbers.length} teams`);
      
      // Handle any teams without EPA data
      const missingTeams = teamNumbers.filter(
        teamNum => !teamsWithEPA.some(team => team.team === teamNum)
      );
      
      if (missingTeams.length > 0) {
        console.log(`${missingTeams.length} teams did not have EPA data, assigning default values`);
        
        // Create default entries for teams with missing EPA data
        const defaultTeams = missingTeams.map(teamNum => ({
          team: teamNum,
          name: `Team ${teamNum}`,
          epa: 500, // Lower default EPA value to rank them below teams with real data
          cost: 1000 // Minimum cost
        }));
        
        teamsWithEPA.push(...defaultTeams);
      }
      
      // Sort by EPA/cost (highest first)
      console.log(`Returning ${teamsWithEPA.length} total teams sorted by EPA`);
      return teamsWithEPA.sort((a, b) => (b.epa || 0) - (a.epa || 0));
    } else {
      console.log("Using FIRST API since TBA divisions don't exist yet");
      
      // FIRST API flow - extract the year and event code from FANTASY_CONFIG
      // Example: For '2025oncmp', the year is '2025' and eventCode is 'ONCMP'
      const mainEventId = FANTASY_CONFIG.eventIds.find(id => !id.endsWith('1') && !id.endsWith('2')) || '';
      const year = mainEventId.substring(0, 4);
      const eventCode = mainEventId.substring(4).toUpperCase();
      
      console.log(`Fetching from FIRST API with year=${year}, eventCode=${eventCode}`);
      try {
        return await fetchTeamsFromFIRST(year, eventCode);
      } catch (error) {
        console.error(`Error fetching from FIRST API: ${error}`);
        throw new Error("Failed to fetch teams from FIRST API");
      }
    }
  } catch (error) {
    console.error('Error getting teams for fantasy draft:', error);
    return [];
  }
} 