import { FantasyTeam, getFantasyTeam, updateFantasyTeam } from './firebase';
import { TBA_API_BASE_URL, TBA_API_KEY, FANTASY_CONFIG, STATBOTICS_API_BASE_URL } from './config';

/**
 * Team performance data from TBA
 */
interface TeamEventPerformance {
  teamNumber: number;
  rank?: number;
  wins?: number;
  losses?: number;
  ties?: number;
  opr?: number;
  epa?: number;  // Added EPA from Statbotics
  dpr?: number;
  ccwm?: number;
  awards?: string[];
  eliminationStatus?: string; // "finalist", "semifinalist", "quarterfinalist", "eliminated", "winner"
  // Additional metrics can be added here
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
    oprPoints: number;
    awardPoints: number;
    eliminationPoints: number;
  };
}

/**
 * Scoring weights for different performance metrics
 */
const SCORING_WEIGHTS = {
  // Points for qualification rankings (inverse to rank - higher ranks get more points)
  rankingInverse: 2, // Multiply by (totalTeams - rank + 1)
  
  // Match performance
  winPoints: 5,      // Points per win
  tiePoints: 2,      // Points per tie
  
  // Statistical performance
  oprMultiplier: 2,  // Multiply OPR by this value
  
  // Awards with index signature to allow string keys
  awardPoints: {
    "chairmans": 100,
    "winner": 75,
    "finalist": 50,
    "engineering_inspiration": 60,
    "industrial_design": 40,
    "quality": 40,
    "safety": 30,
    "innovation": 40,
    "creativity": 40,
    "engineering_excellence": 40,
    "autonomous": 40,
    "rookie_all_star": 60,
    "rookie_inspiration": 40,
    "gracious_professionalism": 40,
    "judges": 30,
    "default": 20 // Default points for other awards
  } as Record<string, number>,
  
  // Elimination performance with index signature
  eliminationPoints: {
    "winner": 200,
    "finalist": 150,
    "semifinalist": 100,
    "quarterfinalist": 50
  } as Record<string, number>
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
      
      if (statusData && statusData.qual && statusData.qual.ranking) {
        try {
          // Get qualification rank and record
          performance.rank = statusData.qual.ranking.rank;
          
          if (statusData.qual.ranking.record) {
            performance.wins = statusData.qual.ranking.record.wins;
            performance.losses = statusData.qual.ranking.record.losses;
            performance.ties = statusData.qual.ranking.record.ties;
          }
          
          // Get elimination status
          if (statusData.playoff) {
            performance.eliminationStatus = statusData.playoff.status;
          }
        } catch (error) {
          console.warn(`Error parsing status data for team ${teamNumber} at event ${eventKey}:`, error);
        }
      } else {
        console.log(`No qualification data for team ${teamNumber} at event ${eventKey}`);
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
        if (epaData && epaData.epa !== undefined) {
          performance.epa = epaData.epa;
          console.log(`Found EPA ${epaData.epa} for team ${teamNumber} at event ${eventKey}`);
        } else {
          // If no event-specific EPA, try getting the team's overall EPA
          const teamEpaResponse = await fetch(`${STATBOTICS_API_BASE_URL}/team/${teamNumber}`);
          if (teamEpaResponse.ok) {
            const teamEpaData = await teamEpaResponse.json();
            if (teamEpaData && teamEpaData.norm_epa?.current) {
              performance.epa = teamEpaData.norm_epa.current / 100; // Scale appropriately
              console.log(`Using team overall EPA ${performance.epa} for team ${teamNumber}`);
            }
          }
        }
      } else {
        console.warn(`Could not fetch EPA data for team ${teamNumber} at event ${eventKey}: ${epaResponse.status}`);
      }
    } catch (error) {
      console.warn(`Error fetching EPA data for team ${teamNumber}:`, error);
    }
    
    // Fetch awards for this team at this event
    try {
      const awardsResponse = await fetch(
        `${TBA_API_BASE_URL}/team/frc${teamNumber}/event/${eventKey}/awards`,
        { headers: { 'X-TBA-Auth-Key': TBA_API_KEY } }
      );
      
      if (awardsResponse.ok) {
        const awardsData = await awardsResponse.json();
        if (Array.isArray(awardsData) && awardsData.length > 0) {
          // Extract award types, handling potential missing properties
          performance.awards = awardsData
            .filter(award => award && typeof award === 'object' && 'award_type' in award)
            .map(award => award.award_type || award.award_type_str || 'unknown');
          
          console.log(`Found ${performance.awards.length} awards for team ${teamNumber} at event ${eventKey}`);
        } else {
          console.log(`No awards found for team ${teamNumber} at event ${eventKey}`);
        }
      } else {
        console.log(`Could not fetch awards for team ${teamNumber} at event ${eventKey}: ${awardsResponse.status}`);
      }
    } catch (error) {
      console.warn(`Error fetching awards for team ${teamNumber} at event ${eventKey}:`, error);
    }
    
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
    oprPoints: 0,
    awardPoints: 0,
    eliminationPoints: 0
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
    
    // Calculate OPR/EPA points - prefer EPA if available
    if (performance.epa && typeof performance.epa === 'number') {
      // EPA is typically more accurate, so give it more weight
      breakdown.oprPoints = Math.round(performance.epa * SCORING_WEIGHTS.oprMultiplier * 1.5);
    } else if (performance.opr && typeof performance.opr === 'number') {
      breakdown.oprPoints = Math.round(performance.opr * SCORING_WEIGHTS.oprMultiplier);
    }
    
    // Calculate award points
    if (performance.awards && Array.isArray(performance.awards) && performance.awards.length > 0) {
      performance.awards.forEach(awardType => {
        if (awardType) {
          const awardKey = String(awardType).toLowerCase();
          const points = SCORING_WEIGHTS.awardPoints[awardKey] || SCORING_WEIGHTS.awardPoints.default;
          breakdown.awardPoints += points;
        }
      });
    }
    
    // Calculate elimination points
    if (performance.eliminationStatus && typeof performance.eliminationStatus === 'string') {
      const status = performance.eliminationStatus.toLowerCase();
      breakdown.eliminationPoints = SCORING_WEIGHTS.eliminationPoints[status] || 0;
    }
  } catch (error) {
    console.error('Error calculating team points:', error);
    // Continue with whatever points we were able to calculate
  }
  
  // Calculate total points
  const totalPoints = Object.values(breakdown).reduce((sum, points) => sum + points, 0);
  
  return {
    teamNumber: performance.teamNumber,
    teamName: `Team ${performance.teamNumber}`, // This would be replaced with actual name
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
    
    // Process all configured events
    for (const eventKey of FANTASY_CONFIG.eventIds) {
      // Get total teams at this event (for ranking calculations)
      const totalTeams = await getEventTeamCount(eventKey);
      eventTeamCounts[eventKey] = totalTeams;
      
      // Process each selected team in the fantasy team
      for (const team of fantasyTeam.selectedTeams) {
        // Fetch performance data for this team at this event
        const performance = await fetchTeamEventPerformance(team.teamNumber, eventKey);
        
        if (performance) {
          // Calculate points for this team at this event
          const scoring = calculateTeamPoints(performance, totalTeams);
          scoring.teamName = team.teamName; // Use the stored team name
          
          // If we already have scores for this team from another event, add to them
          if (teamScores[team.teamNumber]) {
            const existingScore = teamScores[team.teamNumber];
            teamScores[team.teamNumber] = {
              teamNumber: team.teamNumber,
              teamName: team.teamName,
              totalPoints: existingScore.totalPoints + scoring.totalPoints,
              breakdown: {
                rankingPoints: existingScore.breakdown.rankingPoints + scoring.breakdown.rankingPoints,
                winPoints: existingScore.breakdown.winPoints + scoring.breakdown.winPoints,
                oprPoints: existingScore.breakdown.oprPoints + scoring.breakdown.oprPoints,
                awardPoints: existingScore.breakdown.awardPoints + scoring.breakdown.awardPoints,
                eliminationPoints: existingScore.breakdown.eliminationPoints + scoring.breakdown.eliminationPoints
              }
            };
          } else {
            // First time seeing this team
            teamScores[team.teamNumber] = scoring;
          }
        }
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
            oprPoints: scoring.breakdown.oprPoints,
            awardPoints: scoring.breakdown.awardPoints,
            eliminationPoints: scoring.breakdown.eliminationPoints
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