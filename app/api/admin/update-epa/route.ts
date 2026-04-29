import { NextResponse } from 'next/server';
import { STATBOTICS_API_BASE_URL } from '@/app/utils/config';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, getActiveEvent } from '@/app/utils/firebase';

/**
 * Updates the EPA cache with the latest data from Statbotics
 */
export async function POST() {
  try {
    console.log('Starting EPA cache update...');
    const allTeams = new Set<number>();
    let teamsUpdated = 0;

    // Resolve event keys from the active event in Firestore
    const activeEvent = await getActiveEvent();
    if (!activeEvent || !activeEvent.eventIds || activeEvent.eventIds.length === 0) {
      return NextResponse.json({ success: false, message: 'No active event configured' }, { status: 400 });
    }
    const eventIds = activeEvent.eventIds;
    console.log(`Updating EPA for active event: ${activeEvent.eventName} (${eventIds.join(', ')})`);

    for (const eventKey of eventIds) {
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
          
          // Calculate the updated live EPA value
          const epaValue = data.norm_epa.current || data.norm_epa.recent || data.norm_epa.mean || 0;

          // Update this team in all divisions where it appears
          for (const eventKey of eventIds) {
            try {
              const divisionDocRef = doc(db, 'divisions', eventKey);
              const divisionDoc = await getDoc(divisionDocRef);
              
              if (divisionDoc.exists()) {
                const divisionData = divisionDoc.data();
                
                if (divisionData.teams && Array.isArray(divisionData.teams)) {
                  let updated = false;
                  
                  // Update the team in the array.
                  // We update the live `epa` but preserve `initialEpa` and
                  // `cost` so that prices stay locked to the event-start snapshot.
                  const updatedTeams = divisionData.teams.map((team: any) => {
                    if (team.team === teamNumber) {
                      updated = true;
                      return {
                        ...team,
                        epa: epaValue,                          // live/current EPA (for scoring & trend)
                        initialEpa: team.initialEpa ?? team.epa, // preserve initial; back-fill if missing
                        cost: team.cost,                        // price never changes after initial cache
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

