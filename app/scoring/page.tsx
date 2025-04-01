import EpaBracketExplainer from '../components/EpaBracketExplainer';

export default function ScoringPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-6">FRC Fantasy Scoring System</h1>
      
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">How Teams Earn Points</h2>
        <p className="mb-4">Points in FRC Fantasy are earned based on team performance metrics across several categories:</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-3">Match Performance</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><span className="font-medium">Wins:</span> 5 points per win</li>
              <li><span className="font-medium">Ties:</span> 2 points per tie</li>
            </ul>
          </div>
          
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-3">Ranking Points</h3>
            <p>Points awarded based on qualification ranking.</p>
            <p className="mt-2 text-sm text-gray-600">Higher ranking teams earn more points.</p>
          </div>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-xl font-semibold mb-3">Performance Rating Points: Progressive Bracket System</h3>
          <p className="mb-4">
            Performance rating points are now awarded using a progressive "tax bracket" system. Teams earn base 
            points for reaching a performance threshold, plus additional points for exceeding that threshold. Top teams can now earn up to 100 base points!
          </p>
          
          <EpaBracketExplainer />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-3">Elimination Round Performance</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><span className="font-medium">Event Winner:</span> 150 points</li>
              <li><span className="font-medium">Finalist:</span> 100 points</li>
              <li><span className="font-medium">Semifinalist:</span> 75 points</li>
              <li><span className="font-medium">Quarterfinalist:</span> 50 points</li>
            </ul>
          </div>
          
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-xl font-semibold mb-3">Championship Bonuses</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li><span className="font-medium">Division Champion:</span> 50 points</li>
              <li><span className="font-medium">Championship Winner:</span> 100 additional points</li>
            </ul>
            <p className="mt-2 text-sm text-gray-600">Only teams that win their division receive the Division Champion bonus.</p>
          </div>
        </div>
      </div>
      
      <div className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Example Calculations</h2>
        
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-xl font-semibold mb-3">Team with Rating 2700 (Event Winner)</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <h4 className="font-medium mb-2">Performance Metrics</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Record: 12-0-0</li>
                <li>Ranking: 1st out of 40 teams</li>
                <li>Rating: 2700</li>
                <li>Elimination Status: Won</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Points Breakdown</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>12 wins × 5 pts = 60 pts</li>
                <li>Rating 2700 = 100 base + (200 × 0.08) = 116 pts</li>
                <li>Event Winner = 150 pts</li>
                <li><strong>Total: 326 points</strong></li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-xl font-semibold mb-3">Team with Rating 1600 (Semifinalist)</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <h4 className="font-medium mb-2">Performance Metrics</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>Record: 8-4-0</li>
                <li>Ranking: 7th out of 40 teams</li>
                <li>Rating: 1600</li>
                <li>Elimination Status: Semifinalist</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Points Breakdown</h4>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>8 wins × 5 pts = 40 pts</li>
                <li>Rating 1600 = 30 base + (100 × 0.05) = 35 pts</li>
                <li>Semifinalist = 75 pts</li>
                <li><strong>Total: 150 points</strong></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      
      <div>
        <h2 className="text-2xl font-semibold mb-4">Frequently Asked Questions</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium mb-2">What is the performance rating?</h3>
            <p>
              The performance rating is a metric that estimates a team's overall strength 
              based on their match performance history. It's similar to Elo ratings in chess or MMR in video games.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">How often are scores updated?</h3>
            <p>
              Scores are updated in real-time as matches are completed and results are published.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">Why did you change to a progressive bracket system?</h3>
            <p>
              The progressive bracket system provides a more nuanced and rewarding approach to performance scoring. It ensures that 
              exceptional teams with very high rating values receive recognition for their performance beyond the base tier, while 
              still maintaining appropriate point differentials between tiers.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">Why are top teams worth 100 points now?</h3>
            <p>
              We've increased the value of top-performing teams to better reflect their impact and importance in the competition.
              Elite teams with rating values of 2500+ now receive 100 base points plus additional points based on their excess rating,
              making them more valuable in fantasy team selections.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 