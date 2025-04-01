import { FantasyTeam, getFantasyTeam, updateFantasyTeam } from './firebase';
import { TBA_API_BASE_URL, TBA_API_KEY, FANTASY_CONFIG, STATBOTICS_API_BASE_URL } from './config';

/**
 * Team performance data from TBA
 */
interface TeamEventPerformance {
  teamNumber: number;
  teamName?: string;
  rank?: number;
  wins?: number;
  losses?: number;
  ties?: number;
  opr?: number;
  epa?: number;  // EPA from Statbotics
  dpr?: number;
  ccwm?: number;
  eliminationStatus?: string; // "won", "finalist", "semifinalist", "quarterfinalist", "eighthfinalist"
  divisionChampion?: boolean; // Whether the team won their division
  championshipWinner?: boolean; // Whether the team won the championship finals
}

/**
 * Interface for team scoring results
 */
interface TeamScoring {
  teamNumber: number;
  teamName: string;
  totalPoints: number;
  breakdown: {
    rankingPoints: number;
    winPoints: number;
    statPoints: number;  // Renamed from oprPoints to reflect it can be OPR or EPA
    awardPoints: number;
    eliminationPoints: number;
    championshipPoints: number; // Added for championship points
  };
}

/**
 * Scoring weights for different performance metrics
 */
const SCORING_WEIGHTS = {
  // Points for qualification rankings (inverse to rank - higher ranks get more points)
  rankingInverse: 1, // Multiply by (totalTeams - rank + 1)
  
  // Match performance
  winPoints: 5,      // Points per win
  tiePoints: 2,      // Points per tie
  
  // Statistical performance - EPA only - REDUCED AS REQUESTED
  epaMultiplier: 0.075,  // Reduced from 1.0 to 0.05 (20x reduction)
  
  // Awards with index signature to allow string keys
  // Set all to 0 as requested to remove awards contribution
  awardPoints: {
    "chairmans": 0,      // Was 100
    "winner": 0,         // Was 75
    "finalist": 0,       // Was 50
    "engineering_inspiration": 0, // Was 60
    "industrial_design": 0,  // Was 40
    "quality": 0,        // Was 40
    "safety": 0,         // Was 30
    "innovation": 0,     // Was 40
    "creativity": 0,     // Was 40
    "engineering_excellence": 0,  // Was 40
    "autonomous": 0,     // Was 40
    "rookie_all_star": 0,  // Was 60
    "rookie_inspiration": 0,  // Was 40
    "gracious_professionalism": 0,  // Was 40
    "judges": 0,         // Was 30
    "default": 0         // Was 20
  } as Record<string, number>,
  
  // Elimination performance with index signature for division play
  eliminationPoints: {
    //worlds
    // "won": 300,  
    // "finalist": 225,
    // "semifinalist": 150,
    // "quarterfinalist": 75,
    // "eighthfinalist": 40

    // Provincial values
    "won": 150,  
    "finalist": 100,
    "semifinalist": 75,
    "quarterfinalist": 50,
    "eighthfinalist": 25
  } as Record<string, number>,
  
  // Championship finals (between division winners)
  championshipPoints: {
    "champion": 100,  // Additional points for winning the championship final
    "division_champion": 50  // Additional points for being a division winner
  }
};

/**
 * Fetch team event performance data from The Blue Alliance
 */
