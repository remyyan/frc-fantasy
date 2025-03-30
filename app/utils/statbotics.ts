import { STATBOTICS_API_BASE_URL, TBA_API_BASE_URL, TBA_API_KEY } from './config';

export interface TeamStats {
  team: number;
  name: string;
  opr: number;
  auto?: number;
  teleop?: number;
  endgame?: number;
}

export interface TeamWithCost extends TeamStats {
  cost: number;
}

// Hardcoded OPR data for top teams as a fallback
const TOP_TEAMS_OPR: Record<number, TeamStats> = {
  // Elite Tier - Most expensive
  254: { team: 254, name: "The Cheesy Poofs", opr: 3.2, auto: 1.2, teleop: 1.5, endgame: 0.5 },
  1114: { team: 1114, name: "Simbotics", opr: 3.0, auto: 1.1, teleop: 1.4, endgame: 0.5 },
  118: { team: 118, name: "The Robonauts", opr: 2.9, auto: 1.0, teleop: 1.4, endgame: 0.5 },
  2056: { team: 2056, name: "OP Robotics", opr: 2.8, auto: 1.0, teleop: 1.3, endgame: 0.5 },
  1678: { team: 1678, name: "Citrus Circuits", opr: 2.7, auto: 0.9, teleop: 1.3, endgame: 0.5 },
  2767: { team: 2767, name: "Stryke Force", opr: 2.6, auto: 0.9, teleop: 1.2, endgame: 0.5 },
  3538: { team: 3538, name: "RoboJackets", opr: 2.5, auto: 0.9, teleop: 1.2, endgame: 0.4 },
  3847: { team: 3847, name: "Spectrum", opr: 2.4, auto: 0.8, teleop: 1.2, endgame: 0.4 },
  2910: { team: 2910, name: "Jack in the Bot", opr: 2.3, auto: 0.8, teleop: 1.1, endgame: 0.4 },
  
  // Premier Tier
  217: { team: 217, name: "ThunderChickens", opr: 2.2, auto: 0.8, teleop: 1.0, endgame: 0.4 },
  1241: { team: 1241, name: "Theory6", opr: 2.1, auto: 0.7, teleop: 1.0, endgame: 0.4 },
  27: { team: 27, name: "Team RUSH", opr: 2.0, auto: 0.7, teleop: 0.9, endgame: 0.4 },
  33: { team: 33, name: "Killer Bees", opr: 1.9, auto: 0.7, teleop: 0.9, endgame: 0.3 },
  111: { team: 111, name: "Wildstang", opr: 1.8, auto: 0.6, teleop: 0.9, endgame: 0.3 },
  195: { team: 195, name: "CyberKnights", opr: 1.7, auto: 0.6, teleop: 0.8, endgame: 0.3 },
  148: { team: 148, name: "Robowranglers", opr: 1.6, auto: 0.6, teleop: 0.8, endgame: 0.2 },
  
  // Competitive Tier
  16: { team: 16, name: "Bomb Squad", opr: 1.5, auto: 0.5, teleop: 0.7, endgame: 0.3 },
  25: { team: 25, name: "Raider Robotix", opr: 1.5, auto: 0.5, teleop: 0.7, endgame: 0.3 },
  67: { team: 67, name: "The HOT Team", opr: 1.4, auto: 0.5, teleop: 0.7, endgame: 0.2 },
  95: { team: 95, name: "The Grasshoppers", opr: 1.4, auto: 0.5, teleop: 0.7, endgame: 0.2 },
  125: { team: 125, name: "NUTRONs", opr: 1.3, auto: 0.4, teleop: 0.7, endgame: 0.2 },
  180: { team: 180, name: "S.P.A.M.", opr: 1.3, auto: 0.4, teleop: 0.7, endgame: 0.2 },
  225: { team: 225, name: "TechFire", opr: 1.3, auto: 0.4, teleop: 0.7, endgame: 0.2 },
  303: { team: 303, name: "The T.E.S.T. Team", opr: 1.2, auto: 0.4, teleop: 0.6, endgame: 0.2 },
  330: { team: 330, name: "The Beach Bots", opr: 1.2, auto: 0.4, teleop: 0.6, endgame: 0.2 },
  359: { team: 359, name: "Hawaiian Kids", opr: 1.2, auto: 0.4, teleop: 0.6, endgame: 0.2 },
  469: { team: 469, name: "Las Guerrillas", opr: 1.1, auto: 0.4, teleop: 0.5, endgame: 0.2 },
  
  // Other Notable Teams
  610: { team: 610, name: "Crescent Robotics", opr: 1.1, auto: 0.4, teleop: 0.5, endgame: 0.2 },
  971: { team: 971, name: "Spartan Robotics", opr: 1.1, auto: 0.4, teleop: 0.5, endgame: 0.2 },
  987: { team: 987, name: "HIGHROLLERS", opr: 1.0, auto: 0.3, teleop: 0.5, endgame: 0.2 },
  1023: { team: 1023, name: "Bedford Express", opr: 1.0, auto: 0.3, teleop: 0.5, endgame: 0.2 },
  1690: { team: 1690, name: "Orbit", opr: 1.0, auto: 0.3, teleop: 0.5, endgame: 0.2 },
  1730: { team: 1730, name: "Team Driven", opr: 0.9, auto: 0.3, teleop: 0.4, endgame: 0.2 },
  2168: { team: 2168, name: "Aluminum Falcons", opr: 0.9, auto: 0.3, teleop: 0.4, endgame: 0.2 },
  2337: { team: 2337, name: "EngiNERDs", opr: 0.9, auto: 0.3, teleop: 0.4, endgame: 0.2 },
  2481: { team: 2481, name: "Roboteers", opr: 0.8, auto: 0.3, teleop: 0.4, endgame: 0.1 }
};

