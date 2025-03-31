import { STATBOTICS_API_BASE_URL, TBA_API_BASE_URL, TBA_API_KEY } from './config';

export interface TeamStats {
  team: number;
  name: string;
  epa?: number;
  opr?: number;
  auto?: number;
  teleop?: number;
  endgame?: number;
}

export interface TeamWithCost extends TeamStats {
  cost: number;
}

/**
 * Fetch team info (name) from The Blue Alliance
 */
async function fetchTeamInfoFromTBA(teamNumber: number): Promise<{ name: string } | null> {
  try {
    console.log(`Fetching team info from TBA for team ${teamNumber}`);
    const response = await fetch(`${TBA_API_BASE_URL}/team/frc${teamNumber}`, {
      headers: {
        'X-TBA-Auth-Key': TBA_API_KEY
      }
    });
    
    if (!response.ok) {
      console.error(`Couldn't fetch team info from TBA for ${teamNumber}: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const data = await response.json();
    if (data && data.nickname) {
      console.log(`Got team name from TBA: ${data.nickname}`);
      return { name: data.nickname };
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching team info from TBA for ${teamNumber}:`, error);
    return null;
  }
}

/**
 * Calculate the cost of a team based on EPA rating
 */
export function calculateTeamCost(epa: number): number {
  if (epa <= 0) {
    throw new Error(`Invalid EPA value: ${epa}`);
  }

  // Scale EPA to cost (100 * EPA gives values in the $1000-$8000 range)
  const cost = Math.round(epa * 100);
  
  // Ensure cost is at least 1000
  return Math.max(cost, 1000);
}

/**
 * Fetch EPA data for a specific team from Statbotics
 */
export async function fetchTeamEPA(teamNumber: number): Promise<TeamStats> {
  console.log(`Starting to fetch EPA for team ${teamNumber}`);

  // First try to get team info (name) from The Blue Alliance
  const tbaInfo = await fetchTeamInfoFromTBA(teamNumber);
  let teamName = tbaInfo?.name || `Team ${teamNumber}`;

  try {
    // Use the Statbotics v3 API endpoint for a single team
    console.log(`Fetching team from ${STATBOTICS_API_BASE_URL}/team/${teamNumber}`);
    const response = await fetch(`${STATBOTICS_API_BASE_URL}/team/${teamNumber}`);
    
    if (!response.ok) {
      throw new Error(`Couldn't fetch team ${teamNumber}: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data) {
      throw new Error(`No data found for team ${teamNumber}`);
    }
    
    // Only get EPA from Statbotics - use name from TBA
    let epa = data.epa_2024 || data.epa_2023;
    
    if (!epa) {
      console.log(`No recent EPA found for team ${teamNumber}, trying to get EPA from recent years`);
      
      // If no EPA data for current or last year, try to fetch team-year data for recent years
      const years = [2024, 2023, 2022];
      
      for (const year of years) {
        try {
          console.log(`Fetching team-year data for team ${teamNumber} in ${year}`);
          const teamYearResponse = await fetch(`${STATBOTICS_API_BASE_URL}/team_year/${teamNumber}/${year}`);
          
          if (teamYearResponse.ok) {
            const teamYearData = await teamYearResponse.json();
            if (teamYearData && teamYearData.epa !== undefined) {
              epa = teamYearData.epa;
              console.log(`Found EPA ${epa} for team ${teamNumber} in year ${year}`);
              break;
            }
          } else {
            console.log(`No team-year data for team ${teamNumber} in ${year}`);
          }
        } catch (error) {
          console.log(`Error fetching team-year data for team ${teamNumber} in ${year}:`, error);
        }
      }
    }
    
    // If we still don't have EPA data, throw an error
    if (epa === undefined) {
      throw new Error(`No EPA data found for team ${teamNumber} in recent years`);
    }
    
    return {
      team: teamNumber,
      name: teamName,
      epa: epa
    };
  } catch (error) {
    console.error(`Error fetching EPA for team ${teamNumber}:`, error);
    throw error; // Re-throw the error instead of providing fallback data
  }
}

/**
 * Fetch EPA ratings for multiple teams
 */
export async function fetchTeamsEPA(teamNumbers: number[]): Promise<TeamStats[]> {
  console.log("Starting fetchTeamsEPA with team numbers:", teamNumbers.slice(0, 5), "...");
  
  // Check if the input array is empty
  if (!teamNumbers || teamNumbers.length === 0) {
    throw new Error("No team numbers provided. Please specify at least one team number to fetch EPA data.");
  }
  
  const teamStats: TeamStats[] = [];
  const errors: {team: number, error: Error}[] = [];
  
  // Process batches of teams to avoid overwhelming the API
  const batchSize = 10;
  for (let i = 0; i < teamNumbers.length; i += batchSize) {
    const batch = teamNumbers.slice(i, i + batchSize);
    console.log(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(teamNumbers.length/batchSize)}, teams: ${batch.join(', ')}`);
    
    // For each team in batch, try to fetch from Statbotics
    const promises = batch.map(async (teamNumber) => {
      try {
        const teamData = await fetchTeamEPA(teamNumber);
        return { success: true as const, data: teamData };
      } catch (error) {
        console.error(`Error processing team ${teamNumber}:`, error);
        errors.push({ team: teamNumber, error: error as Error });
        return { success: false as const, teamNumber };
      }
    });
    
    const results = await Promise.all(promises);
    
    // Add successful results to teamStats
    for (const result of results) {
      if (result.success) {
        teamStats.push(result.data);
      }
    }
    
    // Add a small delay between batches to avoid rate limiting
    if (i + batchSize < teamNumbers.length) {
      console.log("Adding delay between batches to avoid rate limiting");
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // If we couldn't get any data at all, throw an error
  if (teamStats.length === 0) {
    const errorMessages = errors.map(e => `Team ${e.team}: ${e.error.message}`).join('; ');
    throw new Error(`Failed to fetch EPA data for any teams. Errors: ${errorMessages}`);
  }
  
  // Log about any teams we couldn't get data for
  if (errors.length > 0) {
    console.error(`Failed to fetch data for ${errors.length} teams:`, 
      errors.map(e => `Team ${e.team}: ${e.error.message}`).join('; '));
  }
  
  console.log(`fetchTeamsEPA complete, returning ${teamStats.length} teams`);
  return teamStats;
}

/**
 * Get teams with costs based on EPA ratings
 */
export async function getTeamsWithCosts(teamNumbers: number[]): Promise<TeamWithCost[]> {
  console.log(`Fetching EPA data for ${teamNumbers.length} teams`);
  const teams = await fetchTeamsEPA(teamNumbers);
  console.log(`Successfully fetched EPA data for ${teams.length} teams`);
  
  return teams.map(team => {
    if (!team.epa) {
      throw new Error(`Team ${team.team} (${team.name}) has no EPA data`);
    }
    
    const cost = calculateTeamCost(team.epa);
    console.log(`Team ${team.team} (${team.name}) - EPA: ${typeof team.epa === 'number' ? team.epa.toFixed(2) : team.epa} - Cost: $${cost}`);
    return {
      ...team,
      cost
    };
  });
} 