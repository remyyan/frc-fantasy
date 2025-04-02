'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/app/contexts/AuthContext';
import { calculateFantasyTeamScore, recalculateAllFantasyTeamScores, debugTeamScore } from '@/app/utils/scoring';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { FANTASY_CONFIG } from '@/app/utils/config';
import EpaBracketExplainer from '@/app/components/EpaBracketExplainer';

export default function AdminScoring() {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fantasyTeamIds, setFantasyTeamIds] = useState<string[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [progress, setProgress] = useState<number>(0);
  const [teamNumberToDebug, setTeamNumberToDebug] = useState<string>('');
  const [debugCalculating, setDebugCalculating] = useState(false);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);
  const [teamScoreBreakdown, setTeamScoreBreakdown] = useState<any | null>(null);
  const [eventPerformance, setEventPerformance] = useState<any | null>(null);
  const [performanceJson, setPerformanceJson] = useState<string>('');

  // New states for manual overrides
  const [overrideData, setOverrideData] = useState({
    epa: '',
    record: '',
    divisionChampion: false,
    championshipWinner: false,
    championshipFinalist: false
  });

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
      setMessage(`Error calculating score: ${error instanceof Error ? error.message : String(error)}`);
      setCalculating(false);
    }
  };

  // Calculate scores for all teams
  const handleCalculateAllTeams = async () => {
    try {
      setCalculating(true);
      setMessage('Calculating scores for all teams with full breakdowns...');
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
      
      setMessage(`Scores calculated for all ${ids.length} teams with complete breakdowns!`);
      setCalculating(false);
      setProgress(100);
    } catch (error) {
      console.error('Error calculating scores:', error);
      setMessage(`Error calculating scores: ${error instanceof Error ? error.message : String(error)}`);
      setCalculating(false);
    }
  };

  // Debug team score calculation
  const handleDebugTeamScore = async () => {
    if (!teamNumberToDebug) {
      setDebugMessage('Please enter a team number');
      return;
    }
    
    try {
      setDebugCalculating(true);
      setDebugMessage('Calculating score...');
      setTeamScoreBreakdown(null);
      setEventPerformance(null);
      
      // No special handling for any team numbers - treat all teams equally
      const result = await debugTeamScore(parseInt(teamNumberToDebug));
      
      setTeamScoreBreakdown(result);
      setEventPerformance(result.eventPerformance);
      
      // Simple message for all teams
      setDebugMessage(`Score calculated: ${result.totalPoints} points`);
      
      setDebugCalculating(false);
    } catch (error) {
      console.error('Error calculating score:', error);
      setDebugMessage(`Error calculating score: ${error instanceof Error ? error.message : String(error)}`);
      setDebugCalculating(false);
      setTeamScoreBreakdown(null);
      setEventPerformance(null);
    }
  };

  // Handle manual override debug calculation
  const handleDebugWithOverrides = async () => {
    if (!teamNumberToDebug) {
      setDebugMessage('Please enter a team number');
      return;
    }
    
    try {
      setDebugCalculating(true);
      setDebugMessage('Calculating score with overrides...');
      setTeamScoreBreakdown(null);
      setEventPerformance(null);
      
      // Build override data from form
      const override: any = {};
      
      if (overrideData.epa) {
        override.epa = parseInt(overrideData.epa);
      }
      
      if (overrideData.record) {
        override.record = overrideData.record;
      }
      
      if (overrideData.divisionChampion) {
        override.division_winner = true;
      }
      
      if (overrideData.championshipWinner) {
        override.championship_winner = true;
      }
      
      if (overrideData.championshipFinalist) {
        override.championship_finalist = true;
      }
      
      console.log("Using override data:", override);
      
      // Use the override data in the debug call
      const result = await debugTeamScore(parseInt(teamNumberToDebug), override);
      
      setTeamScoreBreakdown(result);
      setEventPerformance(result.eventPerformance);
      
      // Message about using overrides
      setDebugMessage(`Score calculated with overrides: ${result.totalPoints} points`);
      
      setDebugCalculating(false);
    } catch (error) {
      console.error('Error calculating score with overrides:', error);
      setDebugMessage(`Error calculating score: ${error instanceof Error ? error.message : String(error)}`);
      setDebugCalculating(false);
      setTeamScoreBreakdown(null);
      setEventPerformance(null);
    }
  };

  // Update JSON string whenever eventPerformance changes
  useEffect(() => {
    if (eventPerformance) {
      try {
        setPerformanceJson(JSON.stringify(eventPerformance, null, 2));
      } catch (error) {
        setPerformanceJson(`Error stringifying performance data: ${error}`);
      }
    } else {
      setPerformanceJson('');
    }
  }, [eventPerformance]);

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
      
      {/* New Debug Section for Individual FRC Team Scoring */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Debug Team Score Calculation</h2>
        
        <div className="mb-4">
          <label className="block text-gray-700 mb-2">FRC Team Number</label>
          <div className="flex space-x-2">
            <input 
              type="number" 
              placeholder="e.g. 2056"
              className="flex-1 px-4 py-2 border border-gray-300 rounded"
              value={teamNumberToDebug || ''}
              onChange={(e) => setTeamNumberToDebug(e.target.value)}
              disabled={debugCalculating}
            />
            <button
              onClick={handleDebugTeamScore}
              disabled={debugCalculating || !teamNumberToDebug}
              className={`px-4 py-2 rounded ${
                debugCalculating || !teamNumberToDebug
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {debugCalculating ? 'Calculating...' : 'Debug Score'}
            </button>
          </div>
        </div>
        
        <div className="mb-6 border-t border-gray-200 pt-4 mt-4">
          <div className="mb-2 font-medium text-gray-700">Manual Overrides</div>
          <p className="text-sm text-gray-500 mb-4">
            Use these overrides to test different scenarios without changing the code.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">EPA Override</label>
              <input
                type="number"
                placeholder="e.g. 2039"
                className="w-full px-4 py-2 border border-gray-300 rounded"
                value={overrideData.epa}
                onChange={(e) => setOverrideData({...overrideData, epa: e.target.value})}
                disabled={debugCalculating}
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-600 mb-1">Record Override</label>
              <input
                type="text"
                placeholder="e.g. 12-0-0"
                className="w-full px-4 py-2 border border-gray-300 rounded"
                value={overrideData.record}
                onChange={(e) => setOverrideData({...overrideData, record: e.target.value})}
                disabled={debugCalculating}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="divisionChampion"
                className="mr-2 h-5 w-5"
                checked={overrideData.divisionChampion}
                onChange={(e) => setOverrideData({...overrideData, divisionChampion: e.target.checked})}
                disabled={debugCalculating}
              />
              <label htmlFor="divisionChampion" className="text-sm text-gray-600">
                Division Champion
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="championshipWinner"
                className="mr-2 h-5 w-5"
                checked={overrideData.championshipWinner}
                onChange={(e) => setOverrideData({...overrideData, championshipWinner: e.target.checked, 
                  // Uncheck finalist if winner is checked
                  championshipFinalist: e.target.checked ? false : overrideData.championshipFinalist})}
                disabled={debugCalculating}
              />
              <label htmlFor="championshipWinner" className="text-sm text-gray-600">
                Championship Winner
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="championshipFinalist"
                className="mr-2 h-5 w-5"
                checked={overrideData.championshipFinalist}
                onChange={(e) => setOverrideData({...overrideData, championshipFinalist: e.target.checked,
                  // Uncheck winner if finalist is checked
                  championshipWinner: e.target.checked ? false : overrideData.championshipWinner})}
                disabled={debugCalculating}
              />
              <label htmlFor="championshipFinalist" className="text-sm text-gray-600">
                Championship Finalist
              </label>
            </div>
          </div>
          
          <button
            onClick={handleDebugWithOverrides}
            disabled={debugCalculating || !teamNumberToDebug}
            className={`px-4 py-2 rounded ${
              debugCalculating || !teamNumberToDebug
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {debugCalculating ? 'Calculating...' : 'Calculate With Overrides'}
          </button>
        </div>
        
        {debugMessage && (
          <div className={`mb-4 px-4 py-3 rounded ${
            debugMessage.includes('Error') 
              ? 'bg-red-100 border border-red-400 text-red-700' 
              : 'bg-green-100 border border-green-400 text-green-700'
          }`}>
            {debugMessage}
          </div>
        )}
        
        {teamScoreBreakdown && (
          <div className="mt-6 border rounded-lg overflow-hidden">
            <h3 className="text-lg font-semibold bg-gray-100 px-4 py-2 border-b">
              Score Breakdown for Team {teamNumberToDebug}
            </h3>
            <div className="p-4">
              <div className="grid gap-4">
                <div className="bg-gray-50 p-3 rounded border">
                  <div className="flex justify-between items-center">
                    <div className="font-medium text-gray-700">Ranking Points</div>
                    <div className="font-bold text-black">{teamScoreBreakdown.breakdown?.rankingPoints || 0} points</div>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded border">
                  <div className="flex justify-between items-center">
                    <div className="font-medium text-gray-700">Win Points</div>
                    <div className="font-bold text-black">{teamScoreBreakdown.breakdown?.winPoints || 0} points</div>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded border">
                  <div className="flex justify-between items-center">
                    <div className="font-medium text-gray-700">Stat Points (EPA)</div>
                    <div className="font-bold text-black">{teamScoreBreakdown.breakdown?.statPoints || 0} points</div>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded border">
                  <div className="flex justify-between items-center">
                    <div className="font-medium text-gray-700">Award Points</div>
                    <div className="font-bold text-black">{teamScoreBreakdown.breakdown?.awardPoints || 0} points</div>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded border">
                  <div className="flex justify-between items-center">
                    <div className="font-medium text-gray-700">Elimination Points</div>
                    <div className="font-bold text-black">{teamScoreBreakdown.breakdown?.eliminationPoints || 0} points</div>
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded border">
                  <div className="flex justify-between items-center">
                    <div className="font-medium text-gray-700">Championship Points</div>
                    <div className="font-bold text-black">{teamScoreBreakdown.breakdown?.championshipPoints || 0} points</div>
                  </div>
                  {teamScoreBreakdown.breakdown?.championshipPoints > 0 && (
                    <div className="mt-1 text-xs text-gray-500">
                      Includes division champion and championship winner bonuses
                    </div>
                  )}
                </div>
                <div className="bg-blue-50 p-3 rounded border border-blue-200">
                  <div className="flex justify-between items-center">
                    <div className="font-medium text-blue-700">Total Score</div>
                    <div className="font-bold text-blue-900">{teamScoreBreakdown.totalPoints || 0} points</div>
                  </div>
                </div>
              </div>
              
              {eventPerformance && (
                <div className="mt-6">
                  <h4 className="font-semibold text-gray-700 mb-2">Raw Performance Data:</h4>
                  
                  {/* Championship status summary */}
                  <div className="mb-3 p-3 bg-orange-50 rounded border border-orange-200">
                    <h5 className="font-medium text-orange-800 mb-1">Championship Status</h5>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-700">Division Champion:</span>
                        <span className={eventPerformance.divisionChampion ? "font-semibold text-green-600" : "text-gray-500"}>
                          {eventPerformance.divisionChampion ? "Yes" : "No"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-700">Championship Winner:</span>
                        <span className={eventPerformance.championshipWinner ? "font-semibold text-green-600" : "text-gray-500"}>
                          {eventPerformance.championshipWinner ? "Yes" : "No"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-700">Elimination Status:</span>
                        <span className="font-medium">{eventPerformance.eliminationStatus || "none"}</span>
                      </div>
                    </div>
                  </div>
                  
                  <pre className="bg-gray-50 p-3 rounded border overflow-x-auto text-xs font-mono">
                    {performanceJson}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
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
          disabled={calculating || selectedTeams.length > 0}
          className={`px-4 py-2 rounded ${
            calculating || selectedTeams.length > 0
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          {calculating ? 'Calculating...' : 'Calculate Complete Scores for All Teams'}
        </button>
      </div>
      
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-2">Scoring Configuration</h2>
        <div className="bg-white p-4 rounded shadow">
          <div className="mb-3 text-sm text-gray-700 pb-2 border-b">
            <p>This section shows the updated scoring system, including the new tiered EPA points system.</p>
          </div>
        
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <h3 className="font-medium mb-2">Match Points</h3>
              <ul className="list-disc ml-4 text-sm text-gray-700">
                <li>Win: 5 points</li>
                <li>Tie: 2 points</li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium mb-2">Elimination Points</h3>
              <ul className="list-disc ml-4 text-sm text-gray-700">
                <li>Won: 150 points</li>
                <li>Finalist: 100 points</li>
                <li>Semifinalist: 75 points</li>
                <li>Quarterfinalist: 50 points</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-4">
            <h3 className="font-medium mb-2">EPA Progressive Bracket Points</h3>
            <p className="text-sm text-gray-600 mb-2">
              EPA points now use a progressive "tax bracket" system where teams earn base points for reaching a threshold plus additional points for exceeding it.
            </p>
            <EpaBracketExplainer teamEpa={eventPerformance?.epa} />
          </div>
          
          <div className="mt-4">
            <h3 className="font-medium mb-2">Championship Points</h3>
            <ul className="list-disc ml-4 text-sm text-gray-700">
              <li>Division Champion: 50 points</li>
              <li>Championship Winner: 100 additional points</li>
            </ul>
          </div>
          
          <div className="mt-4 text-xs text-gray-500">
            <p className="font-medium">Note:</p>
            <p>Teams with high EPA values earn additional points beyond their bracket base. Ranking points are based on qualification rank.</p>
          </div>
        </div>
      </div>
    </div>
  );
} 