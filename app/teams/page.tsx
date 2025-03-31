'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getTeamsForFantasyDraft, calculateTeamCost } from '@/app/utils/tbaStats';
import { TeamWithCost } from '@/app/utils/tbaStats';

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamWithCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchTeams() {
      try {
        setLoading(true);
        const fetchedTeams = await getTeamsForFantasyDraft();
        
        // Sort by team number for easier browsing
        fetchedTeams.sort((a, b) => a.team - b.team);
        
        setTeams(fetchedTeams);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching teams:', err);
        setError('Failed to load teams. Please try again later.');
        setLoading(false);
      }
    }
    
    fetchTeams();
  }, []);

  // Filter teams based on search term
  const filteredTeams = teams.filter(team => {
    const searchLower = searchTerm.toLowerCase();
    return (
      team.team.toString().includes(searchTerm) ||
      team.name.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">FRC Teams</h1>
      
      {/* Search Bar */}
      <div className="mb-6">
        <div className="flex max-w-md">
          <input
            type="text"
            placeholder="Search by team number or name..."
            className="flex-grow px-4 py-2 border border-gray-300 rounded-l focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="bg-gray-200 px-4 py-2 rounded-r hover:bg-gray-300"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : filteredTeams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredTeams.map((team) => (
            <Link key={team.team} href={`/teams/${team.team}`}>
              <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 cursor-pointer text-black">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-xl font-bold">Team {team.team}</h2>
                  <div className="text-sm font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    ${(calculateTeamCost(team.opr) / 100).toFixed(2)}
                  </div>
                </div>
                <h3 className="font-medium mb-2">{team.name}</h3>
                <div className="mt-4 text-sm text-gray-600">
                  <div className="flex justify-between mb-1">
                    <span>EPA Rating:</span>
                    <span className="font-medium">{team.opr.toFixed(2)}</span>
                  </div>
                  {team.epa?.current && (
                    <div className="flex justify-between mb-1">
                      <span>Current EPA:</span>
                      <span className="font-medium">{team.epa.current.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-600">
            {searchTerm ? 'No teams found matching your search criteria.' : 'No teams available.'}
          </p>
        </div>
      )}
    </div>
  );
} 