import { getFantasyTeam, updateFantasyTeam, getCachedDivisionTeams, getEvent, getActiveEvent, EventConfig } from './firebase';
import { TBA_API_BASE_URL, TBA_API_KEY, FANTASY_CONFIG, STATBOTICS_API_BASE_URL } from './config';
import { doc, getDoc, getFirestore } from 'firebase/firestore';

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
 * Pre-fetched data for a single event, shared across all teams.
 */
interface EventCache {
  teamStatuses: Record<string, any>;   // keyed by "frc{number}"
  oprs: Record<string, number>;
  dprs: Record<string, number>;
  ccwms: Record<string, number>;
  epaByTeam: Record<number, number>;   // team number → EPA value
}

// How long the Firebase event cache stays valid before re-fetching from APIs
const EVENT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetch all bulk data for an event from external APIs (3 calls total).
 */
async function fetchEventCacheFromAPIs(eventKey: string): Promise<EventCache> {
  const [statusesRes, oprsRes, epaRes] = await Promise.all([
    fetch(`${TBA_API_BASE_URL}/event/${eventKey}/teams/statuses`, { headers: { 'X-TBA-Auth-Key': TBA_API_KEY } }),
    fetch(`${TBA_API_BASE_URL}/event/${eventKey}/oprs`, { headers: { 'X-TBA-Auth-Key': TBA_API_KEY } }),
    fetch(`${STATBOTICS_API_BASE_URL}/team_events?event=${eventKey}&limit=500`),
  ]);

  const teamStatuses: Record<string, any> = statusesRes.ok ? await statusesRes.json() : {};
  const oprData = oprsRes.ok ? await oprsRes.json() : null;
  const oprs: Record<string, number> = oprData?.oprs ?? {};
  const dprs: Record<string, number> = oprData?.dprs ?? {};
  const ccwms: Record<string, number> = oprData?.ccwms ?? {};

  const epaByTeam: Record<number, number> = {};
  if (epaRes.ok) {
    const epaList: any[] = await epaRes.json();
    for (const entry of epaList) {
      const num = entry.team ?? entry.team_number;
      if (num == null) continue;
      let epa: number | undefined;
      if (typeof entry.epa === 'number') {
        epa = entry.epa;
      } else if (entry.epa && typeof entry.epa === 'object') {
        epa = entry.epa.unitless ?? entry.epa.norm ?? (entry.epa.breakdown?.total_points != null ? entry.epa.breakdown.total_points * 100 : undefined);
      }
      if (epa != null) epaByTeam[num] = epa;
    }
  }

  return { teamStatuses, oprs, dprs, ccwms, epaByTeam };
}

/**
 * Get event cache, reading from Firebase if fresh, otherwise fetching from APIs and saving.
 */
async function fetchEventCache(eventKey: string, forceRefresh = false): Promise<EventCache> {
  const db = getFirestore();
  const cacheRef = doc(db, 'eventApiCache', eventKey);

  if (!forceRefresh) {
    try {
      const snap = await getDoc(cacheRef);
      if (snap.exists()) {
        const data = snap.data();
        if (Date.now() - (data.lastUpdated ?? 0) < EVENT_CACHE_TTL_MS) {
          console.log(`Using Firebase event cache for ${eventKey}`);
          return {
            teamStatuses: data.teamStatuses ?? {},
            oprs: data.oprs ?? {},
            dprs: data.dprs ?? {},
            ccwms: data.ccwms ?? {},
            epaByTeam: data.epaByTeam ?? {},
          };
        }
      }
    } catch (err) {
      console.warn(`Could not read event cache for ${eventKey}:`, err);
    }
  }

  console.log(`Fetching fresh event data from APIs for ${eventKey}`);
  const cache = await fetchEventCacheFromAPIs(eventKey);

  // Save to Firebase (best-effort, don't fail scoring if this fails)
  try {
    const { setDoc } = await import('firebase/firestore');
    await setDoc(cacheRef, { ...cache, lastUpdated: Date.now() });
  } catch (err) {
    console.warn(`Could not save event cache for ${eventKey}:`, err);
  }

  return cache;
}

/**
 * Force-refresh the Firebase event cache for all configured events.
 */
export async function refreshEventCaches(): Promise<void> {
  const activeEvent = await getActiveEvent();
  const eventIds = activeEvent ? activeEvent.eventIds : FANTASY_CONFIG.eventIds;
  await Promise.all(eventIds.map(k => fetchEventCache(k, true)));
  console.log('Event caches refreshed');
}

