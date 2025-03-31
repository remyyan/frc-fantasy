'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FANTASY_CONFIG } from '@/app/utils/config';
import { getCachedDivisionTeams, hasCachedDivision } from '@/app/utils/firebase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EVENT_NAME_MAP } from '@/app/utils/globals';

export default function TeamsPage() {
  const [divisionTeams, setDivisionTeams] = useState<Record<string, any[]>>({});
  const [divisionsLoaded, setDivisionsLoaded] = useState<string[]>([]);
  const [selectedDivision, setSelectedDivision] = useState(FANTASY_CONFIG.eventIds[0]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'team' | 'name' | 'cost' | 'epa'>('team');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [teamsPerPage, setTeamsPerPage] = useState(40);
  
  // Calculate stats about teams for the current division
  const currentTeams = divisionTeams[selectedDivision] || [];
  const totalTeams = currentTeams.length;
  const teamsLoaded = !loading && currentTeams.length > 0;

  useEffect(() => {
    // Load the first division on component mount
    fetchDivisionTeams(selectedDivision);
  }, []);

  async function fetchDivisionTeams(eventKey: string) {
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
      
      setError(`No cached data for ${EVENT_NAME_MAP[eventKey]}. Please visit the Admin Panel to cache division teams.`);
      setLoading(false);
    } catch (err: any) {
      console.error(`Error fetching teams for division ${EVENT_NAME_MAP[eventKey]}:`, err);
      setError(`Failed to load teams for ${EVENT_NAME_MAP[eventKey]}: ${err.message}`);
      setLoading(false);
    }
  }

  // Handle division change
  const handleDivisionChange = (divisionKey: string) => {
    setSelectedDivision(divisionKey);
    fetchDivisionTeams(divisionKey);
  };

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
  const filteredTeams = currentTeams.filter(team => {
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
        const aEpa = a.epa || 0;
        const bEpa = b.epa || 0;
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

  // Format EPA for display
  function formatEPA(epa: number | undefined): string {
    if (epa === undefined || epa === null) return 'N/A';
    return Math.round(epa).toString();
  }

  // Pagination controls component
  const PaginationControls = () => {
    // Calculate range of pages to display
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    
    // Adjust the start if we're near the end
    if (endPage - startPage + 1 < maxPagesToShow) {
      startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }
    
    // Generate page numbers
    const pageNumbers = [];
    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <div className="flex justify-center mt-8">
        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
          {/* Previous button */}
          <button
            onClick={() => changePage(currentPage - 1)}
            disabled={currentPage === 1}
            className={`relative inline-flex items-center px-2 py-2 rounded-l-md border ${
              currentPage === 1
                ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            <span className="sr-only">Previous</span>
            <svg
              className="h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
          
          {/* Page numbers */}
          {pageNumbers.map(number => (
            <button
              key={number}
              onClick={() => changePage(number)}
              className={`relative inline-flex items-center px-4 py-2 border ${
                currentPage === number
                  ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
              }`}
            >
              {number}
            </button>
          ))}
          
          {/* Next button */}
          <button
            onClick={() => changePage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`relative inline-flex items-center px-2 py-2 rounded-r-md border ${
              currentPage === totalPages
                ? 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'border-gray-300 bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            <span className="sr-only">Next</span>
            <svg
              className="h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </nav>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2 text-black">{FANTASY_CONFIG.eventName}</h1>
        <p className="text-gray-600 mb-4">
          {FANTASY_CONFIG.eventDates} · {FANTASY_CONFIG.eventLocation}
        </p>
        
        {teamsLoaded && (
          <div className="text-sm text-gray-600 mb-4">
            Showing teams by division for the championship. Teams are valued based on their EPA ratings.
          </div>
        )}
      </div>
      
      {/* Division Tabs */}
      <div className="mb-6">
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
        </Tabs>
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
        {!loading && currentTeams.length > 0 && (
          <div className="mt-4 text-sm text-gray-600">
            {searchTerm ? (
              <p>Found {filteredTeams.length} teams matching "{searchTerm}" in {EVENT_NAME_MAP[selectedDivision]}</p>
            ) : (
              <p>Showing all {totalTeams} teams in {EVENT_NAME_MAP[selectedDivision]}</p>
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
                      ${team.cost}
                    </div>
                  </div>
                  <h3 className="font-medium mb-2 line-clamp-2">{team.name}</h3>
                  <div className="mt-4 text-sm text-gray-600">
                    <div className="flex justify-between mb-1">
                      <span>EPA Rating:</span>
                      <span className="font-medium">{formatEPA(team.epa)}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span>Division:</span>
                      <span className="font-medium">{EVENT_NAME_MAP[selectedDivision]}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          
          {/* Pagination controls */}
          {totalPages > 1 && <PaginationControls />}
        </>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <h3 className="text-xl font-medium text-gray-700 mb-4">No Teams Found</h3>
          <p className="text-gray-500 mb-6">
            {searchTerm 
              ? `No teams matching "${searchTerm}" were found in ${EVENT_NAME_MAP[selectedDivision]}.` 
              : `No teams found in ${EVENT_NAME_MAP[selectedDivision]}.`}
          </p>
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Clear Search
            </button>
          )}
        </div>
      )}
    </div>
  );
} 