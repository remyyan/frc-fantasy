'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchTeamEPA, calculateTeamCost } from '@/app/utils/tbaStats';
import { TOP_TEAMS_OPR } from '@/app/utils/tbaStats';
import { TeamStats } from '@/app/utils/tbaStats';

export default function TeamDetailPage({ params }: { params: { teamNumber: string } }) {
  const { teamNumber } = params;
  const [team, setTeam] = useState<TeamStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTeamData() {
      try {
        setLoading(true);
        const teamData = await fetchTeamEPA(parseInt(teamNumber));
        setTeam(teamData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching team data:', err);
        setError('Failed to load team data. Please try again later.');
        setLoading(false);
      }
    }
    
    fetchTeamData();
  }, [teamNumber]);

  // Get the team's tier based on OPR
  function getTeamTier(opr: number) {
    if (opr >= 9) {
      return 'Elite';
    } else if (opr >= 7) {
      return 'Premier';
    } else if (opr >= 5) {
      return 'Competitive';
    } else {
      return 'Standard';
    }
  }

  // Calculate the cost tier for the team
  function calculateCostTier(opr: number) {
    const cost = calculateTeamCost(opr);
    if (cost >= 800) {
      return 'High';
    } else if (cost >= 500) {
      return 'Medium';
    } else {
      return 'Low';
    }
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
          {error || 'Team not found.'}
        </div>
        <Link 
          href="/teams"
          className="text-blue-500 hover:text-blue-700 font-medium"
        >
          ← Back to Teams
        </Link>
      </div>
    );
  }

  const teamTier = getTeamTier(team.opr || 0);
  const costTier = calculateCostTier(team.opr || 0);
  const teamCost = calculateTeamCost(team.opr || 0);

  return (
    <div className="container mx-auto px-4 py-8">
      <Link 
        href="/teams"
        className="text-blue-500 hover:text-blue-700 font-medium inline-flex items-center mb-6"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
        Back to Teams
      </Link>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-black">Team {teamNumber}</h1>
              <h2 className="text-xl text-gray-700 mt-1">{team.name}</h2>
            </div>
            <div className="flex flex-col items-end">
              <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-medium text-sm">
                {teamTier} Tier
              </div>
              <div className="mt-2 bg-green-100 text-green-800 px-3 py-1 rounded-full font-medium text-sm">
                {costTier}
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-4 text-black">Team Statistics</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <dl className="space-y-4">
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Rating (EPA)</dt>
                    <dd className="font-semibold text-black">{team.opr?.toFixed(2) || 'N/A'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-600">Fantasy Cost</dt>
                    <dd className="font-semibold text-black">${(teamCost / 100).toFixed(2)}</dd>
                  </div>
                  
                  {team.epa && (
                    <div className="pt-2 border-t">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">EPA Details</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex justify-between">
                          <dt className="text-gray-600">Current</dt>
                          <dd className="font-semibold text-black">{team.epa.current?.toFixed(2) || 'N/A'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-600">Recent</dt>
                          <dd className="font-semibold text-black">{team.epa.recent?.toFixed(2) || 'N/A'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-600">Mean</dt>
                          <dd className="font-semibold text-black">{team.epa.mean?.toFixed(2) || 'N/A'}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-600">Max</dt>
                          <dd className="font-semibold text-black">{team.epa.max?.toFixed(2) || 'N/A'}</dd>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {team.auto && team.teleop && (
                    <>
                      <div className="pt-2 border-t">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Performance Breakdown</h4>
                        <div className="flex justify-between">
                          <dt className="text-gray-600">Auto</dt>
                          <dd className="font-semibold text-black">{team.auto.toFixed(2)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-600">Teleop</dt>
                          <dd className="font-semibold text-black">{team.teleop.toFixed(2)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-gray-600">Endgame</dt>
                          <dd className="font-semibold text-black">{team.endgame?.toFixed(2) || 'N/A'}</dd>
                        </div>
                      </div>
                    </>
                  )}
                </dl>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold mb-4 text-black">Team Information</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-4">
                  Team {teamNumber} ({team.name}) is an FRC team that competes in the FIRST Robotics Competition.
                  {teamTier !== 'Standard' && ` They are considered a ${teamTier} tier team based on their performance data.`}
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
                
                <p className="text-sm text-gray-600">
                  In fantasy competitions, teams are assigned costs based on their historical performance.
                  Team {teamNumber} costs ${(teamCost / 100).toFixed(2)} in our fantasy draft.
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-6">
            <div className="flex justify-center mt-8">
              <Link 
                href="/fantasy/create"
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded font-medium inline-flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 mr-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add to Fantasy Team
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 