/**
 * Parse a TBA team status object into TeamEventPerformance fields.
 */
function parseStatusData(statusData: any, performance: TeamEventPerformance, teamNumber: number, eventKey: string) {
  try {
    if (statusData?.qual?.ranking) {
      performance.rank = statusData.qual.ranking.rank;
      if (statusData.qual.ranking.record) {
        performance.wins = statusData.qual.ranking.record.wins;
        performance.losses = statusData.qual.ranking.record.losses;
        performance.ties = statusData.qual.ranking.record.ties;
      }
    }

    if (statusData?.playoff) {
      const playoffLevel = statusData.playoff.level;
      const playoffStatus = statusData.playoff.status;

      if (playoffStatus === 'won') {
        performance.eliminationStatus = 'won';
      } else if (playoffLevel === 'f') {
        performance.eliminationStatus = 'finalist';
      } else if (playoffLevel === 'sf') {
        performance.eliminationStatus = 'semifinalist';
      } else if (playoffLevel === 'qf') {
        performance.eliminationStatus = 'quarterfinalist';
      } else if (playoffLevel === 'ef') {
        performance.eliminationStatus = 'eighthfinalist';
      }

      if (statusData.playoff.record) {
        performance.wins = (performance.wins || 0) + (statusData.playoff.record.wins || 0);
        performance.losses = (performance.losses || 0) + (statusData.playoff.record.losses || 0);
        performance.ties = (performance.ties || 0) + (statusData.playoff.record.ties || 0);
      }
    }

    if (!performance.eliminationStatus && statusData?.playoff_status_str) {
      const s = statusData.playoff_status_str.toLowerCase();
      if (s.includes('won')) performance.eliminationStatus = 'won';
      else if (s.includes('finalist')) performance.eliminationStatus = 'finalist';
      else if (s.includes('semifinalist')) performance.eliminationStatus = 'semifinalist';
      else if (s.includes('quarterfinalist')) performance.eliminationStatus = 'quarterfinalist';
      else if (s.includes('eighth')) performance.eliminationStatus = 'eighthfinalist';
    }

    if (eventKey.includes('oncmp') || eventKey.includes('chs') || eventKey.includes('first')) {
      if (performance.eliminationStatus === 'won') {
        performance.divisionChampion = true;
        if (statusData?.overall_status_str) {
          const overall = statusData.overall_status_str.toLowerCase();
          if (overall.includes('champion') || overall.includes('event winner')) {
            performance.championshipWinner = true;
          }
        }
      }
    }
  } catch (err) {
    console.warn(`Error parsing status data for team ${teamNumber} at ${eventKey}:`, err);
  }
}

/**
 * Build TeamEventPerformance from pre-fetched event cache (no extra API calls).
 */
function teamPerformanceFromCache(teamNumber: number, eventKey: string, cache: EventCache): TeamEventPerformance {
  const performance: TeamEventPerformance = { teamNumber };

  const statusData = cache.teamStatuses[`frc${teamNumber}`];
  if (statusData) {
    parseStatusData(statusData, performance, teamNumber, eventKey);
  }

  const teamKey = `frc${teamNumber}`;
  if (cache.oprs[teamKey] !== undefined) performance.opr = cache.oprs[teamKey];
  if (cache.dprs[teamKey] !== undefined) performance.dpr = cache.dprs[teamKey];
  if (cache.ccwms[teamKey] !== undefined) performance.ccwm = cache.ccwms[teamKey];

  if (cache.epaByTeam[teamNumber] !== undefined) {
    performance.epa = cache.epaByTeam[teamNumber];
  }

  return performance;
}

/**
 * Fetch team event performance data from The Blue Alliance.
 * Used by debugTeamScore (single-team path) only.
 */
async function fetchTeamEventPerformance(teamNumber: number, eventKey: string): Promise<TeamEventPerformance | null> {
  try {
    const cache = await fetchEventCache(eventKey);
    const performance = teamPerformanceFromCache(teamNumber, eventKey, cache);

    // Fall back to Firestore-cached EPA if not found in Statbotics bulk response
    if (!performance.epa) {
      await fetchTeamOverallEPA(teamNumber, performance);
    }

    return performance;
  } catch (error) {
    console.error(`Error fetching performance for team ${teamNumber} at event ${eventKey}:`, error);
    return null;
  }
}

