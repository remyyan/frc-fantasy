'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { FANTASY_CONFIG } from '@/app/utils/config';
import { TeamWithCost } from '@/app/utils/statbotics';
import { createFantasyTeam, updateFantasyTeam, getCachedDivisionTeams, hasCachedDivision, getFantasyTeamsByUser, getFantasyTeam } from '@/app/utils/firebase';
import { TBA_API_BASE_URL, TBA_API_KEY, STATBOTICS_API_BASE_URL } from '@/app/utils/config';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EVENT_NAME_MAP } from '@/app/utils/globals';
import Link from 'next/link';

interface DivisionTabProps {
  eventKey: string;
  label: string;
  isSelected: boolean;
  onSelect: () => void;
}

// Wrapped component with search params access
function CreateFantasyTeamWithParams() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editTeamId = searchParams.get('edit');
  const { user, loading: authLoading } = useAuth();
  
  const [teamName, setTeamName] = useState('');
  const [selectedDivision, setSelectedDivision] = useState(FANTASY_CONFIG.eventIds[0]);
  const [divisionTeams, setDivisionTeams] = useState<Record<string, TeamWithCost[]>>({});
  const [divisionsLoaded, setDivisionsLoaded] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'team' | 'name' | 'epa' | 'cost'>('epa');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Selected teams for this fantasy team
  const [selectedTeams, setSelectedTeams] = useState<TeamWithCost[]>([]);
  const [hasExistingTeam, setHasExistingTeam] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [originalTeam, setOriginalTeam] = useState<any>(null);

  // Budget and team limit from configuration
  const totalBudget = FANTASY_CONFIG.budget;
  const maxTeams = FANTASY_CONFIG.maxTeams;
  
  // Current budget used
  const budgetUsed = selectedTeams.reduce((total, team) => total + team.cost, 0);
  const budgetRemaining = totalBudget - budgetUsed;

  // Load the team being edited if edit parameter is provided
  useEffect(() => {
    async function loadTeamForEditing() {
      if (editTeamId && user) {
        try {
          setLoading(true);
          const teamData = await getFantasyTeam(editTeamId);
          
          if (!teamData) {
            setError('Fantasy team not found');
            setLoading(false);
            return;
          }
          
          // Check if the user is the owner of the team
          if (teamData.userId !== user.uid) {
            setError('You do not have permission to edit this team');
            setLoading(false);
            return;
          }
          
          setOriginalTeam(teamData);
          setTeamName(teamData.name);
          setIsEditing(true);
          
          // Convert selectedTeams to the format expected by our component
          if (teamData.selectedTeams) {
            const convertedTeams = teamData.selectedTeams.map((team: any) => ({
              team: team.teamNumber,
              name: team.teamName,
              cost: team.cost,
              // Add other properties if available
              epa: 0, // Default value since we don't have this in the stored data
            }));
            
            setSelectedTeams(convertedTeams);
          }
          
          setLoading(false);
          // Bypass the existing team check when editing
          setHasExistingTeam(false);
        } catch (err) {
          console.error('Error fetching fantasy team:', err);
          setError('Failed to load fantasy team for editing');
          setLoading(false);
        }
      }
    }
    
    if (!authLoading && user && editTeamId) {
      loadTeamForEditing();
    }
  }, [editTeamId, user, authLoading]);

  // Check if user already has a fantasy team when component loads - only check if not in edit mode
  useEffect(() => {
    async function checkExistingTeam() {
      if (user && !editTeamId) {
        try {
          // Check if the user is an admin
          const isAdmin = user.email === 'remyan.yc@gmail.com';
          // Skip the check for admins
          if (isAdmin) {
            return;
          }
          
          const userTeams = await getFantasyTeamsByUser(user.uid);
          if (userTeams.length > 0) {
            setHasExistingTeam(true);
            setError('You already have a fantasy team and cannot create another one.');
          }
        } catch (err) {
          console.error('Error checking user teams:', err);
        }
      }
    }
    
    if (!authLoading && user && !isEditing) {
      checkExistingTeam();
    }
  }, [user, authLoading, editTeamId, isEditing]);

  // Fetch teams for a specific division
  async function fetchTeamsForDivision(eventKey: string) {
    if (divisionsLoaded.includes(eventKey)) {
      console.log(`Division ${EVENT_NAME_MAP[eventKey]} already loaded`);
      return;
    }

    try {
      setLoading(true);
      console.log(`Loading teams for division ${EVENT_NAME_MAP[eventKey]}`);
      
      // Check for cached data in Firebase first
      const hasCached = await hasCachedDivision(eventKey);
      
      if (hasCached) {
        console.log(`Using cached data for division ${EVENT_NAME_MAP[eventKey]}`);
        const cachedTeams = await getCachedDivisionTeams(eventKey);
        
        if (cachedTeams && cachedTeams.length > 0) {
          // Store the teams for this division
          setDivisionTeams(prev => ({
            ...prev,
            [eventKey]: cachedTeams
          }));
          
          // Mark this division as loaded
          setDivisionsLoaded(prev => [...prev, eventKey]);
          setError(null);
          setLoading(false);
          return;
        }
      }
      
      // If no cached data, fetch from TBA and Statbotics
      console.log(`No cached data for ${EVENT_NAME_MAP[eventKey]}, fetching from API`);
      
      // Fetch teams from TBA for this division
      const response = await fetch(`${TBA_API_BASE_URL}/event/${eventKey}/teams`, {
        headers: {
          'X-TBA-Auth-Key': TBA_API_KEY
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch teams for division ${EVENT_NAME_MAP[eventKey]}`);
      }
      
      const teamsData = await response.json();
      
      if (!Array.isArray(teamsData) || teamsData.length === 0) {
        throw new Error(`No teams found for division ${EVENT_NAME_MAP[eventKey]}`);
      }
      
      console.log(`Fetched ${teamsData.length} teams from TBA for ${EVENT_NAME_MAP[eventKey]}`);
      
      // Extract team numbers and fetch EPA data
      const teamNumbers = teamsData.map(team => team.team_number);
      const teamsWithEPA = await fetchTeamEPABatch(teamNumbers, teamsData);
      
      // Store the teams for this division
      setDivisionTeams(prev => ({
        ...prev,
        [eventKey]: teamsWithEPA
      }));
      
      // Mark this division as loaded
      setDivisionsLoaded(prev => [...prev, eventKey]);
      setError(null);
    } catch (err: any) {
      console.error(`Error fetching teams for division ${EVENT_NAME_MAP[eventKey]}:`, err);
      setError(`Failed to load teams for ${EVENT_NAME_MAP[eventKey]}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }
  
  // Load the first division on component mount
  useEffect(() => {
    if (!authLoading && user) {
      fetchTeamsForDivision(selectedDivision);
    }
  }, [authLoading, user]);
  
  // Change selected division
  const handleDivisionChange = (divisionKey: string) => {
    setSelectedDivision(divisionKey);
    fetchTeamsForDivision(divisionKey);
  };

  // Fetch EPA data for a batch of teams
  async function fetchTeamEPABatch(teamNumbers: number[], teamsData: any[]): Promise<TeamWithCost[]> {
    const results: TeamWithCost[] = [];
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
  function createDefaultTeam(teamNumber: number, tbaData: any): TeamWithCost {
    const teamName = tbaData ? tbaData.nickname : `Team ${teamNumber}`;
    return {
      team: teamNumber,
      name: teamName,
      epa: 500, // Default EPA
      cost: 100 // Minimum cost
    };
  }
  
  // Get team tier (used for cost calculation but not displayed)
  function getTeamTier(epa: number): { tier: string, multiplier: number } {
    if (epa >= 1800) return { tier: "S", multiplier: 5.0 };   // Elite teams
    if (epa >= 1650) return { tier: "A+", multiplier: 4.0 };  // Championship contenders
    if (epa >= 1500) return { tier: "A", multiplier: 3.0 };   // Division finalists
    if (epa >= 1350) return { tier: "B+", multiplier: 2.0 };  // Playoff teams
    if (epa >= 1200) return { tier: "B", multiplier: 1.5 };   // Strong teams
    if (epa >= 1050) return { tier: "C+", multiplier: 1.2 };  // Above average teams
    if (epa >= 900) return { tier: "C", multiplier: 1.0 };    // Average teams
    return { tier: "D", multiplier: 0.8 };                    // Below average teams
  }
  
  // Calculate cost based on EPA
  function calculateTeamCost(epa: number): number {
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

  // Format EPA for display
  function formatEPA(epa: number | undefined): string {
    if (epa === undefined || epa === null) return 'N/A';
    return Math.round(epa).toString();
  }

  // Filter teams based on search query
  const getFilteredTeams = () => {
    const teams = divisionTeams[selectedDivision] || [];
    
    if (!searchQuery.trim()) return teams;
    
    const query = searchQuery.toLowerCase();
    return teams.filter(team => 
      team.team.toString().includes(query) ||
      team.name.toLowerCase().includes(query)
    );
  };

  // Sort teams
  const getSortedTeams = () => {
    const filteredTeams = getFilteredTeams();
    
    return [...filteredTeams].sort((a, b) => {
      if (sortBy === 'team') {
        return sortDirection === 'asc' ? a.team - b.team : b.team - a.team;
      } else if (sortBy === 'name') {
        return sortDirection === 'asc' 
          ? a.name.localeCompare(b.name) 
          : b.name.localeCompare(a.name);
      } else if (sortBy === 'epa') {
        const aEpa = a.epa || 0;
        const bEpa = b.epa || 0;
        return sortDirection === 'asc' ? aEpa - bEpa : bEpa - aEpa;
      } else if (sortBy === 'cost') {
        return sortDirection === 'asc' ? a.cost - b.cost : b.cost - a.cost;
      }
      return 0;
    });
  };

  // Toggle sort column
  const toggleSort = (column: 'team' | 'name' | 'epa' | 'cost') => {
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
      
      // Common properties for both new and updated teams
      const teamData = {
        name: teamName,
        userId: user.uid,
        userName: user.displayName || user.email?.split('@')[0] || 'Unknown User',
        selectedTeams: selectedTeams.map(team => ({
          teamNumber: team.team,
          teamName: team.name,
          cost: team.cost
        })),
        totalCost: budgetUsed,
        updatedAt: Date.now()
      };
      
      let teamId;
      
      if (isEditing && editTeamId) {
        // Update existing team
        await updateFantasyTeam(editTeamId, teamData);
        teamId = editTeamId;
      } else {
        // Create new team with additional required fields
        const newTeam = {
          ...teamData,
          totalScore: 0, // Will be updated as events progress
          createdAt: Date.now()
        };
        teamId = await createFantasyTeam(newTeam);
      }
      
      // Redirect to the team page
      router.push(`/fantasy/${teamId}`);
    } catch (err) {
      console.error('Error saving fantasy team:', err);
      setError('Failed to save fantasy team. Please try again.');
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

  // If user already has a team, show message and link to their team
  if (hasExistingTeam) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4 text-black">Fantasy Team Limit Reached</h1>
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          You can only have one fantasy team per user. Please use your existing team.
        </div>
        <button 
          onClick={() => router.push('/fantasy')}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          View My Fantasy Teams
        </button>
      </div>
    );
  }

  // Check if the user is an admin with special privileges
  const isAdmin = user && user.email === 'remyan.yc@gmail.com';
  
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb navigation */}
      <div className="flex items-center text-sm mb-4">
        <Link href="/fantasy" className="text-blue-500 hover:text-blue-700">
          Fantasy Teams
        </Link>
        <span className="mx-2 text-gray-500">/</span>
        <span className="text-gray-700">{isEditing ? 'Edit Team' : 'Create Team'}</span>
      </div>

      <h1 className="text-2xl font-bold mb-4 text-black">{isEditing ? 'Edit Fantasy Team' : 'Create Your Fantasy Team'}</h1>
      
      {isAdmin && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          Admin mode: You can create multiple fantasy teams.
        </div>
      )}
      
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
            
            {/* Division Tabs */}
            <Tabs 
              defaultValue={selectedDivision} 
              onValueChange={handleDivisionChange} 
              className="mb-4"
            >
              <TabsList className="grid grid-cols-4 md:grid-cols-8">
                {FANTASY_CONFIG.eventIds.map(eventKey => (
                  <TabsTrigger 
                    key={eventKey} 
                    value={eventKey}
                    disabled={loading && !divisionsLoaded.includes(eventKey)}
                  >
                    {EVENT_NAME_MAP[eventKey] || eventKey}
                  </TabsTrigger>
                ))}
              </TabsList>
              
              {FANTASY_CONFIG.eventIds.map(eventKey => (
                <TabsContent key={eventKey} value={eventKey}>
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
                  
                  {loading && !divisionsLoaded.includes(eventKey) ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                  ) : (
                    /* Teams Table */
                    <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                      <table className="min-w-full bg-white">
                        <thead className="sticky top-0 bg-white z-10">
                          <tr className="bg-gray-100 text-black">
                            <th className="py-2 px-4 cursor-pointer text-black" onClick={() => toggleSort('team')}>
                              Team # {sortBy === 'team' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="py-2 px-4 cursor-pointer text-black" onClick={() => toggleSort('name')}>
                              Team Name {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="py-2 px-4 cursor-pointer text-black" onClick={() => toggleSort('epa')}>
                              EPA {sortBy === 'epa' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="py-2 px-4 cursor-pointer text-black" onClick={() => toggleSort('cost')}>
                              Cost {sortBy === 'cost' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="py-2 px-4 text-black">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {getSortedTeams().map(team => (
                            <tr key={team.team} className="border-t hover:bg-gray-50">
                              <td className="py-2 px-4 text-black">{team.team}</td>
                              <td className="py-2 px-4 text-black">{team.name}</td>
                              <td className="py-2 px-4 text-black">{formatEPA(team.epa)}</td>
                              <td className="py-2 px-4 text-black">${team.cost.toLocaleString()}</td>
                              <td className="py-2 px-4">
                                <button
                                  onClick={() => addTeam(team)}
                                  disabled={selectedTeams.some(t => t.team === team.team)}
                                  className={`px-3 py-1 rounded ${
                                    selectedTeams.some(t => t.team === team.team)
                                      ? 'bg-gray-300 cursor-not-allowed'
                                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                                  }`}
                                >
                                  {selectedTeams.some(t => t.team === team.team) ? 'Added' : 'Add'}
                                </button>
                              </td>
                            </tr>
                          ))}
                          {getSortedTeams().length === 0 && !loading && (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-gray-500">
                                No teams found for this division.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          </div>
        </div>
        
        {/* Draft Summary Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4 text-black">Your Draft</h2>
            
            <form onSubmit={handleSubmit} className="mb-8">
              <div className="mb-6">
                <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
                <input
                  type="text"
                  id="teamName"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded text-black"
                  placeholder="Enter team name"
                  maxLength={50}
                  required
                />
              </div>
              
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-gray-500">
                  Budget: <span className="text-black">${budgetRemaining.toLocaleString()}</span> of <span className="text-black">${totalBudget.toLocaleString()}</span> remaining
                </div>
                <div className="text-sm text-gray-500">
                  Teams: <span className="text-black">{selectedTeams.length}</span> of <span className="text-black">{maxTeams}</span> selected
                </div>
              </div>
              
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded disabled:opacity-50"
              >
                {loading ? 'Saving...' : (isEditing ? 'Save Team Changes' : 'Create Fantasy Team')}
              </button>
            </form>
          </div>
          
          {/* Selected Teams */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4 text-black">Selected Teams</h3>
            
            {selectedTeams.length === 0 ? (
              <p className="text-gray-500 italic">No teams selected yet</p>
            ) : (
              <div className="space-y-2">
                {selectedTeams.map(team => (
                  <div key={team.team} className="flex justify-between py-2 border-b">
                    <div className="text-black">
                      <span className="font-medium">{team.team}</span> - {team.name}
                      <div className="text-xs text-gray-500 mt-1">EPA: {formatEPA(team.epa)}</div>
                    </div>
                    <div className="flex items-center">
                      <span className="text-black mr-2">${team.cost.toLocaleString()}</span>
                      <button
                        onClick={() => removeTeam(team.team)}
                        className="text-red-500 hover:text-red-700"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Main page component with Suspense boundary
export default function Page() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-8">Loading...</div>}>
      <CreateFantasyTeamWithParams />
    </Suspense>
  );
} 