async function fetchTeamEventPerformance(teamNumber: number, eventKey: string): Promise<TeamEventPerformance | null> {
  try {
    // Basic performance data
    const performance: TeamEventPerformance = {
      teamNumber
    };

    // Fetch team status for this event (including rank, record, etc.)
    const statusResponse = await fetch(
      `${TBA_API_BASE_URL}/team/frc${teamNumber}/event/${eventKey}/status`,
      { headers: { 'X-TBA-Auth-Key': TBA_API_KEY } }
    );
    
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log(`Team ${teamNumber} status data:`, statusData);
      
      try {
        // Extract qualification data if available
        if (statusData && statusData.qual && statusData.qual.ranking) {
          // Get qualification rank
          performance.rank = statusData.qual.ranking.rank;
          
          // Get record from qualification matches
          if (statusData.qual.ranking.record) {
            performance.wins = statusData.qual.ranking.record.wins;
            performance.losses = statusData.qual.ranking.record.losses;
            performance.ties = statusData.qual.ranking.record.ties;
          }
        }
        
        // Extract playoff data if available
        if (statusData && statusData.playoff) {
          // The 'level' field indicates how far they got (qm = qualifications, ef = eighthfinals, qf = quarterfinals, sf = semifinals, f = finals)
          const playoffLevel = statusData.playoff.level;
          const playoffStatus = statusData.playoff.status;
          
          // Determine the elimination status based on level and status
          if (playoffStatus === 'won') {
            performance.eliminationStatus = 'won';
          } else if (playoffLevel === 'f') {
            // In finals but didn't win, so must be finalist
            performance.eliminationStatus = 'finalist';
          } else if (playoffLevel === 'sf') {
            performance.eliminationStatus = 'semifinalist';
          } else if (playoffLevel === 'qf') {
            performance.eliminationStatus = 'quarterfinalist';
          } else if (playoffLevel === 'ef') {
            // Handle eighthfinals - TBA specific
            performance.eliminationStatus = 'eighthfinalist';
          }
          
          // Also look at the playoff record if available
          if (statusData.playoff.record) {
            // Combine with qualification record if it exists
            performance.wins = (performance.wins || 0) + (statusData.playoff.record.wins || 0);
            performance.losses = (performance.losses || 0) + (statusData.playoff.record.losses || 0);
            performance.ties = (performance.ties || 0) + (statusData.playoff.record.ties || 0);
          }
        }
        
        // Try to get a simpler overall status from the strings
        if (!performance.eliminationStatus && statusData.playoff_status_str) {
          const playoffStr = statusData.playoff_status_str.toLowerCase();
          if (playoffStr.includes('won')) {
            performance.eliminationStatus = 'won';
          } else if (playoffStr.includes('finalist')) {
            performance.eliminationStatus = 'finalist';
          } else if (playoffStr.includes('semifinalist')) {
            performance.eliminationStatus = 'semifinalist';
          } else if (playoffStr.includes('quarterfinalist')) {
            performance.eliminationStatus = 'quarterfinalist';
          } else if (playoffStr.includes('eighth')) {
            performance.eliminationStatus = 'eighthfinalist';
          }
        }
        
        // Check if this team was a division champion and competed in championship finals
        try {
          // For Ontario Provincial Championship or similar multi-division events
          if (eventKey.includes('oncmp') || eventKey.includes('chs') || eventKey.includes('first')) {
            console.log(`Checking championship finals status for team ${teamNumber} at ${eventKey}`);
            
            // First check if this team was a division winner
            let isDivisionChampion = false;
            
            // ONLY set division champion for teams that actually won their division
            if (performance.eliminationStatus === 'won') {
              isDivisionChampion = true;
              console.log(`Team ${teamNumber} was a division champion at ${eventKey}`);
              
              // Add the division champion points
              performance.divisionChampion = true;
            }
            
            // If this is a division champion, check if they won the championship finals
            if (isDivisionChampion) {
              // We need to check alliances at the main championship event (not division)
              // This is a simplified approach - in a real system we'd query the championship event
              
              // For now, use the cached data if provided to determine championship winner
              // This will be replaced with actual API calls for the full implementation
              if (performance.eliminationStatus === 'won' && statusData.overall_status_str) {
                const overallStatus = statusData.overall_status_str.toLowerCase();
                if (overallStatus.includes('champion') || overallStatus.includes('event winner')) {
                  performance.championshipWinner = true;
                  console.log(`Team ${teamNumber} was the championship winner at ${eventKey}`);
                }
              }
            }
          }
        } catch (error) {
          console.warn(`Error checking championship status for team ${teamNumber} at ${eventKey}:`, error);
        }
        
      } catch (error) {
        console.warn(`Error parsing status data for team ${teamNumber} at event ${eventKey}:`, error);
      }
    } else {
      console.log(`Could not fetch status for team ${teamNumber} at event ${eventKey}: ${statusResponse.status}`);
    }
    
    // Fetch OPR, DPR, CCWM
    const oprResponse = await fetch(
      `${TBA_API_BASE_URL}/event/${eventKey}/oprs`,
      { headers: { 'X-TBA-Auth-Key': TBA_API_KEY } }
    );
    
    if (oprResponse.ok) {
      const oprData = await oprResponse.json();
      if (oprData && oprData.oprs) {
        // Try different possible formats for team keys
        const possibleKeys = [`frc${teamNumber}`, `${teamNumber}`, `${teamNumber.toString()}`];
        
        // Find the first key that exists in the data
        let teamKey = possibleKeys.find(key => oprData.oprs[key] !== undefined);
        
        if (teamKey) {
          performance.opr = oprData.oprs[teamKey];
          
          // Use the same key format for dpr and ccwm if they exist
          if (oprData.dprs && oprData.dprs[teamKey] !== undefined) {
            performance.dpr = oprData.dprs[teamKey];
          }
          
          if (oprData.ccwms && oprData.ccwms[teamKey] !== undefined) {
            performance.ccwm = oprData.ccwms[teamKey];
          }
        } else {
          console.warn(`Could not find OPR data for team ${teamNumber} at event ${eventKey}`);
        }
      } else {
        console.warn(`No OPR data available for event ${eventKey}`);
      }
    }
    
    // Fetch EPA data from Statbotics
    try {
      console.log(`Fetching EPA data for team ${teamNumber} from Statbotics`);
      const epaResponse = await fetch(`${STATBOTICS_API_BASE_URL}/team_event/${teamNumber}/${eventKey}`);
      
      if (epaResponse.ok) {
        const epaData = await epaResponse.json();
        if (epaData) {
          // Handle different EPA data structures
          if (typeof epaData.epa === 'number') {
            // Simple EPA as a number
            performance.epa = epaData.epa;
            console.log(`Found event-specific EPA ${epaData.epa} for team ${teamNumber} at event ${eventKey}`);
          } else if (epaData.epa && typeof epaData.epa === 'object') {
            // EPA as an object with complex structure - use unitless or norm if available
            if (epaData.epa.unitless) {
              performance.epa = epaData.epa.unitless;
              console.log(`Using EPA unitless value ${performance.epa} for team ${teamNumber}`);
            } else if (epaData.epa.norm) {
              performance.epa = epaData.epa.norm;
              console.log(`Using EPA norm value ${performance.epa} for team ${teamNumber}`);
            } else if (epaData.epa.breakdown && epaData.epa.breakdown.total_points) {
              // Fall back to total_points from breakdown
              performance.epa = epaData.epa.breakdown.total_points * 100; // Scale appropriately
              console.log(`Using EPA total_points value ${performance.epa} for team ${teamNumber}`);
            }
          } else {
            console.log(`No event-specific EPA for team ${teamNumber}, fetching overall EPA`);
            await fetchTeamOverallEPA(teamNumber, performance);
          }
        } else {
          console.log(`No event-specific EPA for team ${teamNumber}, fetching overall EPA`);
          await fetchTeamOverallEPA(teamNumber, performance);
        }
      } else {
        console.warn(`Could not fetch EPA data for team ${teamNumber} at event ${eventKey}: ${epaResponse.status}`);
        console.log(`Falling back to overall EPA for team ${teamNumber}`);
        await fetchTeamOverallEPA(teamNumber, performance);
      }
    } catch (error) {
      console.warn(`Error fetching EPA data for team ${teamNumber}:`, error);
      // Still try to get overall EPA if event-specific fetch fails
      await fetchTeamOverallEPA(teamNumber, performance);
    }
    
    // Don't fetch awards since they're no longer used in scoring
    console.log(`Final performance data for team ${teamNumber}:`, performance);
    return performance;
  } catch (error) {
    console.error(`Error fetching performance for team ${teamNumber} at event ${eventKey}:`, error);
    return null;
  }
}

