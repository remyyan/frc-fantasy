import { NextResponse } from 'next/server';
import { FANTASY_CONFIG, TBA_API_BASE_URL, TBA_API_KEY, STATBOTICS_API_BASE_URL, FIRST_API_BASE_URL, FIRST_API_USERNAME, FIRST_API_TOKEN } from '@/app/utils/config';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/app/utils/firebase';

// Interface for FIRST API team data
interface FIRSTTeam {
  teamNumber: number;
  nameShort: string;
  nameFull: string;
  city: string;
  stateProv: string;
  country: string;
  rookieYear: number;
}

async function fetchTeamsFromFIRSTForDivision(eventKey: string) {
  console.log(`Fetching teams from FIRST API for division ${eventKey}`);
  
  // Extract year and event code from the event key
  // Example: For '2025oncmp1', the year is '2025' and the event code is 'ONCMP1'
  const year = eventKey.substring(0, 4);
  const eventCode = eventKey.substring(4).toUpperCase();
  
  try {
    // Use the FIRST API to get teams for this specific event key
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
    console.log(`FIRST API returned ${data.teams?.length || 0} teams for ${eventKey}`);
    
    if (!data.teams || !Array.isArray(data.teams) || data.teams.length === 0) {
      console.warn(`No teams found in FIRST API response for ${eventKey}`);
      throw new Error(`No teams found in FIRST API response for ${eventKey}`);
    }
    
    // Get team numbers from the FIRST API response
    const teamNumbers = data.teams.map((team: FIRSTTeam) => team.teamNumber);
    
    return { teamNumbers, teamsData: data.teams };
  } catch (error) {
    console.error(`Error fetching teams from FIRST API for ${eventKey}:`, error);
    throw error;
  }
}

async function fetchTeamsForDivision(eventKey: string) {
  console.log(`Fetching teams for division ${eventKey}`);
  
  // Try TBA first
  try {
    const response = await fetch(`${TBA_API_BASE_URL}/event/${eventKey}/teams`, {
      headers: {
        'X-TBA-Auth-Key': TBA_API_KEY
      }
    });
    
    // If TBA doesn't have data for this event, use FIRST API
    if (!response.ok || response.status === 404) {
      console.log(`TBA doesn't have data for ${eventKey}, using FIRST API instead`);
      return fetchTeamsFromFIRSTForDivision(eventKey);
    }
    
    const teamsData = await response.json();
    
    if (!Array.isArray(teamsData) || teamsData.length === 0) {
      console.log(`No teams found in TBA for ${eventKey}, using FIRST API instead`);
      return fetchTeamsFromFIRSTForDivision(eventKey);
    }
    
    console.log(`Fetched ${teamsData.length} teams from TBA for ${eventKey}`);
    
    // Extract team numbers
    const teamNumbers = teamsData.map(team => team.team_number);
    return { teamNumbers, teamsData };
  } catch (err) {
    console.log(`Error fetching from TBA for ${eventKey}, falling back to FIRST API:`, err);
    return fetchTeamsFromFIRSTForDivision(eventKey);
  }
}

