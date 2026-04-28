'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FANTASY_CONFIG } from '@/app/utils/config';
import { getCachedDivisionTeams, calculateTeamRosterPercentages } from '@/app/utils/firebase';
import { EVENT_NAME_MAP } from '@/app/utils/globals';
import { debugTeamScore } from '@/app/utils/scoring';
import { useEvent } from '@/app/contexts/EventContext';

export default function TeamDetailClient({ teamNumber }: { teamNumber: string }) {
  const { activeEvent } = useEvent();
  const [team, setTeam] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [scoreBreakdown, setScoreBreakdown] = useState<any | null>(null);
  const [eventPerformance, setEventPerformance] = useState<any | null>(null);
  const [rosterPercentage, setRosterPercentage] = useState<number | null>(null);

  useEffect(() => {
    async function fetchTeamData() {
      try {
        setLoading(true);
        
        // Go through all divisions to find the team
        for (const eventKey of FANTASY_CONFIG.eventIds) {
          const divisionTeams = await getCachedDivisionTeams(eventKey);
          
          if (divisionTeams) {
            const foundTeam = divisionTeams.find(t => t.team === parseInt(teamNumber));
            
            if (foundTeam) {
              // Add the division to the team data
              setTeam({
                ...foundTeam,
                division: eventKey
              });
              
              // Fetch the roster percentage, scoped to the active event
              const percentages = await calculateTeamRosterPercentages(activeEvent?.id);
              const percentage = percentages[parseInt(teamNumber)] || 0;
              setRosterPercentage(percentage);
              
              setLoading(false);
              
              // Now that we have the team, fetch the score
              fetchTeamScore(parseInt(teamNumber), foundTeam);
              return;
            }
          }
        }
        
        // If we get here, the team wasn't found in any division
        setError(`Team ${teamNumber} not found in any division.`);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching team data:', err);
        setError('Failed to load team data. Please try again later.');
        setLoading(false);
      }
    }
    
    fetchTeamData();
  }, [teamNumber]);

  // Function to fetch team score
  async function fetchTeamScore(teamNum: number, cachedData: any) {
    try {
      setScoreLoading(true);
      setScoreError(null);
      
      // No special handling for any team - use the cached team data directly
      const result = await debugTeamScore(teamNum, cachedData);
      
      console.log("Score breakdown result:", result);
      console.log("Event performance:", result.eventPerformance);
      console.log("Championship points:", result.breakdown.championshipPoints);
      
      setScoreBreakdown(result);
      setEventPerformance(result.eventPerformance);
      setScoreLoading(false);
    } catch (error) {
      console.error('Error calculating team score:', error);
      setScoreError(`Error calculating score: ${error instanceof Error ? error.message : String(error)}`);
      setScoreLoading(false);
    }
  }

  // Get the team's tier based on EPA
  function getTeamTier(epa: number) {
    if (epa >= 1800) return 'Elite';
    if (epa >= 1500) return 'Premier';
    if (epa >= 1200) return 'Competitive';
    return 'Standard';
  }

  // Get the division name from the key
  function getDivisionName(divisionKey: string) {
    return EVENT_NAME_MAP[divisionKey] || divisionKey;
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error || 'Team not found'}
        </div>
        <Link href="/teams" className="text-blue-500 hover:underline">
          ← Back to Teams
        </Link>
      </div>
    );
  }

  const teamTier = getTeamTier(team.epa);
  const divisionName = getDivisionName(team.division);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-4">
        <Link href="/teams" className="text-blue-500 hover:underline">
          ← Back to Teams
        </Link>
      </div>
      
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Team Header */}
        <div className="bg-blue-600 text-white p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
            <div>
              <h1 className="text-3xl font-bold">Team {teamNumber}</h1>
              <h2 className="text-xl opacity-90 mt-1">{team.name}</h2>
            </div>
            <div className="mt-4 md:mt-0 bg-white text-blue-700 rounded-full px-4 py-2 font-bold">
              ${team.cost}
            </div>
          </div>
        </div>
        
        {/* Team Data */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Stats Panel */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-black">Team Stats</h3>
              <div className="bg-gray-50 rounded-lg p-6">
                {/* EPA Card */}
                <div className="bg-white rounded-lg shadow mb-6 overflow-hidden">
                  <div className="bg-green-500 text-white px-4 py-2">
                    <h4 className="font-medium">EPA Rating</h4>
                  </div>
                  <div className="p-4">
                    <div className="text-4xl font-bold text-center text-black">
                      {Math.round(team.epa)}
                    </div>
                  </div>
                </div>
                
                {/* Score Card - New Section */}
                {scoreBreakdown && (
                  <div className="bg-white rounded-lg shadow mb-6 overflow-hidden">
                    <div className="bg-blue-500 text-white px-4 py-2">
                      <h4 className="font-medium">Fantasy Score</h4>
                    </div>
                    <div className="p-4">
                      {scoreBreakdown.totalPoints === -1 ? (
                        <div className="text-center text-gray-600">
                          <p className="font-semibold">Hidden until competition starts</p>
                          <p className="text-xs mt-1">Scores will be visible on {new Date(FANTASY_CONFIG.competitionStartTime).toLocaleDateString()} at {new Date(FANTASY_CONFIG.competitionStartTime).toLocaleTimeString()}</p>
                        </div>
                      ) : (
                        <div className="text-4xl font-bold text-center text-black">
                          {Math.round(scoreBreakdown.totalPoints)}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Division Card */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="bg-blue-500 text-white px-4 py-2">
                    <h4 className="font-medium">Division</h4>
                  </div>
                  <div className="p-4">
                    <div className="text-2xl font-bold text-center text-black">
                      {divisionName}
                    </div>
                  </div>
                </div>
                
                {/* Roster Percentage Card */}
                <div className="bg-white rounded-lg shadow overflow-hidden mt-6">
                  <div className="bg-purple-500 text-white px-4 py-2">
                    <h4 className="font-medium">Roster %</h4>
                  </div>
                  <div className="p-4">
                    <div className="text-2xl font-bold text-center text-black">
                      {rosterPercentage !== null ? `${rosterPercentage}%` : 'Loading...'}
                    </div>
                    <p className="text-xs text-gray-600 text-center mt-1">
                      Percentage of fantasy teams that have drafted this team
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4 text-black">Team Information</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-4">
                  Team {teamNumber} ({team.name}) is an FRC team that competes in the FIRST Robotics Competition.
                </p>
                
                {(team.rookieYear || team.country || team.state) && (
                  <div className="mb-4 border-b pb-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">Team Details</h4>
                    <dl className="space-y-2">
                      {team.rookieYear && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600">Rookie Year</dt>
                          <dd className="font-semibold text-black">{team.rookieYear}</dd>
                        </div>
                      )}
                      {team.country && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600">Country</dt>
                          <dd className="font-semibold text-black">{team.country}</dd>
                        </div>
                      )}
                      {team.state && (
                        <div className="flex justify-between">
                          <dt className="text-gray-600">State/Province</dt>
                          <dd className="font-semibold text-black">{team.state}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                )}
                
          
                
                <div className="text-center mt-6">
                  <a 
                    href={`https://www.thebluealliance.com/team/${teamNumber}/2024`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline flex items-center justify-center"
                  >
                    <span>View on The Blue Alliance</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          </div>
          
          {/* Performance Data - Simplified Section */}
          {eventPerformance && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold mb-4 text-black">Performance Details</h3>
              <div className="bg-gray-50 rounded-lg p-6">
                {Date.now() < FANTASY_CONFIG.competitionStartTime ? (
                  <div className="text-center text-gray-600 p-4">
                    <p className="font-semibold">Performance details are hidden until the competition starts</p>
                    <p className="text-sm mt-1">Details will be visible on {new Date(FANTASY_CONFIG.competitionStartTime).toLocaleDateString()} at {new Date(FANTASY_CONFIG.competitionStartTime).toLocaleTimeString()}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {eventPerformance.rank && (
                      <div className="bg-white p-4 rounded shadow">
                        <div className="font-medium text-gray-700 mb-1">Qualification Rank</div>
                        <div className="text-xl font-bold text-black">{eventPerformance.rank}</div>
                      </div>
                    )}
                    
                    {eventPerformance.epa && (
                      <div className="bg-white p-4 rounded shadow">
                        <div className="font-medium text-gray-700 mb-1">EPA</div>
                        <div className="text-xl font-bold text-black">{Math.round(eventPerformance.epa)}</div>
                      </div>
                    )}
                    
                    {eventPerformance.wins !== undefined && eventPerformance.losses !== undefined && (
                      <div className="bg-white p-4 rounded shadow">
                        <div className="font-medium text-gray-700 mb-1">Record</div>
                        <div className="text-xl font-bold text-black">
                          {eventPerformance.wins}-{eventPerformance.losses}
                          {eventPerformance.ties ? `-${eventPerformance.ties}` : ''}
                        </div>
                      </div>
                    )}
                    
                    {eventPerformance.eliminationStatus && (
                      <div className="bg-white p-4 rounded shadow">
                        <div className="font-medium text-gray-700 mb-1">Elimination Status</div>
                        <div className="text-xl font-bold text-black capitalize">
                          {eventPerformance.eliminationStatus}
                        </div>
                      </div>
                    )}
                    
                    {eventPerformance.championshipWinner && (
                      <div className="bg-white p-4 rounded shadow bg-orange-50">
                        <div className="font-medium text-orange-800 mb-1">Championship Winner</div>
                        <div className="text-xl font-bold text-black">Yes</div>
                      </div>
                    )}
                    
                    {/* Show Championship Finalist for division champions who didn't win the championship */}
                    {/* {eventPerformance.divisionChampion && !eventPerformance.championshipWinner && (
                      <div className="bg-white p-4 rounded shadow bg-blue-50">
                        <div className="font-medium text-blue-800 mb-1">Championship Finalist</div>
                        <div className="text-xl font-bold text-black">Yes</div>
                      </div>
                    )} */}

                    {/* Points Breakdown Section */}
                    {scoreBreakdown && scoreBreakdown.breakdown && (
                      <div className="bg-white p-4 rounded shadow col-span-1 md:col-span-2 mt-4">
                        <div className="font-medium text-gray-700 mb-3">Points Breakdown</div>
                        <div className="grid grid-cols-2 gap-2">
                          {scoreBreakdown.breakdown.rankingPoints > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Ranking Points:</span>
                              <span className="font-semibold">{Math.round(scoreBreakdown.breakdown.rankingPoints)}</span>
                            </div>
                          )}
                          {scoreBreakdown.breakdown.winPoints > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Win Points:</span>
                              <span className="font-semibold">{Math.round(scoreBreakdown.breakdown.winPoints)}</span>
                            </div>
                          )}
                          {scoreBreakdown.breakdown.statPoints > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">EPA Points:</span>
                              <span className="font-semibold">{Math.round(scoreBreakdown.breakdown.statPoints)}</span>
                            </div>
                          )}
                          {scoreBreakdown.breakdown.eliminationPoints > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Elimination Points:</span>
                              <span className="font-semibold">{Math.round(scoreBreakdown.breakdown.eliminationPoints)}</span>
                            </div>
                          )}
                          {scoreBreakdown.breakdown.championshipPoints > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Championship Points:</span>
                              <span className="font-semibold">{Math.round(scoreBreakdown.breakdown.championshipPoints)}</span>
                            </div>
                          )}
                          {/* {scoreBreakdown.breakdown.awardPoints > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">Award Points:</span>
                              <span className="font-semibold">{Math.round(scoreBreakdown.breakdown.awardPoints)}</span>
                            </div>
                          )} */}
                          <div className="flex justify-between items-center col-span-2 border-t pt-2 mt-2">
                            <span className="text-gray-700 font-semibold">Total Points:</span>
                            <span className="font-bold text-lg">{Math.round(scoreBreakdown.totalPoints)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 