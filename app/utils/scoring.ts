import { FantasyTeam, getFantasyTeam, updateFantasyTeam } from './firebase';
import { TBA_API_BASE_URL, TBA_API_KEY, FANTASY_CONFIG, STATBOTICS_API_BASE_URL } from './config';
import { doc, getDoc, setDoc, getFirestore } from 'firebase/firestore';

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
 * Update TeamPointsBreakdown interface to include total
 */
interface TeamPointsBreakdown {
  rankingPoints: number;
  winPoints: number;
  statPoints: number;
  awardPoints: number;
  eliminationPoints: number;
  championshipPoints: number;
  total: number;
}

/**
 * Scoring weights for different performance metrics
 */
const SCORING_WEIGHTS = {
  // Points for qualification rankings (inverse to rank - higher ranks get more points)
  rankingInverse: 1.5, // Multiply by (totalTeams - rank + 1)
  
  // Match performance
  winPoints: 8,      // Points per win
  tiePoints: 3,      // Points per tie
  
  // EPA progressive "tax bracket" style scoring system
  // epaBrackets: [
  //   { threshold: 2500, points: 50, marginalRate: 0.05 }, // Base 50 points for 2500, +0.05 per point above
  //   { threshold: 2000, points: 40, marginalRate: 0.02 }, // Base 40 points for 2000, +0.02 per point above
  //   { threshold: 1750, points: 30, marginalRate: 0.04 }, // Base 30 points for 1750, +0.04 per point above
  //   { threshold: 1500, points: 20, marginalRate: 0.04 }, // Base 20 points for 1500, +0.04 per point above
  //   { threshold: 1250, points: 15, marginalRate: 0.02 }, // Base 15 points for 1250, +0.02 per point above
  //   { threshold: 1000, points: 10, marginalRate: 0.02 }, // Base 10 points for 1000, +0.02 per point above
  //   { threshold: 750, points: 5, marginalRate: 0.02 },   // Base 5 points for 750, +0.02 per point above
  //   { threshold: 0, points: 0, marginalRate: 0.0067 }    // 0 points for below 750, marginal rate to hit 5 at 750
  // ],
  
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
    "division_champion": 50,  // No additional points for being a division winner (already covered by elimination points)
    "championship_finalist": 50  // Additional points for being a championship finalist
  }
};

/**
 * Global EPA bracket configuration for scoring
 * Defined here to be easily adjustable and consistent across the application
 * Adjusted for EPA range 
 */
