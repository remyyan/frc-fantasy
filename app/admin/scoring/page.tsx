'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { calculateFantasyTeamScore, recalculateAllFantasyTeamScores } from '@/app/utils/scoring';
import { collection, getDocs, getFirestore } from 'firebase/firestore';

export default function AdminScoring() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fantasyTeamIds, setFantasyTeamIds] = useState<string[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [progress, setProgress] = useState<number>(0);

  // Fetch all fantasy team IDs on component mount
  useEffect(() => {
    async function fetchTeamIds() {
      try {
        setLoading(true);
        
        const db = getFirestore();
        const querySnapshot = await getDocs(collection(db, 'fantasyTeams'));
        
        const ids = querySnapshot.docs.map(doc => doc.id);
        setFantasyTeamIds(ids);
        
        if (ids.length > 0) {
          setSelectedTeamId(ids[0]);
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching fantasy team IDs:', error);
        setMessage('Error fetching fantasy team IDs');
        setLoading(false);
      }
    }
    
    if (!authLoading && user) {
      // Only fetch if user is authenticated
      fetchTeamIds();
    }
  }, [authLoading, user]);

  // Check if user is a valid admin (this is a simple check - you should implement proper admin validation)
  const isAdmin = user && (
    user.email === 'remyan.yc@gmail.com' 
    // user.email?.endsWith('@frcfantasy.com')
  );

  // Calculate score for a single team
  const handleCalculateSingleTeam = async () => {
    if (!selectedTeamId) {
      setMessage('Please select a team ID');
      return;
    }
    
    try {
      setCalculating(true);
      setMessage('Calculating score...');
      
      const score = await calculateFantasyTeamScore(selectedTeamId);
      
      setMessage(`Score calculated: ${score} points`);
      setCalculating(false);
    } catch (error) {
      console.error('Error calculating score:', error);
      setMessage(`Error calculating score: ${error.message}`);
      setCalculating(false);
    }
  };

  // Calculate scores for all teams
  const handleCalculateAllTeams = async () => {
    try {
      setCalculating(true);
      setMessage('Calculating scores for all teams...');
      setProgress(0);
      
      const ids = [...fantasyTeamIds];
      setSelectedTeams(ids);
      
      // Process in batches
      const batchSize = 5;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        await recalculateAllFantasyTeamScores(batch);
        
        const newProgress = Math.round((i + batch.length) / ids.length * 100);
        setProgress(newProgress);
      }
      
      setMessage(`Scores calculated for all ${ids.length} teams!`);
      setCalculating(false);
      setProgress(100);
    } catch (error) {
      console.error('Error calculating scores:', error);
      setMessage(`Error calculating scores: ${error.message}`);
      setCalculating(false);
    }
  };

  // If not authenticated or not an admin, show access denied
  if (!authLoading && (!user || !isAdmin)) {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Access denied. This page is for administrators only.
        </div>
      </div>
    );
  }

  if (authLoading || loading) {
    return (
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-6">Loading...</h1>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-16">
      <h1 className="text-2xl font-bold mb-6">Fantasy Team Score Administration</h1>
      
      {message && (
        <div className={`mb-6 px-4 py-3 rounded ${
          message.includes('Error') 
            ? 'bg-red-100 border border-red-400 text-red-700' 
            : 'bg-green-100 border border-green-400 text-green-700'
        }`}>
          {message}
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Calculate Score for Single Team</h2>
        
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">Select Fantasy Team</label>
          <select 
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded"
            disabled={calculating}
          >
            {fantasyTeamIds.map(id => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </div>
        
        <button
          onClick={handleCalculateSingleTeam}
          disabled={calculating || !selectedTeamId}
          className={`px-4 py-2 rounded ${
            calculating || !selectedTeamId
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {calculating ? 'Calculating...' : 'Calculate Score'}
        </button>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Calculate Scores for All Teams</h2>
        <p className="mb-4 text-gray-600">
          This will calculate scores for all {fantasyTeamIds.length} fantasy teams. This operation may take several minutes.
        </p>
        
        {progress > 0 && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-1">
              <div 
                className="bg-blue-600 h-2.5 rounded-full" 
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-sm text-gray-600">{progress}% complete</p>
          </div>
        )}
        
        <button
          onClick={handleCalculateAllTeams}
          disabled={calculating || fantasyTeamIds.length === 0}
          className={`px-4 py-2 rounded ${
            calculating || fantasyTeamIds.length === 0
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {calculating ? 'Calculating...' : 'Calculate All Scores'}
        </button>
      </div>
    </div>
  );
} 