/**
 * Get the number of teams at an event
 */
async function getEventTeamCount(eventKey: string): Promise<number> {
  try {
    const response = await fetch(
      `${TBA_API_BASE_URL}/event/${eventKey}/teams/keys`,
      { headers: { 'X-TBA-Auth-Key': TBA_API_KEY } }
    );
    
    if (response.ok) {
      const teamsKeys = await response.json();
      return Array.isArray(teamsKeys) ? teamsKeys.length : 0;
    }
    
    return 0;
  } catch (error) {
    console.error(`Error fetching team count for event ${eventKey}:`, error);
    return 0;
  }
}

/**
 * Calculate points for a team based on their performance
 */
function calculateTeamPoints(performance: TeamEventPerformance, totalTeams: number): TeamScoring {
  const breakdown = {
    rankingPoints: 0,
    winPoints: 0,
    statPoints: 0,
    awardPoints: 0, // This will be 0 based on our new approach
    eliminationPoints: 0,
    championshipPoints: 0 // New field for championship/division points
  };
  
  try {
    // Calculate ranking points (higher ranks get more points)
    if (performance.rank && typeof performance.rank === 'number' && performance.rank > 0) {
      breakdown.rankingPoints = (totalTeams - performance.rank + 1) * SCORING_WEIGHTS.rankingInverse;
    }
    
    // Calculate match points
    if (performance.wins && typeof performance.wins === 'number') {
      breakdown.winPoints += performance.wins * SCORING_WEIGHTS.winPoints;
    }
    if (performance.ties && typeof performance.ties === 'number') {
      breakdown.winPoints += performance.ties * SCORING_WEIGHTS.tiePoints;
    }
    
    // Calculate EPA points - with reduced multiplier
    if (performance.epa && typeof performance.epa === 'number') {
      // Use EPA only, with reduced multiplier as requested
      breakdown.statPoints = Math.round(performance.epa * SCORING_WEIGHTS.epaMultiplier);
    }
    
    // Award points are now 0 (removed from calculation)
    breakdown.awardPoints = 0;
    
    // Calculate elimination points
    if (performance.eliminationStatus && typeof performance.eliminationStatus === 'string') {
      const status = performance.eliminationStatus.toLowerCase();
      breakdown.eliminationPoints = SCORING_WEIGHTS.eliminationPoints[status] || 0;
    }
    
    // Calculate championship points
    if (performance.divisionChampion) {
      console.log(`Adding ${SCORING_WEIGHTS.championshipPoints.division_champion} division champion points for team ${performance.teamNumber}`);
      breakdown.championshipPoints += SCORING_WEIGHTS.championshipPoints.division_champion;
    }
    if (performance.championshipWinner) {
      console.log(`Adding ${SCORING_WEIGHTS.championshipPoints.champion} championship winner points for team ${performance.teamNumber}`);
      breakdown.championshipPoints += SCORING_WEIGHTS.championshipPoints.champion;
    }
    
    // Log points breakdown before calculating total
    console.log(`Points breakdown for team ${performance.teamNumber}:`);
    console.log(` - Ranking Points: ${breakdown.rankingPoints}`);
    console.log(` - Win Points: ${breakdown.winPoints}`);
    console.log(` - EPA/OPR Points: ${breakdown.statPoints}`);
    console.log(` - Award Points: ${breakdown.awardPoints}`);
    console.log(` - Elimination Points: ${breakdown.eliminationPoints}`);
    console.log(` - Championship Points: ${breakdown.championshipPoints}`);
    
    console.log(`Final breakdown for team ${performance.teamNumber}:`, breakdown);
    console.log(`Total points for team ${performance.teamNumber}: ${Object.values(breakdown).reduce((sum, points) => sum + points, 0)}`);
  } catch (error) {
    console.error('Error calculating team points:', error);
    // Continue with whatever points we were able to calculate
  }
  
  // Calculate total points
  const totalPoints = Object.values(breakdown).reduce((sum, points) => sum + points, 0);
  
  return {
    teamNumber: performance.teamNumber,
    teamName: performance.teamName || `Team ${performance.teamNumber}`,
    totalPoints,
    breakdown
  };
}

