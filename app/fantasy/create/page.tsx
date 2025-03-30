'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { FANTASY_CONFIG } from '@/app/utils/config';
import { TeamWithCost } from '@/app/utils/statbotics';
import { getTeamsForFantasyDraft } from '@/app/utils/teams';
import { createFantasyTeam } from '@/app/utils/firebase';

export default function CreateFantasyTeam() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [teamName, setTeamName] = useState('');
  const [availableTeams, setAvailableTeams] = useState<TeamWithCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'team' | 'name' | 'opr' | 'cost'>('opr');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Selected teams for this fantasy team
  const [selectedTeams, setSelectedTeams] = useState<TeamWithCost[]>([]);

  // Budget and team limit from configuration
  const totalBudget = FANTASY_CONFIG.totalBudget;
  const maxTeams = FANTASY_CONFIG.maxTeams;
  
  // Current budget used
  const budgetUsed = selectedTeams.reduce((total, team) => total + team.cost, 0);
  const budgetRemaining = totalBudget - budgetUsed;

  // Fetch teams on component mount
  useEffect(() => {
    async function fetchTeams() {
      try {
        console.log("Starting to fetch teams in create/page.tsx");
        setLoading(true);
        // Use the new function to get teams instead of using event IDs
        const teams = await getTeamsForFantasyDraft();
        console.log(`Received ${teams.length} teams from getTeamsForFantasyDraft`);
        
        if (teams.length === 0) {
          console.warn("No teams returned from getTeamsForFantasyDraft");
          setError('No teams found for the fantasy draft. Please try again later.');
        } else {
          console.log("Setting teams in state");
          setAvailableTeams(teams);
          setError(null);
        }
      } catch (err) {
        console.error('Error fetching teams:', err);
        setError('Failed to load teams. Please try again later.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchTeams();
  }, []);

  // Filter teams based on search query
  const filteredTeams = availableTeams.filter(team => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      team.team.toString().includes(query) ||
      team.name.toLowerCase().includes(query)
    );
  });

  // Sort teams
  const sortedTeams = [...filteredTeams].sort((a, b) => {
    if (sortBy === 'team') {
      return sortDirection === 'asc' ? a.team - b.team : b.team - a.team;
    } else if (sortBy === 'name') {
      return sortDirection === 'asc' 
        ? a.name.localeCompare(b.name) 
        : b.name.localeCompare(a.name);
    } else if (sortBy === 'opr') {
      return sortDirection === 'asc' ? a.opr - b.opr : b.opr - a.opr;
    } else if (sortBy === 'cost') {
      return sortDirection === 'asc' ? a.cost - b.cost : b.cost - a.cost;
    }
    return 0;
  });

  // Toggle sort column
  const toggleSort = (column: 'team' | 'name' | 'opr' | 'cost') => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
  };

  // Add a team to selection
  const addTeam = (team: TeamWithCost) => {
    // Check if team is already selected
    if (selectedTeams.some(t => t.team === team.team)) {
      return;
    }
    
    // Check if adding this team would exceed budget
    if (budgetUsed + team.cost > totalBudget) {
      setError(`Adding team ${team.team} would exceed your budget limit of ${totalBudget}`);
      return;
    }
    
    // Check if adding this team would exceed team limit
    if (selectedTeams.length >= maxTeams) {
      setError(`You can select a maximum of ${maxTeams} teams`);
      return;
    }
    
    setSelectedTeams([...selectedTeams, team]);
    setError(null);
  };

  // Remove a team from selection
  const removeTeam = (teamNumber: number) => {
    setSelectedTeams(selectedTeams.filter(team => team.team !== teamNumber));
    setError(null);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('You must be logged in to create a fantasy team');
      return;
    }
    
    if (!teamName.trim()) {
      setError('Please enter a team name');
      return;
    }
    
    if (selectedTeams.length === 0) {
      setError('Please select at least one team');
      return;
    }
    
    try {
      setLoading(true);
      
      // Create fantasy team in database
      const fantasyTeam = {
        name: teamName,
        userId: user.uid,
        userName: user.displayName || user.email?.split('@')[0] || 'Unknown User',
        selectedTeams: selectedTeams.map(team => ({
          teamNumber: team.team,
          teamName: team.name,
          cost: team.cost
        })),
        totalCost: budgetUsed,
        totalScore: 0, // Will be updated as events progress
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      const teamId = await createFantasyTeam(fantasyTeam);
      
      // Redirect to the created team page
      router.push(`/fantasy/${teamId}`);
    } catch (err) {
      console.error('Error creating fantasy team:', err);
      setError('Failed to create fantasy team. Please try again.');
      setLoading(false);
    }
  };

  // If auth is loading, show loading state
  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Loading...</h1>
      </div>
    );
  }

  // If user is not logged in, redirect to login
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Create Your Fantasy Team</h1>
        <p className="mb-4">Please log in to create a fantasy team.</p>
        <button 
          onClick={() => router.push('/login')}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4 text-black">Create Your Fantasy Team</h1>
      
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2 text-black">{FANTASY_CONFIG.eventName}</h2>
        <p className="text-gray-600">{FANTASY_CONFIG.eventDates} • {FANTASY_CONFIG.eventLocation}</p>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team Selection Panel */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-black">Select Teams</h2>
            
            {/* Search and Filter */}
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search teams by number or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded text-black"
              />
            </div>
            
            {/* Teams Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full bg-white">
                <thead>
                  <tr className="bg-gray-100 text-black">
                    <th className="py-2 px-4 cursor-pointer text-black" onClick={() => toggleSort('team')}>
                      Team # {sortBy === 'team' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="py-2 px-4 cursor-pointer text-black" onClick={() => toggleSort('name')}>
                      Team Name {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="py-2 px-4 cursor-pointer text-black" onClick={() => toggleSort('opr')}>
                      OPR {sortBy === 'opr' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="py-2 px-4 cursor-pointer text-black" onClick={() => toggleSort('cost')}>
                      Cost {sortBy === 'cost' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="py-2 px-4 text-black">Action</th>
                  </tr>
                </thead>
                <tbody className="text-black">
                  {sortedTeams.map(team => {
                    const isSelected = selectedTeams.some(t => t.team === team.team);
                    const canAfford = budgetRemaining >= team.cost;
                    const canAddMore = selectedTeams.length < maxTeams;
                    
                    return (
                      <tr key={team.team} className={isSelected ? 'bg-blue-50' : ''}>
                        <td className="py-2 px-4 border-t text-black">{team.team}</td>
                        <td className="py-2 px-4 border-t text-black">{team.name}</td>
                        <td className="py-2 px-4 border-t text-black">
                          {typeof team.opr === 'number' 
                            ? team.opr.toFixed(2) 
                            : '0.00'}
                        </td>
                        <td className="py-2 px-4 border-t text-black">${team.cost}</td>
                        <td className="py-2 px-4 border-t">
                          {isSelected ? (
                            <button
                              onClick={() => removeTeam(team.team)}
                              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                            >
                              Remove
                            </button>
                          ) : (
                            <button
                              onClick={() => addTeam(team)}
                              disabled={!canAfford || !canAddMore}
                              className={`px-3 py-1 rounded text-sm ${
                                canAfford && canAddMore
                                  ? 'bg-green-500 hover:bg-green-600 text-white'
                                  : 'bg-gray-300 cursor-not-allowed text-gray-700'
                              }`}
                            >
                              Add
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {sortedTeams.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center border-t text-black">
                        {loading ? 'Loading teams...' : 'No teams found matching your search'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        {/* Fantasy Team Summary Panel */}
        <div>
          <div className="bg-white rounded-lg shadow p-6 sticky top-4">
            <h2 className="text-xl font-semibold mb-4 text-black">Your Fantasy Team</h2>
            
            <form onSubmit={handleSubmit}>
              {/* Team Name Input */}
              <div className="mb-4">
                <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 mb-1 text-black">
                  Fantasy Team Name
                </label>
                <input
                  type="text"
                  id="teamName"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded text-black"
                  placeholder="Enter team name"
                  required
                />
              </div>
              
              {/* Creator Info - Display user's info */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1 text-black">
                  Creator
                </label>
                <div className="px-4 py-2 border border-gray-300 rounded bg-gray-50 text-black">
                  {user?.displayName || user?.email?.split('@')[0] || user?.uid || 'Unknown User'}
                </div>
              </div>
              
              {/* Budget Status */}
              <div className="mb-4">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700 text-black">Budget</span>
                  <span className="text-sm font-medium text-gray-700 text-black">
                    ${budgetUsed} / ${totalBudget}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className={`h-2.5 rounded-full ${
                      budgetUsed > totalBudget ? 'bg-red-600' : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.min(100, (budgetUsed / totalBudget) * 100)}%` }}
                  ></div>
                </div>
                <p className="text-sm mt-1 text-black">Remaining: ${budgetRemaining}</p>
              </div>
              
              {/* Team Count */}
              <div className="mb-4">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700 text-black">Teams</span>
                  <span className="text-sm font-medium text-gray-700 text-black">
                    {selectedTeams.length} / {maxTeams}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="bg-blue-600 h-2.5 rounded-full"
                    style={{ width: `${(selectedTeams.length / maxTeams) * 100}%` }}
                  ></div>
                </div>
              </div>
              
              {/* Selected Teams List */}
              <div className="mb-6">
                <h3 className="text-md font-medium mb-2 text-black">Selected Teams</h3>
                {selectedTeams.length === 0 ? (
                  <p className="text-gray-500 italic text-black">No teams selected yet</p>
                ) : (
                  <ul className="max-h-60 overflow-y-auto">
                    {selectedTeams.map(team => (
                      <li key={team.team} className="flex justify-between items-center py-2 border-b">
                        <div className="text-black">
                          <span className="font-medium">{team.team}</span> - {team.name}
                        </div>
                        <div className="flex items-center">
                          <span className="text-black mr-3">${team.cost}</span>
                          <button
                            type="button"
                            onClick={() => removeTeam(team.team)}
                            className="text-red-500 hover:text-red-700"
                          >
                            ✕
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              
              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || selectedTeams.length === 0 || !teamName.trim()}
                className={`w-full py-2 rounded font-medium ${
                  loading || selectedTeams.length === 0 || !teamName.trim()
                    ? 'bg-gray-300 text-gray-700 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                {loading ? 'Creating...' : 'Create Fantasy Team'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
} 