/**
 * Check if any matches have been played at an event yet.
 * Uses TBA's /matches/simple endpoint and checks for a non-null actual_time.
 */
export async function hasMatchResults(eventKey: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${TBA_API_BASE_URL}/event/${eventKey}/matches/simple`,
      { headers: { 'X-TBA-Auth-Key': TBA_API_KEY } }
    );
    if (!response.ok) return false;
    const matches = await response.json();
    return Array.isArray(matches) && matches.some((m: { actual_time: number | null }) => m.actual_time != null);
  } catch {
    return false;
  }
}

/**
 * Get the number of teams at an event
 */
export async function getEventTeamCount(eventKey: string): Promise<number> {
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
 * Resolve the EventConfig to use for scoring a fantasy team.
 * Priority: team's own eventId → active Firestore event → static FANTASY_CONFIG fallback.
 */
async function resolveEventConfig(fantasyTeam: { eventId?: string }): Promise<EventConfig> {
  if (fantasyTeam.eventId) {
    const ev = await getEvent(fantasyTeam.eventId);
    if (ev) return ev;
  }
  const active = await getActiveEvent();
  if (active) return active;
  // Static fallback
  return {
    eventIds: FANTASY_CONFIG.eventIds,
    eventName: FANTASY_CONFIG.eventName,
    eventDates: FANTASY_CONFIG.eventDates,
    eventLocation: FANTASY_CONFIG.eventLocation,
    competitionStartTime: FANTASY_CONFIG.competitionStartTime,
    budget: FANTASY_CONFIG.budget,
    maxTeams: FANTASY_CONFIG.maxTeams,
    isActive: true,
    isCompleted: false,
    divisionNames: {},
    createdAt: 0,
    updatedAt: 0,
  };
}

/**
 * Calculate scores for a fantasy team
 */
export async function calculateFantasyTeamScore(fantasyTeamId: string): Promise<any> {
  try {
    // Fetch the fantasy team first so we can resolve its event config
    const fantasyTeam = await getFantasyTeam(fantasyTeamId);
    if (!fantasyTeam) throw new Error(`Fantasy team ${fantasyTeamId} not found`);

    const eventConfig = await resolveEventConfig(fantasyTeam);

    // Check if competition has started yet
    const now = Date.now();
    if (now < eventConfig.competitionStartTime) {
      console.log(`Competition hasn't started yet. Hiding points for fantasy team ${fantasyTeamId}.`);

      const updatedTeams = fantasyTeam.selectedTeams.map(team => ({
        ...team,
        score: -1,
        breakdown: {
          rankingPoints: 0, winPoints: 0, statPoints: 0,
          awardPoints: 0, eliminationPoints: 0, championshipPoints: 0
        }
      }));

      await updateFantasyTeam(fantasyTeamId, {
        totalScore: -1,
        selectedTeams: updatedTeams,
        lastUpdated: Date.now(),
        updatedAt: Date.now()
      });

      return {
        totalScore: -1,
        hiddenUntilCompetitionStart: true,
        competitionStartTime: eventConfig.competitionStartTime
      };
    }

    // Check if any matches have been played yet across all event divisions
    const matchChecks = await Promise.all(eventConfig.eventIds.map(k => hasMatchResults(k)));
    const anyMatchesPlayed = matchChecks.some(Boolean);
    if (!anyMatchesPlayed) {
      console.log(`No matches played yet for event. Hiding score for fantasy team ${fantasyTeamId}.`);
      const updatedTeams = fantasyTeam.selectedTeams.map(team => ({
        ...team,
        score: -1,
        breakdown: {
          rankingPoints: 0, winPoints: 0, statPoints: 0,
          awardPoints: 0, eliminationPoints: 0, championshipPoints: 0
        }
      }));
      await updateFantasyTeam(fantasyTeamId, {
        totalScore: -1,
        selectedTeams: updatedTeams,
        lastUpdated: Date.now(),
        updatedAt: Date.now()
      });
      return { totalScore: -1, hiddenUntilMatchesStart: true };
    }

    // Calculate score normally
    console.log(`Calculating score for fantasy team: ${fantasyTeam.name} (${fantasyTeamId})`);

    // Pre-fetch all event data in parallel — one set of API calls per event, not per team
    const eventIds = eventConfig.eventIds;
    const [eventCaches, eventTeamCounts, divisionTeamsByEvent] = await Promise.all([
      Promise.all(eventIds.map(k => fetchEventCache(k))).then(caches =>
        Object.fromEntries(eventIds.map((k, i) => [k, caches[i]]))
      ),
      Promise.all(eventIds.map(k => getEventTeamCount(k))).then(counts =>
        Object.fromEntries(eventIds.map((k, i) => [k, counts[i]]))
      ),
      Promise.all(eventIds.map(k => getCachedDivisionTeams(k))).then(lists =>
        Object.fromEntries(eventIds.map((k, i) => [k, lists[i]]))
      ),
    ]);

    const teamScores: Record<number, TeamScoring> = {};

    for (const team of fantasyTeam.selectedTeams) {
      // Find Firestore-cached overrides for this team
      let cachedTeamData: any = null;
      for (const eventKey of eventIds) {
        const divisionTeams = divisionTeamsByEvent[eventKey];
        if (divisionTeams) {
          const found = divisionTeams.find((t: { team: number }) => t.team === team.teamNumber);
          if (found) {
            cachedTeamData = { ...found, name: team.teamName, division: eventKey };
            break;
          }
        }
      }

      // Pick the event where the team scores highest (lookup only, no extra API calls)
      let bestPerformance: TeamEventPerformance | null = null;
      let bestScore = 0;
      let defaultTotalTeams = 40;

      for (const eventKey of eventIds) {
        const cache = eventCaches[eventKey];
        const totalTeams = eventTeamCounts[eventKey];
        defaultTotalTeams = totalTeams;

        const performance = teamPerformanceFromCache(team.teamNumber, eventKey, cache);
        const scoring = calculateTeamPoints(performance, totalTeams);
        if (scoring.totalPoints > bestScore) {
          bestScore = scoring.totalPoints;
          bestPerformance = performance;
        }
      }

      const performance: TeamEventPerformance = bestPerformance ?? {
        teamNumber: team.teamNumber,
        teamName: team.teamName,
      };

      // Apply Firestore-cached overrides (manual corrections)
      if (cachedTeamData) {
        if (cachedTeamData.epa) performance.epa = cachedTeamData.epa;
        performance.teamName = team.teamName;
        if ((cachedTeamData.division_winner || cachedTeamData.first_place) && (!performance.rank || performance.rank > 1))
          performance.rank = 1;
        if (cachedTeamData.division_winner) {
          performance.eliminationStatus = 'won';
          performance.divisionChampion = true;
        }
        if (cachedTeamData.championship_winner) {
          performance.divisionChampion = true;
          performance.eliminationStatus = 'won';
          performance.championshipWinner = true;
        }
        if (cachedTeamData.championship_finalist && !cachedTeamData.championship_winner) {
          performance.divisionChampion = true;
          performance.eliminationStatus = 'won';
        }
        if (cachedTeamData.record) {
          const parts = cachedTeamData.record.split('-');
          if (parts.length >= 2) {
            performance.wins = parseInt(parts[0]) || 0;
            performance.losses = parseInt(parts[1]) || 0;
            if (parts.length > 2) performance.ties = parseInt(parts[2]) || 0;
          }
        }
      }

      // Fill in defaults for anything still missing
      if (!performance.rank) performance.rank = 10;
      if (!performance.wins) { performance.wins = 5; performance.losses = 3; }
      if (!performance.epa) performance.epa = 1400;

      const scoring = calculateTeamPoints(performance, defaultTotalTeams);
      scoring.teamName = team.teamName;
      teamScores[team.teamNumber] = scoring;
      console.log(`Score for team ${team.teamNumber}: ${scoring.totalPoints}`);
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
    const activeEvtForDebug = await getActiveEvent();
    const competitionStartTime = activeEvtForDebug?.competitionStartTime ?? FANTASY_CONFIG.competitionStartTime;
    if (now < competitionStartTime) {
      console.log(`Competition hasn't started yet. Returning hidden score in debug mode. Current time: ${new Date(now).toISOString()}, Start time: ${new Date(competitionStartTime).toISOString()}`);
      
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
    const eventKeys = activeEvtForDebug ? activeEvtForDebug.eventIds : FANTASY_CONFIG.eventIds;
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
    
    // Look in each event division — use active Firestore event or fall back to static config
    const activeEvt = await getActiveEvent();
    const divisionKeys = activeEvt ? activeEvt.eventIds : FANTASY_CONFIG.eventIds;
    for (const eventKey of divisionKeys) {
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

