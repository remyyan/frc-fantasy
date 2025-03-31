'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FANTASY_CONFIG } from '@/app/utils/config';
import { getCachedDivisionTeams } from '@/app/utils/firebase';

export default function TeamDetailClient({ teamNumber }: { teamNumber: string }) {
  const [team, setTeam] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
              setLoading(false);
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

  // Get the team's tier based on EPA
  function getTeamTier(epa: number) {
    if (epa >= 1800) return 'Elite';
    if (epa >= 1500) return 'Premier';
    if (epa >= 1200) return 'Competitive';
    return 'Standard';
  }

  // Get the division name from the key
  function getDivisionName(divisionKey: string) {
    const divisionMap: Record<string, string> = {
      '2024arc': 'Archimedes',
      '2024cur': 'Curie',
      '2024dal': 'Daly',
      '2024gal': 'Galileo',
      '2024hop': 'Hopper',
      '2024joh': 'Johnson',
      '2024mil': 'Milstein',
      '2024new': 'Newton',
    };
    return divisionMap[divisionKey] || divisionKey;
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
                
                {/* Division Card */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="bg-blue-500 text-white px-4 py-2">
                    <h4 className="font-medium">2024 Championship Division</h4>
                  </div>
                  <div className="p-4">
                    <div className="text-2xl font-bold text-center text-black">
                      {divisionName}
                    </div>
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
        </div>
      </div>
    </div>
  );
} 