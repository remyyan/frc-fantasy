import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FANTASY_CONFIG } from '@/app/utils/config';
import { getCachedDivisionTeams, calculateTeamRosterPercentages } from '@/app/utils/firebase';
import { EVENT_NAME_MAP } from '@/app/utils/globals';
import { useEvent } from '@/app/contexts/EventContext';

export default function TeamList() {
  const { activeEvent } = useEvent();
  const [allTeams, setAllTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'team' | 'name' | 'epa' | 'cost' | 'rosterPct'>('epa');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [rosterPercentages, setRosterPercentages] = useState<Record<number, number>>({});

  // Load teams from all divisions
  useEffect(() => {
    async function fetchAllTeams() {
      try {
        setLoading(true);
        
        // Load roster percentages, scoped to the active event
        const percentages = await calculateTeamRosterPercentages(activeEvent?.id);
        setRosterPercentages(percentages);
        
        const allDivisionTeams: any[] = [];
        
        // Fetch teams from each division
        for (const eventKey of FANTASY_CONFIG.eventIds) {
          const divisionTeams = await getCachedDivisionTeams(eventKey);
          
          if (divisionTeams) {
            // Add the division to each team
            const teamsWithDivision = divisionTeams.map(team => ({
              ...team,
              division: eventKey,
              divisionName: EVENT_NAME_MAP[eventKey] || eventKey
            }));
            
            allDivisionTeams.push(...teamsWithDivision);
          }
        }
        
        setAllTeams(allDivisionTeams);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching teams:', err);
        setError('Failed to load teams. Please try again later.');
        setLoading(false);
      }
    }
    
    fetchAllTeams();
  }, []);

  // Filter teams by search query
  const getFilteredTeams = () => {
    if (!searchQuery.trim()) {
      return allTeams;
    }
    
    const query = searchQuery.toLowerCase();
    return allTeams.filter(team => 
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
      } else if (sortBy === 'rosterPct') {
        const aPct = rosterPercentages[a.team] || 0;
        const bPct = rosterPercentages[b.team] || 0;
        return sortDirection === 'asc' ? aPct - bPct : bPct - aPct;
      }
      return 0;
    });
  };

  // Toggle sort direction
  const toggleSort = (column: 'team' | 'name' | 'epa' | 'cost' | 'rosterPct') => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
  };

  // Format EPA value
  const formatEPA = (epa?: number) => {
    if (epa === undefined) return 'N/A';
    return epa.toFixed(1);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 flex justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">All Teams</h1>
      
      {/* Search Input */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search teams by number or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded text-black"
        />
      </div>
      
      {/* Teams Table */}
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => toggleSort('team')}
              >
                Team # {sortBy === 'team' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => toggleSort('name')}
              >
                Team Name {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => toggleSort('epa')}
              >
                EPA {sortBy === 'epa' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => toggleSort('cost')}
              >
                Cost {sortBy === 'cost' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => toggleSort('rosterPct')}
              >
                Roster % {sortBy === 'rosterPct' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Division
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {getSortedTeams().map(team => (
              <tr key={team.team} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-black">{team.team}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-black">{team.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-black">{formatEPA(team.epa)}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-black">${team.cost?.toLocaleString()}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-black">{rosterPercentages[team.team] || 0}%</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-black">{team.divisionName}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link 
                    href={`/teams/${team.team}`}
                    className="text-blue-500 hover:text-blue-700"
                  >
                    View Details
                  </Link>
                </td>
              </tr>
            ))}
            
            {getSortedTeams().length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                  No teams found matching your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
} 