async function fetchTeamEPABatch(teamNumbers: number[], teamsData: any[]) {
  const results = [];
  const batchSize = 10;
  const teamDataMap = new Map();
  
  // Create a map of team numbers to their full data from TBA
  teamsData.forEach(team => {
    teamDataMap.set(team.team_number, team);
  });
  
  // Process teams in parallel batches
  for (let i = 0; i < teamNumbers.length; i += batchSize) {
    const batchTeams = teamNumbers.slice(i, i + batchSize);
    console.log(`Processing EPA data for batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(teamNumbers.length/batchSize)}`);
    
    // Process this batch in parallel
    const promises = batchTeams.map(async (teamNumber) => {
      try {
        const response = await fetch(`${STATBOTICS_API_BASE_URL}/team/${teamNumber}`);
        
        if (!response.ok) {
          return createDefaultTeam(teamNumber, teamDataMap.get(teamNumber));
        }
        
        const data = await response.json();
        
        if (!data || !data.norm_epa) {
          return createDefaultTeam(teamNumber, teamDataMap.get(teamNumber));
        }
        
        // Get the best available EPA value
        const epaValue = data.norm_epa.current || data.norm_epa.recent || data.norm_epa.mean || 0;
        const cost = calculateTeamCost(epaValue);
        
        const tbaTeamData = teamDataMap.get(teamNumber);
        const teamName = data.name || (tbaTeamData ? tbaTeamData.nickname : `Team ${teamNumber}`);
        
        return {
          team: teamNumber,
          name: teamName,
          epa: epaValue,
          cost: cost,
          country: data.country,
          state: data.state,
          rookieYear: data.rookie_year
        };
      } catch (error) {
        console.error(`Error fetching EPA for team ${teamNumber}:`, error);
        return createDefaultTeam(teamNumber, teamDataMap.get(teamNumber));
      }
    });
    
    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
    
    // Add a small delay between batches
    if (i + batchSize < teamNumbers.length) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  // Sort by EPA (highest first)
  return results.sort((a, b) => (b.epa || 0) - (a.epa || 0));
}

// Create a default team with minimum data
function createDefaultTeam(teamNumber: number, tbaData: any) {
  const teamName = tbaData ? tbaData.nickname : `Team ${teamNumber}`;
  return {
    team: teamNumber,
    name: teamName,
    epa: 500, // Default EPA
    cost: 100 // Minimum cost
  };
}

// Calculate cost based on EPA
function calculateTeamCost(epa: number) {
  if (!epa || epa <= 0) {
    return 100; // Minimum cost for teams with no data
  }

  // Get the team's tier and multiplier
  const { multiplier } = getTeamTier(epa);
  
  // Base calculation - scale EPA to a reasonable range
  let baseCost = Math.round(epa / 3);
  
  // Apply exponential scaling for top teams using the tier multiplier
  // This makes the gap between top and average teams much larger
  const exponentialFactor = Math.pow(epa / 1000, 2) * multiplier;
  const adjustedCost = Math.round(baseCost * exponentialFactor);
  
  // Ensure cost is at least 100
  return Math.max(adjustedCost, 100);
}

// Get team tier (used for cost calculation)
function getTeamTier(epa: number) {
  if (epa >= 1800) return { tier: "S", multiplier: 5.0 };   // Elite teams
  if (epa >= 1650) return { tier: "A+", multiplier: 4.0 };  // Championship contenders
  if (epa >= 1500) return { tier: "A", multiplier: 3.0 };   // Division finalists
  if (epa >= 1350) return { tier: "B+", multiplier: 2.0 };  // Playoff teams
  if (epa >= 1200) return { tier: "B", multiplier: 1.5 };   // Strong teams
  if (epa >= 1050) return { tier: "C+", multiplier: 1.2 };  // Above average teams
  if (epa >= 900) return { tier: "C", multiplier: 1.0 };    // Average teams
  return { tier: "D", multiplier: 0.8 };                    // Below average teams
}

export async function POST() {
  try {
    let totalTeamsUpdated = 0;
    const divisionsUpdated = [];
    const hasDivisionSpecificData: Record<string, boolean> = {};

    // First pass: check if we have division-specific data
    for (const eventKey of FANTASY_CONFIG.eventIds) {
      if (eventKey.endsWith('1') || eventKey.endsWith('2')) {
        // Extract the base event code
        const baseEventKey = eventKey.substring(0, eventKey.length - 1);
        hasDivisionSpecificData[baseEventKey] = true;
      }
    }

    // Process each division from the config
    for (const eventKey of FANTASY_CONFIG.eventIds) {
      try {
        // Skip the general championship event if we have division-specific data
        if (!eventKey.endsWith('1') && !eventKey.endsWith('2')) {
          const isBaseEvent = Object.keys(hasDivisionSpecificData).includes(eventKey);
          if (isBaseEvent) {
            console.log(`Skipping base event ${eventKey} because division-specific data is available`);
            continue;
          }
        }
        
        // Fetch teams for this division
        const { teamNumbers, teamsData } = await fetchTeamsForDivision(eventKey);
        
        // Get EPA data
        const teamsWithEPA = await fetchTeamEPABatch(teamNumbers, teamsData);
        
        // Store in Firestore
        await setDoc(doc(db, 'divisions', eventKey), {
          teams: teamsWithEPA,
          lastUpdated: Date.now()
        });
        
        totalTeamsUpdated += teamsWithEPA.length;
        divisionsUpdated.push(eventKey);
        
        console.log(`Cached ${teamsWithEPA.length} teams for division ${eventKey}`);
      } catch (err) {
        console.error(`Error processing division ${eventKey}:`, err);
        // Continue with next division even if one fails
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Division teams cached successfully',
      teamsUpdated: totalTeamsUpdated,
      divisionsUpdated: divisionsUpdated.length
    });
  } catch (error) {
    console.error('Error caching division teams:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to cache division teams' },
      { status: 500 }
    );
  }
} 