/**
 * Calculate scores for a fantasy team
 */
export async function calculateFantasyTeamScore(fantasyTeamId: string): Promise<number> {
  try {
    // Fetch the fantasy team
    const fantasyTeam = await getFantasyTeam(fantasyTeamId);
    
    if (!fantasyTeam) {
      throw new Error(`Fantasy team ${fantasyTeamId} not found`);
    }
    
    // Create a map to store team scores across all events
    const teamScores: Record<number, TeamScoring> = {};
    const eventTeamCounts: Record<string, number> = {};
    
    // Prefetch team counts for all events to reduce API calls
    for (const eventKey of FANTASY_CONFIG.eventIds) {
      const totalTeams = await getEventTeamCount(eventKey);
      eventTeamCounts[eventKey] = totalTeams;
    }
    
    // Process each selected team in the fantasy team
    for (const team of fantasyTeam.selectedTeams) {
      let bestPerformance: TeamEventPerformance | null = null;
      let bestScore = 0;
      
      // Try to find the team in each event
      for (const eventKey of FANTASY_CONFIG.eventIds) {
        const totalTeams = eventTeamCounts[eventKey];
        
        // Fetch performance data for this team at this event
        const performance = await fetchTeamEventPerformance(team.teamNumber, eventKey);
        
        if (performance) {
          // Calculate points for this team at this event
          const scoring = calculateTeamPoints(performance, totalTeams);
          
          // Use the team name from our fantasy team data
          scoring.teamName = team.teamName;
          
          // Keep track of the best performance across all events
          if (scoring.totalPoints > bestScore) {
            bestScore = scoring.totalPoints;
            bestPerformance = performance;
            teamScores[team.teamNumber] = scoring;
          }
        }
      }
      
      // If we didn't find the team at any event, give them zero points
      if (!bestPerformance) {
        console.log(`Team ${team.teamNumber} not found at any event, assigning zero points`);
        teamScores[team.teamNumber] = {
          teamNumber: team.teamNumber,
          teamName: team.teamName,
          totalPoints: 0,
          breakdown: {
            rankingPoints: 0,
            winPoints: 0,
            statPoints: 0,
            awardPoints: 0,
            eliminationPoints: 0,
            championshipPoints: 0
          }
        };
      }
    }
    
    // Calculate total score for the fantasy team
    const totalScore = Object.values(teamScores).reduce((sum, team) => sum + team.totalPoints, 0);
    
    // Update the fantasy team with the new score and team-specific scores
    const updatedTeams = fantasyTeam.selectedTeams.map(team => {
      const scoring = teamScores[team.teamNumber];
      if (scoring) {
        return {
          ...team,
          score: scoring.totalPoints,
          breakdown: {
            rankingPoints: scoring.breakdown.rankingPoints,
            winPoints: scoring.breakdown.winPoints,
            statPoints: scoring.breakdown.statPoints,
            awardPoints: scoring.breakdown.awardPoints,
            eliminationPoints: scoring.breakdown.eliminationPoints,
            championshipPoints: scoring.breakdown.championshipPoints
          }
        };
      }
      return team;
    });
    
    await updateFantasyTeam(fantasyTeamId, { 
      totalScore,
      selectedTeams: updatedTeams,
      lastUpdated: Date.now(),
      updatedAt: Date.now()
    });
    
    console.log(`Updated score for fantasy team ${fantasyTeamId}: ${totalScore}`);
    return totalScore;
  } catch (error) {
    console.error(`Error calculating fantasy team score for ${fantasyTeamId}:`, error);
    return 0;
  }
}