export const EPA_BRACKETS = [
  { threshold: 2000, basePoints: 200, marginalRate: 0.15, label: 'Elite', color: 'bg-purple-100 text-purple-800 border-purple-300' },
  { threshold: 1900, basePoints: 175, marginalRate: 0.12, label: 'Premier', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  { threshold: 1800, basePoints: 150, marginalRate: 0.10, label: 'Excellent', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { threshold: 1700, basePoints: 125, marginalRate: 0.08, label: 'Very Good', color: 'bg-green-100 text-green-800 border-green-300' },
  { threshold: 1600, basePoints: 100, marginalRate: 0.06, label: 'Good', color: 'bg-teal-100 text-teal-800 border-teal-300' },
  { threshold: 1500, basePoints: 75, marginalRate: 0.05, label: 'Above Average', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { threshold: 1400, basePoints: 50, marginalRate: 0.04, label: 'Average', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { threshold: 0, basePoints: 0, marginalRate: 0.03, label: 'Below Average', color: 'bg-gray-100 text-gray-800 border-gray-300' }
];


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
 * Calculate the EPA points using the progressive bracket system
 * @param epaValue The EPA value to calculate points for
 * @returns The number of points earned
 */
export function calculateEpaPoints(epaValue: number): number {
  // Handle edge case of no EPA or negative EPA
  if (!epaValue || epaValue < 0) {
    return 0;
  }
  
  // Find the appropriate bracket
  for (const bracket of EPA_BRACKETS) {
    if (epaValue >= bracket.threshold) {
      // Calculate the points with the progressive system
      const excessEpa = epaValue - bracket.threshold;
      const excessPoints = Math.round(excessEpa * bracket.marginalRate);
      const totalPoints = Math.round(bracket.basePoints + excessPoints);
      
      console.log(`EPA ${epaValue} falls in bracket ≥${bracket.threshold}:`, {
        basePoints: bracket.basePoints,
        excessEpa,
        excessPoints,
        totalPoints
      });
      
      return totalPoints;
    }
  }
  
  // Default case (should not happen with the current bracket structure)
  return 0;
}

/**
 * Calculate points for a team based on their performance
 */
export function calculateTeamPoints(performance: TeamEventPerformance, totalTeams: number): TeamScoring {
  const breakdown: TeamPointsBreakdown = {
    rankingPoints: 0,
    winPoints: 0,
    statPoints: 0,
    eliminationPoints: 0,
    championshipPoints: 0,
    awardPoints: 0,
    total: 0
  };
  
  // No points if no team number (edge case)
  if (!performance.teamNumber) {
    return {
      teamNumber: performance.teamNumber,
      teamName: performance.teamName || `Team ${performance.teamNumber}`,
      totalPoints: 0,
      breakdown
    };
  }

  // Calculate points for qualifying performance
  if (performance.wins && typeof performance.wins === 'number') {
    breakdown.winPoints = Math.round(performance.wins * SCORING_WEIGHTS.winPoints);
  }
  if (performance.ties && typeof performance.ties === 'number') {
    breakdown.winPoints += Math.round(performance.ties * SCORING_WEIGHTS.tiePoints);
  }
  
  // Calculate ranking points (based on qualifications ranking)
  if (performance.rank && typeof performance.rank === 'number' && performance.rank > 0) {
    breakdown.rankingPoints = Math.round((totalTeams - performance.rank + 1) ** SCORING_WEIGHTS.rankingInverse);
  }
  
  // Calculate EPA points using the progressive bracket system
  if (performance.epa && typeof performance.epa === 'number') {
    breakdown.statPoints = calculateEpaPoints(performance.epa);
  }
  
  // Calculate elimination points
  if (performance.eliminationStatus && typeof performance.eliminationStatus === 'string') {
    const status = performance.eliminationStatus.toLowerCase();
    
    if (status === 'won') {
      breakdown.eliminationPoints = Math.round(SCORING_WEIGHTS.eliminationPoints.won);
    } else if (status === 'finalist') {
      breakdown.eliminationPoints = Math.round(SCORING_WEIGHTS.eliminationPoints.finalist);
    } else if (status === 'semifinalist') {
      breakdown.eliminationPoints = Math.round(SCORING_WEIGHTS.eliminationPoints.semifinalist);
    } else if (status === 'quarterfinalist') {
      breakdown.eliminationPoints = Math.round(SCORING_WEIGHTS.eliminationPoints.quarterfinalist);
    }
  }
  
  // Calculate championship points
  if (performance.divisionChampion) {
    // For division champions, we either award championship winner or finalist points
    if (performance.championshipWinner) {
      console.log(`Adding ${SCORING_WEIGHTS.championshipPoints.champion} championship winner points for team ${performance.teamNumber}`);
      breakdown.championshipPoints += Math.round(SCORING_WEIGHTS.championshipPoints.champion);
    } else {
      // If they're a division champion but not the championship winner, they're a finalist
      console.log(`Adding ${SCORING_WEIGHTS.championshipPoints.championship_finalist} championship finalist points for team ${performance.teamNumber}`);
      breakdown.championshipPoints += Math.round(SCORING_WEIGHTS.championshipPoints.championship_finalist);
    }
  }
  
  // Add award points (e.g., Chairman's Award)
  // TODO: Implement this when award data is available
  
  // Sum up all points for total - already rounded at each step
  breakdown.total = 
    breakdown.rankingPoints + 
    breakdown.winPoints + 
    breakdown.statPoints + 
    breakdown.eliminationPoints +
    breakdown.championshipPoints +
    breakdown.awardPoints;
  
  // Calculate total points
  const totalPoints = Math.round(breakdown.total);
  
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
export async function calculateFantasyTeamScore(fantasyTeamId: string): Promise<any> {
  try {
    // Check if competition has started yet
    const now = Date.now();
    if (now < FANTASY_CONFIG.competitionStartTime) {
      console.log(`Competition hasn't started yet. Hiding points for fantasy team ${fantasyTeamId}. Current time: ${new Date(now).toISOString()}, Start time: ${new Date(FANTASY_CONFIG.competitionStartTime).toISOString()}`);
      
      // Fetch the fantasy team
      const fantasyTeam = await getFantasyTeam(fantasyTeamId);
      
      if (!fantasyTeam) {
        throw new Error(`Fantasy team ${fantasyTeamId} not found`);
      }
      
      // Update the team with hidden score indicator
      const updatedTeams = fantasyTeam.selectedTeams.map(team => ({
        ...team,
        score: -1, // Use -1 to indicate hidden score
        breakdown: {
          rankingPoints: 0,
          winPoints: 0,
          statPoints: 0,
          awardPoints: 0,
          eliminationPoints: 0,
          championshipPoints: 0
        }
      }));
      
      await updateFantasyTeam(fantasyTeamId, { 
        totalScore: -1, // Use -1 to indicate hidden score
        selectedTeams: updatedTeams,
        lastUpdated: Date.now(),
        updatedAt: Date.now()
      });
      
      return {
        totalScore: -1,
        hiddenUntilCompetitionStart: true,
        competitionStartTime: FANTASY_CONFIG.competitionStartTime
      };
    }
    
    // Calculate score normally
    // Fetch the fantasy team
    const fantasyTeam = await getFantasyTeam(fantasyTeamId);
    
    if (!fantasyTeam) {
      throw new Error(`Fantasy team ${fantasyTeamId} not found`);
    }
    
    console.log(`Calculating score for fantasy team: ${fantasyTeam.name} (${fantasyTeamId})`);
    
    // Create a map to store team scores across all events
    const teamScores: Record<number, TeamScoring> = {};
    const eventTeamCounts: Record<string, number> = {};
    
    // Prefetch team counts for all events to reduce API calls
    for (const eventKey of FANTASY_CONFIG.eventIds) {
      const totalTeams = await getEventTeamCount(eventKey);
      eventTeamCounts[eventKey] = totalTeams;
    }
    
    // Process each selected team in the fantasy team
    const totalSelectedTeams = fantasyTeam.selectedTeams.length;
    for (let i = 0; i < totalSelectedTeams; i++) {
      const team = fantasyTeam.selectedTeams[i];
      console.log(`Processing team ${i+1}/${totalSelectedTeams}: ${team.teamName} (${team.teamNumber})`);
      
      let bestPerformance: TeamEventPerformance | null = null;
      let bestScore = 0;
      
      // Try to find the team in each event
      const totalEvents = FANTASY_CONFIG.eventIds.length;
      for (let j = 0; j < totalEvents; j++) {
        const eventKey = FANTASY_CONFIG.eventIds[j];
        console.log(`Checking event ${j+1}/${totalEvents}: ${eventKey} for team ${team.teamNumber}`);
        
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
            console.log(`Found better score (${scoring.totalPoints}) for team ${team.teamNumber} at event ${eventKey}`);
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
    const totalScore = Math.round(Object.values(teamScores).reduce((sum, team) => sum + team.totalPoints, 0));
    
    // Update the fantasy team with the new score and team-specific scores
    const updatedTeams = fantasyTeam.selectedTeams.map(team => {
      const scoring = teamScores[team.teamNumber];
      if (scoring) {
        return {
          ...team,
          score: Math.round(scoring.totalPoints),
          breakdown: {
            rankingPoints: Math.round(scoring.breakdown.rankingPoints),
            winPoints: Math.round(scoring.breakdown.winPoints),
            statPoints: Math.round(scoring.breakdown.statPoints),
            awardPoints: Math.round(scoring.breakdown.awardPoints),
            eliminationPoints: Math.round(scoring.breakdown.eliminationPoints),
            championshipPoints: Math.round(scoring.breakdown.championshipPoints)
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
    const currentBatch = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(fantasyTeamIds.length / batchSize);
    console.log(`Processing batch ${currentBatch}/${totalBatches} (${i + 1}-${Math.min(i + batchSize, fantasyTeamIds.length)}/${fantasyTeamIds.length} teams)`);
    
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
    
    // Check if competition has started yet
    const now = Date.now();
    if (now < FANTASY_CONFIG.competitionStartTime) {
      console.log(`Competition hasn't started yet. Returning hidden score in debug mode. Current time: ${new Date(now).toISOString()}, Start time: ${new Date(FANTASY_CONFIG.competitionStartTime).toISOString()}`);
      
      // Create response with hidden score indicator (-1)
      return {
        teamNumber,
        teamName: cachedTeamData?.name || `Team ${teamNumber}`,
        totalPoints: -1, // Use -1 to indicate hidden score
        breakdown: {
          rankingPoints: 0,
          winPoints: 0,
          statPoints: 0,
          awardPoints: 0,
          eliminationPoints: 0,
          championshipPoints: 0
        },
        eventPerformance: {
          teamNumber,
          teamName: cachedTeamData?.name || `Team ${teamNumber}`
        }
      };
    }
    
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
          performance.divisionChampion = true; // Auto-set division champion status
          performance.eliminationStatus = "won"; // Must have won division to be a champ winner
          console.log(`Auto-setting division champion status for team ${teamNumber} as they're marked as championship winner`);
        }
        performance.championshipWinner = true;
        console.log(`Setting championship winner status for team ${teamNumber}`);
      }
      
      // Set championship finalist if specified
      if (cachedTeamData.championship_finalist && !cachedTeamData.championship_winner) {
        // Championship finalist must also be a division champion
        if (!performance.divisionChampion) {
          performance.divisionChampion = true; // Auto-set division champion status
          performance.eliminationStatus = "won"; // Must have won division to be a finalist
          console.log(`Auto-setting division champion status for team ${teamNumber} as they're marked as championship finalist`);
        }
        // Championship finalist is implicitly defined by divisionChampion=true and championshipWinner=false
        console.log(`Setting championship finalist status for team ${teamNumber}`);
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
  console.log(`Fetching overall EPA for team ${teamNumber}`);
  
  try {
    // Only check for EPA in the divisions collection
    const db = getFirestore();
    
    // Look in each event division
    for (const eventKey of FANTASY_CONFIG.eventIds) {
      try {
        console.log(`Checking division cache for team ${teamNumber} in ${eventKey}`);
        const divisionDocRef = doc(db, 'divisions', eventKey);
        const divisionDoc = await getDoc(divisionDocRef);
        
        if (divisionDoc.exists()) {
          const divisionData = divisionDoc.data();
          
          // Check if the teams array exists and is not empty
          if (divisionData.teams && Array.isArray(divisionData.teams) && divisionData.teams.length > 0) {
            // Find the team in the array
            const teamData = divisionData.teams.find((t: any) => t.team === teamNumber);
            
            if (teamData && teamData.epa) {
              console.log(`Found EPA ${teamData.epa} for team ${teamNumber} in division ${eventKey}`);
              performance.epa = teamData.epa;
              
              // Also set the team name if available
              if (teamData.name) {
                performance.teamName = teamData.name;
              }
              
              return;
            }
          }
        }
      } catch (err) {
        console.warn(`Error checking division cache for ${eventKey}:`, err);
        // Continue to next division
      }
    }
    
    // If we didn't find the team in any division, use a default EPA
    console.log(`No team data found for team ${teamNumber}, using default EPA`);
    performance.epa = 1000; // Default EPA value
    
  } catch (error) {
    console.error(`Error fetching overall EPA for team ${teamNumber}:`, error);
    performance.epa = 1000; // Default EPA value
  }
}