/**
 * Fetch OPR data for a specific team from The Blue Alliance
 */
export async function fetchTeamOPR(teamNumber: number): Promise<TeamStats | null> {
  // Check for hardcoded data first
  if (TOP_TEAMS_OPR[teamNumber]) {
    console.log(`Using hardcoded data for team ${teamNumber}`);
    return TOP_TEAMS_OPR[teamNumber];
  }

  try {
    // First get team info for the name
    const teamResponse = await fetch(`${TBA_API_BASE_URL}/team/frc${teamNumber}`, {
      headers: {
        'X-TBA-Auth-Key': TBA_API_KEY
      }
    });
    
    // If we can't get the team info, return default data
    if (!teamResponse.ok) {
      console.log(`Couldn't fetch team info for ${teamNumber}, using default values`);
      return createDefaultTeamStats(teamNumber);
    }
    
    const teamData = await teamResponse.json();
    const teamName = teamData.nickname || `Team ${teamNumber}`;
    
    // Use a recent year's event data to get OPR (like 2023 championships)
    const eventKey = "2023cmptx"; // Example: 2023 Championship
    
    const oprResponse = await fetch(`${TBA_API_BASE_URL}/event/${eventKey}/oprs`, {
      headers: {
        'X-TBA-Auth-Key': TBA_API_KEY
      }
    });
    
    if (!oprResponse.ok) {
      console.log(`Couldn't fetch OPR data for ${teamNumber}, using default values`);
      return createDefaultTeamStats(teamNumber, teamName);
    }
    
    const oprData = await oprResponse.json();
    
    // Check if this team has OPR data
    if (!oprData.oprs || !oprData.oprs[`frc${teamNumber}`]) {
      console.log(`No OPR data for team ${teamNumber}, using default values`);
      return createDefaultTeamStats(teamNumber, teamName);
    }
    
    // Get OPR components if available
    const opr = oprData.oprs[`frc${teamNumber}`] || 1.5;
    const auto = oprData.auto_oprs ? oprData.auto_oprs[`frc${teamNumber}`] || 0.5 : 0.5;
    const teleop = oprData.teleop_oprs ? oprData.teleop_oprs[`frc${teamNumber}`] || 0.7 : 0.7;
    const endgame = 0.3; // TBA doesn't explicitly provide endgame OPR
    
    return {
      team: teamNumber,
      name: teamName,
      opr,
      auto,
      teleop,
      endgame
    };
  } catch (error) {
    console.error(`Error fetching OPR for team ${teamNumber}:`, error);
    return createDefaultTeamStats(teamNumber);
  }
}

/**
 * Create default team stats for a team
 */
function createDefaultTeamStats(teamNumber: number, teamName?: string): TeamStats {
  // Slightly randomize the OPR to create variations in team costs
  const baseOpr = 1.5;
  const randomFactor = Math.random() * 0.5 - 0.25; // Random value between -0.25 and 0.25
  const opr = baseOpr + randomFactor;
  
  return {
    team: teamNumber,
    name: teamName || `Team ${teamNumber}`,
    opr: opr,
    auto: opr * 0.3,
    teleop: opr * 0.5,
    endgame: opr * 0.2
  };
}

