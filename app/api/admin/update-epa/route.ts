import { NextResponse } from 'next/server';
import { STATBOTICS_API_BASE_URL, FANTASY_CONFIG } from '@/app/utils/config';
import { doc, setDoc, getDoc, getFirestore } from 'firebase/firestore';
import { db } from '@/app/utils/firebase';

/**
 * Updates the EPA cache with the latest data from Statbotics
 */
export async function POST() {
  try {
    console.log('Starting EPA cache update...');
    const allTeams = new Set<number>();
    let teamsUpdated = 0;
    
    // First gather all team numbers from existing divisions
    const db = getFirestore();
    
    for (const eventKey of FANTASY_CONFIG.eventIds) {
      try {
        console.log(`Fetching teams from division ${eventKey}`);
        const divisionDocRef = doc(db, 'divisions', eventKey);
        const divisionDoc = await getDoc(divisionDocRef);
        
        if (divisionDoc.exists()) {
          const divisionData = divisionDoc.data();
          
          if (divisionData.teams && Array.isArray(divisionData.teams)) {
            divisionData.teams.forEach((team: any) => {
              if (team.team) {
                allTeams.add(team.team);
              }
            });
          }
        }
      } catch (error) {
        console.error(`Error fetching teams from division ${eventKey}:`, error);
        // Continue to next division
      }
    }
    
    const teamNumbers = Array.from(allTeams);
    console.log(`Found ${teamNumbers.length} unique teams to update`);
    
    // Process teams in batches
    const batchSize = 10;
    for (let i = 0; i < teamNumbers.length; i += batchSize) {
      const batchTeams = teamNumbers.slice(i, i + batchSize);
      console.log(`Processing EPA update for batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(teamNumbers.length/batchSize)}`);
      
      // Update this batch in parallel
      const updatePromises = batchTeams.map(async (teamNumber) => {
        try {
          // Fetch the latest EPA data from Statbotics
          const response = await fetch(`${STATBOTICS_API_BASE_URL}/team/${teamNumber}`);
          
          if (!response.ok) {
            console.error(`Error fetching EPA for team ${teamNumber}: ${response.status} ${response.statusText}`);
            return false;
          }
          
          // Check content-length header to see if the response is valid
          const contentLength = response.headers.get('content-length');
          if (contentLength && parseInt(contentLength) < 10) {
            console.error(`Empty or invalid response for team ${teamNumber} (content length: ${contentLength})`);
            return false;
          }
          
          // Parse the response carefully to avoid JSON parse errors
          const text = await response.text();
          
          // Check if the response is empty or not valid JSON
          if (!text || text.trim() === '') {
            console.error(`Empty response for team ${teamNumber}`);
            return false;
          }
          
          let data;
          try {
            data = JSON.parse(text);
          } catch (jsonError) {
            console.error(`JSON parse error for team ${teamNumber}: ${jsonError}`, text);
            return false;
          }
          
          if (!data || !data.norm_epa) {
            console.warn(`No norm_epa data for team ${teamNumber}`);
            return false;
          }
          
          // Calculate the updated EPA values
          const epaValue = data.norm_epa.current || data.norm_epa.recent || data.norm_epa.mean || 0;
          const cost = calculateTeamCost(epaValue);
          
          // Update this team in all divisions where it appears
          for (const eventKey of FANTASY_CONFIG.eventIds) {
            try {
              const divisionDocRef = doc(db, 'divisions', eventKey);
              const divisionDoc = await getDoc(divisionDocRef);
              
              if (divisionDoc.exists()) {
                const divisionData = divisionDoc.data();
                
                if (divisionData.teams && Array.isArray(divisionData.teams)) {
                  let updated = false;
                  
                  // Update the team in the array
                  const updatedTeams = divisionData.teams.map((team: any) => {
                    if (team.team === teamNumber) {
                      updated = true;
                      return {
                        ...team,
                        epa: epaValue,
                        cost: cost,
                        country: data.country || team.country,
                        state: data.state || team.state,
                        rookieYear: data.rookie_year || team.rookieYear
                      };
                    }
                    return team;
                  });
                  
                  if (updated) {
                    // Save the updated team data
                    await setDoc(divisionDocRef, {
                      teams: updatedTeams,
                      lastUpdated: Date.now()
                    });
                  }
                }
              }
            } catch (updateError) {
              console.error(`Error updating team ${teamNumber} in division ${eventKey}:`, updateError);
            }
          }
          
          return true;
        } catch (error) {
          console.error(`Error processing team ${teamNumber}:`, error);
          return false;
        }
      });
      
      const batchResults = await Promise.all(updatePromises);
      const successfulUpdates = batchResults.filter(result => result).length;
      teamsUpdated += successfulUpdates;
      
      // Add a small delay between batches to avoid rate limiting
      if (i + batchSize < teamNumbers.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    console.log(`EPA cache update complete. Updated ${teamsUpdated} teams.`);
    
    return NextResponse.json({ 
      success: true, 
      teamsUpdated 
    });
  } catch (error) {
    console.error('Error updating EPA cache:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'Failed to update EPA cache' },
      { status: 500 }
    );
  }
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