/**
 * Recalculate scores for all fantasy teams
 */
export async function recalculateAllFantasyTeamScores(fantasyTeamIds: string[]): Promise<void> {
  console.log(`Recalculating scores for ${fantasyTeamIds.length} fantasy teams`);
  
  // Process teams in small batches to avoid overwhelming the API
  const batchSize = 5;
  for (let i = 0; i < fantasyTeamIds.length; i += batchSize) {
    const batch = fantasyTeamIds.slice(i, i + batchSize);
    console.log(`Processing batch ${i / batchSize + 1}/${Math.ceil(fantasyTeamIds.length / batchSize)}`);
    
    // Process each team in the batch
    const promises = batch.map(teamId => calculateFantasyTeamScore(teamId));
    await Promise.all(promises);
    
    // Add a small delay between batches
    if (i + batchSize < fantasyTeamIds.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('All fantasy team scores have been recalculated');
}

/**
 * Debug score calculation for an individual team - useful for troubleshooting
 */
export async function debugTeamScore(teamNumber: number, cachedTeamData?: any): Promise<{
  teamNumber: number;
  teamName: string;
  totalPoints: number;
  breakdown: TeamScoring['breakdown'];
  eventPerformance: TeamEventPerformance;
}> {
  try {
    console.log(`Debugging score calculation for team ${teamNumber}`);
    
    // Get all events we're tracking
    const eventKeys = FANTASY_CONFIG.eventIds;
    if (eventKeys.length === 0) {
      throw new Error('No events configured for scoring');
    }
    
    let bestPerformance: TeamEventPerformance | null = null;
    let bestScore = 0;
    let performance: TeamEventPerformance | null = null;
    let scoring: TeamScoring | null = null;
    let totalTeams = 0;
    
    // Try all event keys and use the one where the team actually competed
    // This fixes teams from different divisions
    for (const eventKey of eventKeys) {
      console.log(`Checking team ${teamNumber} at event ${eventKey}`);
      
      // Get the total teams at this event for ranking calculations
      const eventTeamCount = await getEventTeamCount(eventKey);
      
      // Fetch performance data for this team at this event
      const eventPerformance = await fetchTeamEventPerformance(teamNumber, eventKey);
      
      if (eventPerformance) {
        // If we find team data at this event, calculate the score
        const eventScoring = calculateTeamPoints(eventPerformance, eventTeamCount);
        
        console.log(`Score for team ${teamNumber} at event ${eventKey}: ${eventScoring.totalPoints}`);
        
        // Keep track of the best performance across all events
        if (eventScoring.totalPoints > bestScore) {
          bestScore = eventScoring.totalPoints;
          bestPerformance = eventPerformance;
          scoring = eventScoring;
          totalTeams = eventTeamCount;
        }
      }
    }
    
    // If we didn't find the team at any event, create a minimal object
    if (!bestPerformance) {
      bestPerformance = {
        teamNumber
      };
      totalTeams = eventKeys.length > 0 ? await getEventTeamCount(eventKeys[0]) : 40; // Default to 40 teams if we can't get a count
    }
    
    // Use cached team data if provided, regardless of whether we found the team at an event
    if (cachedTeamData) {
      console.log(`Using cached team data for team ${teamNumber}`, cachedTeamData);
      
      performance = bestPerformance || { teamNumber };
      
      // Override with cached EPA value
      if (cachedTeamData.epa) {
        performance.epa = cachedTeamData.epa;
        console.log(`Using cached EPA: ${performance.epa} for team ${teamNumber}`);
      }
      
      // Add cached name
      if (cachedTeamData.name) {
        performance.teamName = cachedTeamData.name;
      }
      
      // Set rank to 1 if mentioned as winner or first place
      if (cachedTeamData.division_winner || cachedTeamData.first_place) {
        performance.rank = 1;
        console.log(`Setting rank to 1 for team ${teamNumber} based on cached data`);
      }
      
      // Set elimination status to won if specified
      if (cachedTeamData.division_winner) {
        performance.eliminationStatus = "won";
        console.log(`Setting elimination status to won for team ${teamNumber}`);
        
        // Only set division champion for actual division winners
        performance.divisionChampion = true;
        console.log(`Setting division champion status for team ${teamNumber}`);
      }
      
      // Set championship winner if specified
      if (cachedTeamData.championship_winner) {
        // Championship winner must also be a division champion
        if (!performance.divisionChampion) {
          console.warn(`Championship winner must also be a division champion - ignoring championship_winner flag for team ${teamNumber}`);
        } else {
          performance.championshipWinner = true;
          console.log(`Setting championship winner status for team ${teamNumber}`);
        }
      }
      
      // Log the complete performance object after applying all cached data
      console.log(`Final performance object for team ${teamNumber} after applying cached data:`, performance);
      
      // Add record information if known
      if (cachedTeamData.record) {
        const recordParts = cachedTeamData.record.split('-');
        if (recordParts.length >= 2) {
          performance.wins = parseInt(recordParts[0]) || 0;
          performance.losses = parseInt(recordParts[1]) || 0;
          if (recordParts.length > 2) {
            performance.ties = parseInt(recordParts[2]) || 0;
          }
          console.log(`Using record ${cachedTeamData.record} for team ${teamNumber}`);
        }
      }
      
      // Calculate score with cached data overrides
      scoring = calculateTeamPoints(performance, totalTeams);
      
      // Override team name from cached data
      if (cachedTeamData.name) {
        scoring.teamName = cachedTeamData.name;
      }
    }
    
    // Make sure we have a valid scoring object
    if (!scoring) {
      scoring = calculateTeamPoints(bestPerformance, totalTeams);
    }
    
    // Log the final breakdown and total score
    console.log(`Final breakdown for debug response for team ${teamNumber}:`, scoring.breakdown);
    console.log(`Championship points in response: ${scoring.breakdown.championshipPoints}`);
    
    // Return detailed breakdown for debugging
    return {
      teamNumber,
      teamName: scoring.teamName,
      totalPoints: scoring.totalPoints,
      breakdown: scoring.breakdown,
      eventPerformance: performance || bestPerformance
    };
  } catch (error) {
    console.error(`Error debugging team score for ${teamNumber}:`, error);
    throw error;
  }
}

/**
 * Helper function to fetch a team's overall EPA when event-specific EPA isn't available
 */
async function fetchTeamOverallEPA(teamNumber: number, performance: TeamEventPerformance): Promise<void> {
  try {
    const teamEpaResponse = await fetch(`${STATBOTICS_API_BASE_URL}/team/${teamNumber}`);
    if (teamEpaResponse.ok) {
      const teamEpaData = await teamEpaResponse.json();
      
      // Try normalized EPA first (preferred)
      if (teamEpaData && teamEpaData.norm_epa?.current) {
        performance.epa = teamEpaData.norm_epa.current / 100; // Scale appropriately
        console.log(`Using team overall normalized EPA ${performance.epa} for team ${teamNumber}`);
      } 
      // Fall back to regular EPA if normalized isn't available
      else if (teamEpaData && teamEpaData.epa) {
        performance.epa = teamEpaData.epa;
        console.log(`Using team overall EPA ${performance.epa} for team ${teamNumber}`);
      } else {
        console.warn(`No EPA data available for team ${teamNumber}`);
      }
    } else {
      console.warn(`Could not fetch overall EPA for team ${teamNumber}: ${teamEpaResponse.status}`);
    }
  } catch (error) {
    console.error(`Error fetching overall EPA for team ${teamNumber}:`, error);
  }
} 