/**
 * Fetch OPR ratings for multiple teams
 */
export async function fetchTeamsOPR(teamNumbers: number[]): Promise<TeamStats[]> {
  const teamStats: TeamStats[] = [];
  
  // Process batches of teams
  const batchSize = 10;
  for (let i = 0; i < teamNumbers.length; i += batchSize) {
    const batch = teamNumbers.slice(i, i + batchSize);
    const promises = batch.map(team => fetchTeamOPR(team));
    const results = await Promise.all(promises);
    
    for (const result of results) {
      if (result) {
        teamStats.push(result);
      }
    }
    
    // Add a small delay between batches to avoid rate limiting
    if (i + batchSize < teamNumbers.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return teamStats;
}

/**
 * Calculate team cost based on OPR rating
 * Teams with higher OPR ratings will cost more
 */
export function calculateTeamCost(opr: number): number {
  // Base cost of 100
  const baseCost = 100;
  
  // Scale factor determines how much each OPR point increases cost
  // Higher OPR means higher cost
  const scaleFactor = 100;
  
  // OPR values can sometimes be negative, so use max to ensure minimum cost
  const cost = Math.max(baseCost, baseCost + opr * scaleFactor);
  
  // Round to nearest 5 for cleaner numbers
  return Math.round(cost / 5) * 5;
}

/**
 * Get teams with costs based on OPR ratings
 */
export async function getTeamsWithCosts(teamNumbers: number[]): Promise<TeamWithCost[]> {
  const teams = await fetchTeamsOPR(teamNumbers);
  
  return teams.map(team => ({
    ...team,
    cost: calculateTeamCost(team.opr || 0)
  }));
}

/**
 * Get all teams for the specified events with costs
 */
export async function getEventTeamsWithCosts(eventKeys: string[]): Promise<TeamWithCost[]> {
  try {
    // First, we need to get all team numbers from the events
    const teamNumbersSet = new Set<number>();
    
    // Try to fetch teams from TBA first
    for (const eventKey of eventKeys) {
      try {
        const response = await fetch(`${TBA_API_BASE_URL}/event/${eventKey}/teams`, {
          headers: {
            'X-TBA-Auth-Key': TBA_API_KEY
          }
        });
        
        if (!response.ok) {
          console.error(`Failed to fetch teams for event ${eventKey}: ${response.statusText}`);
          continue;
        }
        
        const data = await response.json();
        
        if (Array.isArray(data)) {
          data.forEach(team => {
            if (team.team_number) {
              teamNumbersSet.add(team.team_number);
            }
          });
        }
      } catch (err) {
        console.error(`Error processing event ${eventKey}:`, err);
      }
    }
    
    // If we couldn't get any teams from TBA, use our predefined list
    if (teamNumbersSet.size === 0) {
      console.log('Using predefined championship teams list');
      
      // Predefined list of championship teams
      const championshipTeams = [
        // Top teams (most expensive)
        254, 1114, 118, 2056, 1678, 2767, 3538, 3847, 2910, 
        // Second tier teams
        217, 1241, 27, 33, 111, 195, 148, 
        // Other competitive teams
        16, 25, 67, 95, 103, 114, 125, 133, 135, 180, 199, 225, 229, 236, 
        303, 330, 341, 359, 384, 469, 488, 610, 971, 987, 1023, 1058, 1073, 
        1323, 1619, 1690, 1730, 1796, 2168, 2337, 2481, 3015, 3255, 3310, 
        3476, 3539, 3620, 3707, 3937, 4026, 4201, 4488, 4541, 4910, 4911, 
        5406, 5442, 5499, 5804, 6986, 7498, 8033, 9181,
        // Additional teams for variety
        11, 20, 45, 48, 51, 56, 60, 66, 71, 75, 78, 88, 93, 100, 107, 115, 
        120, 121, 126, 131, 144, 151, 155, 166, 172, 174, 176, 179, 188, 
        190, 201, 203, 207, 230, 231, 234, 237, 250, 263, 269, 272, 
        279, 283, 294, 296, 302, 308, 313, 314, 316, 319, 321, 329, 332, 
        337, 339, 340, 342, 348, 353, 354, 358, 360, 365, 368, 369, 371
      ];
      
      championshipTeams.forEach(team => teamNumbersSet.add(team));
    }
    
    const teamNumbers = Array.from(teamNumbersSet);
    return getTeamsWithCosts(teamNumbers);
  } catch (error) {
    console.error('Error fetching event teams with costs:', error);
    return [];
  }
} 