'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getTeamsForFantasyDraft, calculateTeamCost } from '@/app/utils/tbaStats';
import { TeamWithCost } from '@/app/utils/tbaStats';
import { FANTASY_CONFIG } from '@/app/utils/config';

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamWithCost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'team' | 'name' | 'cost' | 'epa'>('team');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [teamsPerPage, setTeamsPerPage] = useState(40);
  
  // Calculate stats about teams
  const totalTeams = teams.length;
  const teamsLoaded = !loading && teams.length > 0;

  useEffect(() => {
    async function fetchTeams() {
      try {
        setLoading(true);
        const fetchedTeams = await getTeamsForFantasyDraft();
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

  // Handle sort change
  const toggleSort = (field: 'team' | 'name' | 'cost' | 'epa') => {
    if (sortBy === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDirection('asc');
    }
  };

  // Filter teams based on search term
  const filteredTeams = teams.filter(team => {
    const searchLower = searchTerm.toLowerCase();
    return (
      team.team.toString().includes(searchTerm) ||
      team.name.toLowerCase().includes(searchLower)
    );
  });

  // Sort filtered teams
  const sortedTeams = [...filteredTeams].sort((a, b) => {
    switch (sortBy) {
      case 'team':
        return sortDirection === 'asc' ? a.team - b.team : b.team - a.team;
      case 'name':
        return sortDirection === 'asc' 
          ? a.name.localeCompare(b.name) 
          : b.name.localeCompare(a.name);
      case 'cost':
        return sortDirection === 'asc' ? a.cost - b.cost : b.cost - a.cost;
      case 'epa':
        const aEpa = a.epa?.current || 0;
        const bEpa = b.epa?.current || 0;
        return sortDirection === 'asc' ? aEpa - bEpa : bEpa - aEpa;
      default:
        return 0;
    }
  });

  // Paginate sorted and filtered teams
  const totalPages = Math.ceil(sortedTeams.length / teamsPerPage);
  const paginatedTeams = sortedTeams.slice(
    (currentPage - 1) * teamsPerPage,
    currentPage * teamsPerPage
  );

  // Handle page change
  const changePage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo(0, 0);
  };

  // Pagination controls
  const PaginationControls = () => (
    <div className="mt-8 flex justify-center items-center space-x-2">
      <button
        onClick={() => changePage(1)}
        disabled={currentPage === 1}
        className={`px-3 py-1 rounded ${
          currentPage === 1 
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
            : 'bg-blue-500 text-white hover:bg-blue-600'
        }`}
      >
        First
      </button>
      <button
        onClick={() => changePage(currentPage - 1)}
        disabled={currentPage === 1}
        className={`px-3 py-1 rounded ${
          currentPage === 1 
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
            : 'bg-blue-500 text-white hover:bg-blue-600'
        }`}
      >
        Prev
      </button>
      
      <div className="flex items-center">
        <span className="text-gray-700 mx-2">
          Page {currentPage} of {totalPages || 1}
        </span>
      </div>
      
      <button
        onClick={() => changePage(currentPage + 1)}
        disabled={currentPage === totalPages || totalPages === 0}
        className={`px-3 py-1 rounded ${
          currentPage === totalPages || totalPages === 0
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
            : 'bg-blue-500 text-white hover:bg-blue-600'
        }`}
      >
        Next
      </button>
      <button
        onClick={() => changePage(totalPages)}
        disabled={currentPage === totalPages || totalPages === 0}
        className={`px-3 py-1 rounded ${
          currentPage === totalPages || totalPages === 0
            ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
            : 'bg-blue-500 text-white hover:bg-blue-600'
        }`}
      >
        Last
      </button>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2 text-black">{FANTASY_CONFIG.eventName}</h1>
        <p className="text-gray-600 mb-4">
          {FANTASY_CONFIG.eventDates} · {FANTASY_CONFIG.eventLocation}
        </p>
        
        {teamsLoaded && (
          <div className="text-sm text-gray-600 mb-4">
            Showing all {totalTeams} teams participating in the championship. Teams are valued based on their EPA ratings.
          </div>
        )}
      </div>
      
      {/* Search and Filter Controls */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-grow max-w-md">
            <label htmlFor="team-search" className="block text-sm font-medium text-gray-700 mb-1">
              Search Teams
            </label>
            <div className="flex">
              <input
                id="team-search"
                type="text"
                placeholder="Search by team number or name..."
                className="flex-grow px-4 py-2 border border-gray-300 rounded-l focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1); // Reset to first page on new search
                }}
              />
              {searchTerm && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="bg-gray-200 px-4 py-2 rounded-r hover:bg-gray-300"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <div>
              <label htmlFor="sort-by" className="block text-sm font-medium text-gray-700 mb-1">
                Sort By
              </label>
              <select
                id="sort-by"
                className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as 'team' | 'name' | 'cost' | 'epa');
                  setCurrentPage(1);
                }}
              >
                <option value="team">Team Number</option>
                <option value="name">Team Name</option>
                <option value="cost">Cost</option>
                <option value="epa">EPA Rating</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="sort-direction" className="block text-sm font-medium text-gray-700 mb-1">
                Direction
              </label>
              <select
                id="sort-direction"
                className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                value={sortDirection}
                onChange={(e) => setSortDirection(e.target.value as 'asc' | 'desc')}
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="teams-per-page" className="block text-sm font-medium text-gray-700 mb-1">
                Per Page
              </label>
              <select
                id="teams-per-page"
                className="px-4 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                value={teamsPerPage}
                onChange={(e) => {
                  setTeamsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
              >
                <option value="20">20</option>
                <option value="40">40</option>
                <option value="80">80</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* Search results stats */}
        {!loading && (
          <div className="mt-4 text-sm text-gray-600">
            {searchTerm ? (
              <p>Found {filteredTeams.length} teams matching "{searchTerm}"</p>
            ) : (
              <p>Showing all {totalTeams} teams</p>
            )}
          </div>
        )}
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="ml-3 text-lg text-gray-700">Loading teams...</p>
        </div>
      ) : paginatedTeams.length > 0 ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {paginatedTeams.map((team) => (
              <Link key={team.team} href={`/teams/${team.team}`}>
                <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 cursor-pointer text-black">
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-xl font-bold">Team {team.team}</h2>
                    <div className="text-sm font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                      ${(team.cost / 100).toFixed(2)}
                    </div>
                  </div>
                  <h3 className="font-medium mb-2 line-clamp-2">{team.name}</h3>
                  <div className="mt-4 text-sm text-gray-600">
                    {team.epa?.current !== undefined && (
                      <div className="flex justify-between mb-1">
                        <span>EPA Rating:</span>
                        <span className="font-medium">{team.epa.current.toFixed(2)}</span>
                      </div>
                    )}
                    {team.opr !== undefined && (
                      <div className="flex justify-between mb-1">
                        <span>OPR:</span>
                        <span className="font-medium">{team.opr.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
          
          {/* Pagination controls */}
          {totalPages > 1 && <PaginationControls />}
        </>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <p className="text-gray-600 mb-3">
            {searchTerm ? 'No teams found matching your search criteria.' : 'No teams available.'}
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Clear Search
            </button>
          )}
        </div>
      )}
    </div>
  );
} 