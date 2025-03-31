import { TeamWithCost } from './statbotics';
import { TBA_API_BASE_URL, TBA_API_KEY, FANTASY_CONFIG, STATBOTICS_API_BASE_URL } from './config';

// Add extended team interface with additional properties
interface ExtendedTeamWithCost extends TeamWithCost {
  country?: string;
  state?: string;
  rookieYear?: number;
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
function calculateTeamCost(epa: number): number {
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
async function fetchTeamsEPABatch(teamNumbers: number[]): Promise<ExtendedTeamWithCost[]> {
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
    
    // Fetch team numbers from TBA
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
      // These will be ranked lower than teams with real data
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
  } catch (error) {
    console.error('Error getting teams for fantasy draft:', error);
    
    // Fallback to minimum dataset if API calls fail
    const fallbackTeams = [254, 1114, 118, 2056, 1678, 2767, 3538, 3847, 2910].map(
      teamNum => ({
        team: teamNum,
        name: `Team ${teamNum}`,
        epa: 1500,
        cost: 7500
      })
    );
    
    console.log(`Returning ${fallbackTeams.length} fallback teams due to error`);
    return fallbackTeams;
  }
} 