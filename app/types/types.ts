export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface FantasyTeam {
  id?: string;
  name: string;
  userId: string;
  userName?: string;
  selectedTeams: {
    teamNumber: number;
    teamName: string;
    cost: number;
  }[];
  totalCost: number;
  totalScore?: number;
  createdAt: number;
  updatedAt: number;
  leagueId?: string;
}

export interface FantasyLeague {
  id?: string;
  name: string;
  description?: string;
  createdBy: string;
  members: string[];
  createdAt: number;
  updatedAt: number;
  joinCode?: string;
  // draftType: string;
  // fantasyTeams: FantasyTeam[];
} 