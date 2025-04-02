import { NextRequest, NextResponse } from 'next/server';
import { getAllFantasyTeams, getFantasyTeam } from '@/app/utils/firebase';
import { calculateFantasyTeamScore } from '@/app/utils/scoring';

/**
 * API Route to recalculate scores for fantasy teams with full breakdowns 
 * This can be called with ?teamId=xxx to recalculate a specific team
 * Or with no query parameters to recalculate all teams
 */
export async function GET(request: NextRequest) {
  try {
    // Check if we're recalculating a specific team
    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');
    
    // If teamId is provided, recalculate just that team
    if (teamId) {
      console.log(`Recalculating scores for team ${teamId}`);
      
      // Verify team exists
      const team = await getFantasyTeam(teamId);
      if (!team) {
        return NextResponse.json({ 
          success: false, 
          error: `Team ${teamId} not found` 
        }, { status: 404 });
      }
      
      // Calculate the score using the full breakdown with all points components
      const score = await calculateFantasyTeamScore(teamId);
      
      return NextResponse.json({ 
        success: true, 
        message: `Successfully recalculated score for team ${teamId} with full breakdown`,
        score,
        teamId
      });
    } 
    // Otherwise recalculate all teams
    else {
      console.log('Recalculating scores for all teams with full breakdown');
      
      // Get all teams
      const teams = await getAllFantasyTeams();
      if (!teams.length) {
        return NextResponse.json({ 
          success: false, 
          error: 'No teams found' 
        }, { status: 404 });
      }
      
      // Process teams in smaller batches to avoid overwhelming the API
      const batchSize = 3;
      const processedTeams = [];
      
      for (let i = 0; i < teams.length; i += batchSize) {
        const batch = teams.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(teams.length / batchSize)}`);
        
        // Process each team in the batch sequentially to avoid rate limits
        for (const team of batch) {
          if (team.id) {
            try {
              console.log(`Recalculating score for ${team.name} (${team.id})`);
              const score = await calculateFantasyTeamScore(team.id);
              processedTeams.push({
                teamId: team.id,
                teamName: team.name,
                success: true,
                score
              });
            } catch (error) {
              console.error(`Error calculating score for team ${team.id}:`, error);
              processedTeams.push({
                teamId: team.id,
                teamName: team.name,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }
        }
        
        // Add a small delay between batches
        if (i + batchSize < teams.length) {
          console.log('Waiting 2 seconds before processing next batch...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        message: `Successfully processed ${processedTeams.length} teams with full breakdown`,
        results: processedTeams
      });
    }
  } catch (error) {
    console.error('Error recalculating scores:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 