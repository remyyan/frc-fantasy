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
  eventId?: string;       // Firestore EventConfig document ID
  selectedTeams: {
    teamNumber: number;
    teamName: string;
    cost: number;
    score?: number;
    breakdown?: {
      rankingPoints?: number;
      winPoints?: number;
      statPoints?: number;
      awardPoints?: number;
      eliminationPoints?: number;
    };
  }[];
  totalCost: number;
  totalScore?: number;
  lastUpdated?: number;
  createdAt: number;
  updatedAt: number;
}

export interface FantasyLeague {
  id?: string;
  name: string;
  description?: string;
  createdBy: string;
  members: string[];
  createdAt: number;
  updatedAt: number;
  isPublic?: boolean;
  password?: string;
  inviteCode?: string;
  joinCode?: string;
  eventId?: string;       // Firestore EventConfig document ID
}