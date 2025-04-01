'use client';

import React from 'react';
import { calculateEpaPoints, EPA_BRACKETS } from '../utils/scoring';

type EpaBracket = {
  threshold: number;
  basePoints: number;
  marginalRate: number;
  label: string;
  color: string;
};

type Props = {
  teamEpa?: number;
  compact?: boolean;
};

export default function EpaBracketExplainer({ teamEpa, compact = false }: Props) {
  const [customEpa, setCustomEpa] = React.useState<string>(teamEpa?.toString() || '');
  const [calculatedPoints, setCalculatedPoints] = React.useState<number | null>(
    teamEpa ? calculateEpaPoints(teamEpa) : null
  );

  const handleCalculate = () => {
    const epaValue = parseFloat(customEpa);
    if (!isNaN(epaValue)) {
      setCalculatedPoints(calculateEpaPoints(epaValue));
    }
  };

  // Calculate bracket details for a specific EPA value
  const getBracketDetails = (epaValue: number) => {
    if (!epaValue) return null;
    
    for (const bracket of EPA_BRACKETS) {
      if (epaValue >= bracket.threshold) {
        const excessEpa = epaValue - bracket.threshold;
        const excessPoints = Math.round(excessEpa * bracket.marginalRate);
        const totalPoints = bracket.basePoints + excessPoints;
        
        return {
          ...bracket,
          epaValue,
          excessEpa,
          excessPoints,
          totalPoints
        };
      }
    }
    
    return null;
  };

  const activeBracket = teamEpa ? getBracketDetails(teamEpa) : null;

  if (compact) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-medium text-gray-800 mb-2">EPA Brackets</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-1 text-left">Threshold</th>
                <th className="p-1 text-left">Base</th>
                <th className="p-1 text-left">Rate</th>
              </tr>
            </thead>
            <tbody>
              {EPA_BRACKETS.map((bracket, index) => (
                <tr 
                  key={bracket.threshold}
                  className={`${index < EPA_BRACKETS.length - 1 ? 'border-b' : ''} ${
                    activeBracket && bracket.threshold === activeBracket.threshold ? 'bg-blue-50' : ''
                  }`}
                >
                  <td className={`p-1 font-medium ${
                    bracket.threshold >= 1500 ? 'text-green-800' : 
                    bracket.threshold >= 750 ? 'text-yellow-800' : 'text-gray-800'
                  }`}>
                    {bracket.threshold}+
                  </td>
                  <td className="p-1">{bracket.basePoints}</td>
                  <td className="p-1">+{bracket.marginalRate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {teamEpa && activeBracket && (
          <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
            Points: {activeBracket.totalPoints}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-3">EPA Progressive Bracket Points</h3>
      <p className="text-sm text-gray-600 mb-4">
        EPA points now use a progressive "tax bracket" system where teams earn base points for reaching a threshold 
        plus additional points for exceeding it. Top teams can now earn up to 100 base points!
      </p>
      
      <div className="overflow-x-auto mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">EPA Threshold</th>
              <th className="p-2 text-left">Base Points</th>
              <th className="p-2 text-left">Marginal Rate</th>
              <th className="p-2 text-left">Examples</th>
            </tr>
          </thead>
          <tbody>
            {EPA_BRACKETS.map((bracket, index) => (
              <tr 
                key={bracket.threshold}
                className={`${index < EPA_BRACKETS.length - 1 ? 'border-b' : ''} ${
                  activeBracket && bracket.threshold === activeBracket.threshold ? 'bg-blue-50' : ''
                }`}
              >
                <td className={`p-2 font-medium ${
                  bracket.threshold >= 1500 ? 'text-green-800' : 
                  bracket.threshold >= 750 ? 'text-yellow-800' : 'text-gray-800'
                }`}>
                  {bracket.threshold}+
                </td>
                <td className="p-2">{bracket.basePoints} points</td>
                <td className="p-2">+{bracket.marginalRate} pts per point above</td>
                <td className="p-2 text-xs">
                  Value {bracket.threshold + 100} = {bracket.basePoints} + ({100} × {bracket.marginalRate}) = {bracket.basePoints + Math.round(100 * bracket.marginalRate)} pts<br />
                  Value {bracket.threshold + 200} = {bracket.basePoints} + ({200} × {bracket.marginalRate}) = {bracket.basePoints + Math.round(200 * bracket.marginalRate)} pts
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="p-4 bg-gray-50 rounded-lg mb-6">
        <h4 className="font-medium mb-2">EPA Points Calculator</h4>
        <div className="flex items-center">
          <input
            type="text"
            value={customEpa}
            onChange={(e) => setCustomEpa(e.target.value)}
            placeholder="Enter EPA value"
            className="border rounded p-2 mr-2 w-32"
          />
          <button
            onClick={handleCalculate}
            className="bg-blue-500 text-white rounded px-4 py-2 hover:bg-blue-600"
          >
            Calculate
          </button>
        </div>
        
        {calculatedPoints !== null && (
          <div className="mt-3 p-3 bg-blue-50 rounded">
            <p className="font-medium">Points: {calculatedPoints}</p>
            {parseFloat(customEpa) && (
              <div className="text-sm mt-1">
                {(() => {
                  const details = getBracketDetails(parseFloat(customEpa));
                  if (details) {
                    return (
                      <>
                        <span className={`px-1.5 py-0.5 rounded-full inline-block ${details.color} text-xs`}>
                          {details.label} Bracket
                        </span>
                        <p className="mt-1">
                          {details.basePoints} base points + {details.excessPoints} excess points 
                          ({details.excessEpa.toFixed(1)} × {details.marginalRate} rate)
                        </p>
                      </>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
          </div>
        )}
      </div>
      
      {teamEpa && activeBracket && (
        <div className="p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium mb-2">Team EPA Analysis</h4>
          <div className="text-sm">
            <p>
              <span className="font-semibold">EPA Value:</span> {teamEpa.toFixed(1)}
            </p>
            <p>
              <span className="font-semibold">Bracket:</span>{" "}
              <span className={`px-1.5 py-0.5 rounded-full inline-block ${activeBracket.color} text-xs`}>
                {activeBracket.label}
              </span>
            </p>
            <p>
              <span className="font-semibold">Base Points:</span> {activeBracket.basePoints}
            </p>
            <p>
              <span className="font-semibold">Excess Value:</span> {activeBracket.excessEpa.toFixed(1)} 
              (above {activeBracket.threshold} threshold)
            </p>
            <p>
              <span className="font-semibold">Marginal Points:</span> {activeBracket.excessPoints} 
              ({activeBracket.excessEpa.toFixed(1)} × {activeBracket.marginalRate})
            </p>
            <p className="font-medium mt-2">
              Total EPA Points: {activeBracket.totalPoints}
            </p>
          </div>
        </div>
      )}
    </div>
  );
} 