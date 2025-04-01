'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { FANTASY_CONFIG } from '@/app/utils/config';
import { getFantasyTeam, updateFantasyTeam, deleteFantasyTeam } from '@/app/utils/firebase';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCachedDivisionTeams, hasCachedDivision } from '@/app/utils/firebase';
import { TeamWithCost } from '@/app/utils/statbotics';

interface EditFantasyTeamClientProps {
  teamId: string;
}

export default function EditFantasyTeamClient({ teamId }: EditFantasyTeamClientProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [teamName, setTeamName] = useState('');
  const [originalTeam, setOriginalTeam] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // For team selection
  const [selectedDivision, setSelectedDivision] = useState(FANTASY_CONFIG.eventIds[0]);
  const [divisionTeams, setDivisionTeams] = useState<Record<string, TeamWithCost[]>>({});
  const [divisionsLoaded, setDivisionsLoaded] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'team' | 'name' | 'epa' | 'cost'>('epa');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedTeams, setSelectedTeams] = useState<TeamWithCost[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(false);
  
  // Check if editing teams is allowed based on competition start time
  const isEditingAllowed = FANTASY_CONFIG.isEditingAllowed();

  // Fetch the fantasy team data
  useEffect(() => {
    async function fetchFantasyTeam() {
      if (!user) return;
      
      try {
        setLoading(true);
        const teamData = await getFantasyTeam(teamId);
        
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
        
        // Convert selectedTeams to the format expected by our component
        if (teamData.selectedTeams && isEditingAllowed) {
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
      } catch (err) {
        console.error('Error fetching fantasy team:', err);
        setError('Failed to load fantasy team');
        setLoading(false);
      }
    }
    
    if (!authLoading) {
      fetchFantasyTeam();
    }
  }, [teamId, user, authLoading, isEditingAllowed]);

  // Load the teams for selection if editing is allowed
  useEffect(() => {
    if (isEditingAllowed && !authLoading && user) {
      fetchTeamsForDivision(selectedDivision);
    }
  }, [isEditingAllowed, authLoading, user, selectedDivision]);

  // Fetch teams for a specific division
  async function fetchTeamsForDivision(eventKey: string) {
    if (divisionsLoaded.includes(eventKey)) {
      return;
    }

    try {
      setLoadingTeams(true);
      
      // Check for cached data in Firebase first
      const hasCached = await hasCachedDivision(eventKey);
      
      if (hasCached) {
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
          setLoadingTeams(false);
          return;
        }
      }
      
      // If we reach here, there was an issue with cached data
      setError('Failed to load teams. Please try again later.');
      setLoadingTeams(false);
    } catch (err) {
      console.error(`Error fetching teams for division:`, err);
      setError(`Failed to load teams. Please try again later.`);
      setLoadingTeams(false);
    }
  }

  // Handle adding a team to selection
  const handleAddTeam = (team: TeamWithCost) => {
    // Check if we've already reached the maximum number of teams
    if (selectedTeams.length >= FANTASY_CONFIG.maxTeams) {
      setError(`You must select exactly ${FANTASY_CONFIG.maxTeams} teams.`);
      return;
    }
    
    // Check if team is already selected
    if (selectedTeams.find(t => t.team === team.team)) {
      setError(`Team ${team.team} is already selected.`);
      return;
    }
    
    // Check if adding this team would exceed the budget
    const currentTotal = selectedTeams.reduce((sum, t) => sum + t.cost, 0);
    if (currentTotal + team.cost > FANTASY_CONFIG.budget) {
      setError(`Adding this team would exceed your budget of $${FANTASY_CONFIG.budget.toLocaleString()}.`);
      return;
    }
    
    // Add the team
    setSelectedTeams([...selectedTeams, team]);
    setError(null);
  };

  // Handle removing a team from selection
  const handleRemoveTeam = (teamNumber: number) => {
    setSelectedTeams(selectedTeams.filter(team => team.team !== teamNumber));
    setError(null);
  };

  // Filter and sort teams for the selected division
  const getFilteredTeams = () => {
    if (!divisionTeams[selectedDivision]) return [];
    
    let filtered = divisionTeams[selectedDivision].filter(team => {
      const teamNumberStr = team.team.toString();
      const teamNameLower = team.name.toLowerCase();
      const searchLower = searchQuery.toLowerCase();
      
      return teamNumberStr.includes(searchQuery) || 
             teamNameLower.includes(searchLower);
    });
    
    // Sort the filtered teams
    filtered.sort((a, b) => {
      if (sortBy === 'team') {
        return sortDirection === 'asc' ? a.team - b.team : b.team - a.team;
      } else if (sortBy === 'name') {
        return sortDirection === 'asc' ? 
          a.name.localeCompare(b.name) : 
          b.name.localeCompare(a.name);
      } else if (sortBy === 'epa') {
        return sortDirection === 'asc' ? 
          (a.epa || 0) - (b.epa || 0) : 
          (b.epa || 0) - (a.epa || 0);
      } else { // cost
        return sortDirection === 'asc' ? a.cost - b.cost : b.cost - a.cost;
      }
    });
    
    return filtered;
  };

  // Toggle sort direction or change sort field
  const handleSort = (field: 'team' | 'name' | 'epa' | 'cost') => {
    if (field === sortBy) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('desc'); // Default to descending for new sort field
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('You must be logged in to edit a fantasy team');
      return;
    }
    
    if (!teamName.trim()) {
      setError('Please enter a team name');
      return;
    }
    
    if (selectedTeams.length !== FANTASY_CONFIG.maxTeams) {
      setError(`You must select exactly ${FANTASY_CONFIG.maxTeams} teams`);
      setSaving(false);
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      // Prepare update data
      const updateData: any = {
        name: teamName,
        updatedAt: Date.now()
      };
      
      // If editing teams is allowed and teams were modified, update the selected teams
      if (isEditingAllowed) {
        // Convert the selected teams to the format expected by the database
        const formattedTeams = selectedTeams.map(team => ({
          teamNumber: team.team,
          teamName: team.name,
          cost: team.cost
        }));
        
        // Only update teams if there are any selected
        if (formattedTeams.length > 0) {
          updateData.selectedTeams = formattedTeams;
          updateData.totalCost = selectedTeams.reduce((sum, team) => sum + team.cost, 0);
        } else if (selectedTeams.length === 0 && isEditingAllowed) {
          setError('You must select at least one team');
          setSaving(false);
          return;
        }
      }
      
      await updateFantasyTeam(teamId, updateData);
      
      setSuccess('Fantasy team updated successfully!');
      setTimeout(() => {
        router.push(`/fantasy/${teamId}`);
      }, 1500);
    } catch (err) {
      console.error('Error updating fantasy team:', err);
      setError('Failed to update fantasy team. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Handle team deletion
  const handleDelete = async () => {
    if (!user) {
      setError('You must be logged in to delete a fantasy team');
      return;
    }
    
    try {
      setDeleting(true);
      setError(null);
      
      await deleteFantasyTeam(teamId, user.uid);
      
      // Redirect to fantasy teams list
      router.push('/fantasy');
    } catch (err) {
      console.error('Error deleting fantasy team:', err);
      setError('Failed to delete fantasy team. Please try again.');
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Loading...</h1>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Edit Fantasy Team</h1>
        <p className="mb-4">Please log in to edit your fantasy team.</p>
        <button 
          onClick={() => router.push('/login')}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
        >
          Go to Login
        </button>
      </div>
    );
  }

  if (error && !originalTeam) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
        <Link href="/fantasy" className="text-blue-500 hover:underline">
          ← Back to Fantasy Teams
        </Link>
      </div>
    );
  }

  // Calculate the budget information
  const budgetUsed = isEditingAllowed 
    ? selectedTeams.reduce((sum, team) => sum + team.cost, 0) 
    : originalTeam?.totalCost || 0;
  const budgetRemaining = FANTASY_CONFIG.budget - budgetUsed;

  // Format the competition start time for display
  const competitionStartDate = new Date(FANTASY_CONFIG.competitionStartTime);
  const dateFormatter = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    timeZoneName: 'short'
  });
  const formattedCompetitionStart = dateFormatter.format(competitionStartDate);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2 text-black">Edit Fantasy Team</h1>
        <p className="text-gray-600 mb-4">
          {FANTASY_CONFIG.eventName} • {FANTASY_CONFIG.eventDates}
        </p>
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}
      
      {!isEditingAllowed && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          Team selection is locked. The competition has started or will start soon.
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-black">Fantasy Team Details</h2>
            
            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="team-name">
                  Team Name
                </label>
                <input
                  id="team-name"
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter team name"
                  required
                />
              </div>
              
              {/* Display selected teams */}
              <div className="mb-6">
                <h3 className="font-semibold mb-2 text-black">Selected Teams</h3>
                <p className="text-sm text-gray-600 mb-3">
                  {isEditingAllowed 
                    ? `Select up to ${FANTASY_CONFIG.maxTeams} teams within your budget. Teams can be edited until ${formattedCompetitionStart}.` 
                    : 'Team selection is locked. The competition has started or will start soon.'}
                </p>
                <div className="bg-gray-50 rounded p-4 max-h-96 overflow-y-auto">
                  <table className="min-w-full">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                        <th className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="py-2 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                        {isEditingAllowed && (
                          <th className="py-2 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(isEditingAllowed ? selectedTeams : originalTeam?.selectedTeams || []).map((team: any) => (
                        <tr key={isEditingAllowed ? team.team : team.teamNumber} className="hover:bg-gray-50">
                          <td className="py-2 px-4 whitespace-nowrap font-medium text-black">
                            {isEditingAllowed ? team.team : team.teamNumber}
                          </td>
                          <td className="py-2 px-4 whitespace-nowrap text-gray-600">
                            {isEditingAllowed ? team.name : team.teamName}
                          </td>
                          <td className="py-2 px-4 whitespace-nowrap text-right font-medium text-blue-600">
                            ${team.cost}
                          </td>
                          {isEditingAllowed && (
                            <td className="py-2 px-4 whitespace-nowrap text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveTeam(team.team)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Remove
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                      {(isEditingAllowed ? selectedTeams : originalTeam?.selectedTeams || []).length === 0 && (
                        <tr>
                          <td colSpan={isEditingAllowed ? 4 : 3} className="py-4 text-center text-gray-500">
                            No teams selected
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Team selection section - only shown if editing is allowed */}
              {isEditingAllowed && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-2 text-black">Add Teams</h3>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="search-teams">
                      Search Teams
                    </label>
                    <input
                      id="search-teams"
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Search by team number or name"
                    />
                  </div>
                  
                  <div className="bg-gray-50 rounded p-4 max-h-96 overflow-y-auto">
                    {loadingTeams ? (
                      <div className="py-4 text-center text-gray-500">Loading teams...</div>
                    ) : (
                      <table className="min-w-full">
                        <thead className="bg-gray-100 sticky top-0">
                          <tr>
                            <th 
                              className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                              onClick={() => handleSort('team')}
                            >
                              Team {sortBy === 'team' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </th>
                            <th 
                              className="py-2 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                              onClick={() => handleSort('name')}
                            >
                              Name {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </th>
                            <th 
                              className="py-2 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                              onClick={() => handleSort('epa')}
                            >
                              EPA {sortBy === 'epa' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </th>
                            <th 
                              className="py-2 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                              onClick={() => handleSort('cost')}
                            >
                              Cost {sortBy === 'cost' && (sortDirection === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="py-2 px-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {getFilteredTeams().map(team => (
                            <tr key={team.team} className="hover:bg-gray-50">
                              <td className="py-2 px-4 whitespace-nowrap font-medium text-black">{team.team}</td>
                              <td className="py-2 px-4 whitespace-nowrap text-gray-600">{team.name}</td>
                              <td className="py-2 px-4 whitespace-nowrap text-right font-medium text-green-600">
                                {team.epa ? team.epa.toFixed(1) : 'N/A'}
                              </td>
                              <td className="py-2 px-4 whitespace-nowrap text-right font-medium text-blue-600">
                                ${team.cost.toLocaleString()}
                              </td>
                              <td className="py-2 px-4 whitespace-nowrap text-right">
                                <button
                                  type="button"
                                  onClick={() => handleAddTeam(team)}
                                  disabled={selectedTeams.some(t => t.team === team.team)}
                                  className={`text-white px-2 py-1 rounded text-xs ${
                                    selectedTeams.some(t => t.team === team.team)
                                      ? 'bg-gray-400 cursor-not-allowed'
                                      : 'bg-blue-600 hover:bg-blue-700'
                                  }`}
                                >
                                  {selectedTeams.some(t => t.team === team.team) ? 'Added' : 'Add'}
                                </button>
                              </td>
                            </tr>
                          ))}
                          {getFilteredTeams().length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-4 text-center text-gray-500">
                                {divisionTeams[selectedDivision]?.length > 0
                                  ? 'No teams match your search'
                                  : 'No teams available for selection'}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
              
              <div className="flex justify-between items-center mt-6">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={saving || deleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
                >
                  Delete Team
                </button>
                
                <div className="flex space-x-4">
                  <Link
                    href={`/fantasy/${teamId}`}
                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
                  >
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    disabled={saving || deleting}
                    className={`px-4 py-2 text-white rounded ${
                      saving || deleting
                        ? 'bg-blue-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
        
        {/* Sidebar */}
        <div>
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 text-black">Team Summary</h2>
            
            <div className="mb-4">
              <div className="text-sm text-gray-500 mb-1">Budget</div>
              <div className="flex items-center">
                <div className="flex-grow bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full" 
                    style={{ width: `${(budgetUsed / FANTASY_CONFIG.budget) * 100}%` }}
                  ></div>
                </div>
                <div className="ml-2 text-sm font-medium text-gray-700">
                  ${budgetUsed.toLocaleString()} / ${FANTASY_CONFIG.budget.toLocaleString()}
                </div>
              </div>
            </div>
            
            <div className="mb-4">
              <div className="text-sm text-gray-500">Remaining Budget</div>
              <div className="text-2xl font-bold text-black">${budgetRemaining.toLocaleString()}</div>
            </div>
            
            <div className="mb-4">
              <div className="text-sm text-gray-500">Teams Selected</div>
              <div className="text-2xl font-bold text-black">
                {isEditingAllowed ? selectedTeams.length : originalTeam?.selectedTeams?.length || 0} / {FANTASY_CONFIG.maxTeams}
              </div>
            </div>
            
            {originalTeam?.totalScore !== undefined && (
              <div className="mb-4">
                <div className="text-sm text-gray-500">Current Score</div>
                <div className="text-2xl font-bold text-black">{originalTeam.totalScore}</div>
              </div>
            )}
            
            <div className="mb-4">
              <div className="text-sm text-gray-500">Created</div>
              <div className="text-sm text-black">
                {originalTeam?.createdAt ? new Date(originalTeam.createdAt).toLocaleDateString() : '-'}
              </div>
            </div>
            
            {/* Team editing deadline */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-medium text-blue-800 mb-2">Team Selection Deadline</h3>
              <p className="text-sm text-blue-700">
                {isEditingAllowed 
                  ? `Teams can be edited until ${formattedCompetitionStart}`
                  : 'Team selection is locked. The competition has started or will start soon.'}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4 text-black">Delete Fantasy Team</h3>
            <p className="mb-6 text-gray-700">
              Are you sure you want to delete this fantasy team? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={`px-4 py-2 text-white rounded ${
                  deleting
                    ? 'bg-red-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {deleting ? 'Deleting...' : 'Delete Team'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 