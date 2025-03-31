import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as fbSignOut, 
  onAuthStateChanged, 
  User,
  GoogleAuthProvider,
  signInWithPopup,
  EmailAuthProvider,
  reauthenticateWithCredential as firebaseReauthenticateWithCredential,
  updatePassword,
  updateProfile as firebaseUpdateProfile
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  arrayUnion, 
  query, 
  where, 
  getDocs,
  orderBy,
  limit
} from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBKbTlhmFY_90Iu77OUlzgNdbcp9PxpM6M",
  authDomain: "frcfantasy-6ddda.firebaseapp.com",
  projectId: "frcfantasy-6ddda",
  storageBucket: "frcfantasy-6ddda.firebasestorage.app",
  messagingSenderId: "178456608015",
  appId: "1:178456608015:web:d5714c27be9e4a3e9d127a",
  measurementId: "G-JRK6J0NHV2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Auth functions
export const signIn = (email: string, password: string) => {
  return signInWithEmailAndPassword(auth, email, password);
};

export const signUp = async (email: string, password: string) => {
  try {
    return await createUserWithEmailAndPassword(auth, email, password);
  } catch (error: any) {
    console.error("Sign up error:", error);
    throw error;
  }
};

export const signOut = () => {
  return fbSignOut(auth);
};

export const signInWithGoogle = () => {
  return signInWithPopup(auth, googleProvider);
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export const onAuthChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

/**
 * Reauthenticate a user with email and password
 */
export const reauth = async (user: User, email: string, password: string) => {
  try {
    const credential = EmailAuthProvider.credential(email, password);
    await firebaseReauthenticateWithCredential(user, credential);
  } catch (error) {
    console.error('Error reauthenticating user:', error);
    throw error;
  }
};

/**
 * Change a user's password
 */
export const changePassword = async (user: User, newPassword: string) => {
  try {
    await updatePassword(user, newPassword);
  } catch (error) {
    console.error('Error changing password:', error);
    throw error;
  }
};

/**
 * Update a user's profile information
 */
export const updateProfile = async (user: User, profileData: { displayName?: string; photoURL?: string }) => {
  try {
    await firebaseUpdateProfile(user, profileData);
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
};

// Fantasy team interfaces
export interface FantasyTeam {
  id?: string;
  name: string;
  userId: string;
  userName?: string;
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
  joinCode?: string; // Used for inviting others to join
}

// Firestore functions
export const createFantasyTeam = async (fantasyTeam: FantasyTeam) => {
  try {
    const fantasyTeamsRef = collection(db, 'fantasyTeams');
    const docRef = doc(fantasyTeamsRef);
    
    await setDoc(docRef, {
      ...fantasyTeam,
      id: docRef.id,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating fantasy team:', error);
    throw error;
  }
};

export const updateFantasyTeam = async (teamId: string, data: Partial<FantasyTeam>) => {
  try {
    const teamRef = doc(db, 'fantasyTeams', teamId);
    await updateDoc(teamRef, {
      ...data,
      updatedAt: Date.now()
    });
  } catch (error) {
    console.error('Error updating fantasy team:', error);
    throw error;
  }
};

export const getFantasyTeam = async (teamId: string): Promise<FantasyTeam | null> => {
  try {
    const teamRef = doc(db, 'fantasyTeams', teamId);
    const teamSnap = await getDoc(teamRef);
    
    if (teamSnap.exists()) {
      return teamSnap.data() as FantasyTeam;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting fantasy team:', error);
    return null;
  }
};

export const getFantasyTeamsByUser = async (userId: string): Promise<FantasyTeam[]> => {
  try {
    const fantasyTeamsRef = collection(db, 'fantasyTeams');
    const q = query(
      fantasyTeamsRef, 
      where('userId', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    const teams = querySnapshot.docs.map(doc => doc.data() as FantasyTeam);
    
    return teams.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('Error getting user fantasy teams:', error);
    return [];
  }
};

export const createLeague = async (league: FantasyLeague) => {
  try {
    const leaguesRef = collection(db, 'leagues');
    const docRef = doc(leaguesRef);
    
    // Generate a random 6-character join code
    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    await setDoc(docRef, {
      ...league,
      id: docRef.id,
      joinCode,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating league:', error);
    throw error;
  }
};

export const joinLeague = async (leagueId: string, userId: string) => {
  try {
    const leagueRef = doc(db, 'leagues', leagueId);
    await updateDoc(leagueRef, {
      members: arrayUnion(userId),
      updatedAt: Date.now()
    });
  } catch (error) {
    console.error('Error joining league:', error);
    throw error;
  }
};

export const getLeague = async (leagueId: string): Promise<FantasyLeague | null> => {
  try {
    const leagueRef = doc(db, 'leagues', leagueId);
    const leagueSnap = await getDoc(leagueRef);
    
    if (leagueSnap.exists()) {
      return leagueSnap.data() as FantasyLeague;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting league:', error);
    return null;
  }
};

export const getUserLeagues = async (userId: string): Promise<FantasyLeague[]> => {
  try {
    const leaguesRef = collection(db, 'leagues');
    const q = query(
      leaguesRef, 
      where('members', 'array-contains', userId)
    );
    
    const querySnapshot = await getDocs(q);
    const leagues = querySnapshot.docs.map(doc => doc.data() as FantasyLeague);
    
    return leagues.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('Error getting user leagues:', error);
    return [];
  }
};

export const getLeagueByJoinCode = async (joinCode: string): Promise<FantasyLeague | null> => {
  try {
    const leaguesRef = collection(db, 'leagues');
    const q = query(leaguesRef, where('joinCode', '==', joinCode), limit(1));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      return querySnapshot.docs[0].data() as FantasyLeague;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting league by join code:', error);
    return null;
  }
};

/**
 * Retrieves all leagues from the database
 * @returns Promise resolving to an array of FantasyLeague objects
 */
export async function getAllLeagues(): Promise<FantasyLeague[]> {
  try {
    const leaguesCollection = collection(db, 'leagues');
    const leaguesSnapshot = await getDocs(leaguesCollection);
    
    const leagues: FantasyLeague[] = [];
    
    leaguesSnapshot.forEach(doc => {
      leagues.push({
        id: doc.id,
        ...doc.data()
      } as FantasyLeague);
    });
    
    return leagues.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('Error getting all leagues:', error);
    return [];
  }
}

/**
 * Retrieves all fantasy teams within a specific league
 * @param leagueId The ID of the league
 * @returns Promise resolving to an array of FantasyTeam objects
 */
export async function getFantasyTeamsByLeague(leagueId: string): Promise<FantasyTeam[]> {
  try {
    // Get the league first to retrieve member IDs
    const leagueDoc = await getLeague(leagueId);
    
    if (!leagueDoc || !leagueDoc.members || leagueDoc.members.length === 0) {
      return [];
    }
    
    // Get teams for all members in the league
    const teamsPromises = leagueDoc.members.map(memberId => getFantasyTeamsByUser(memberId));
    const teamsArrays = await Promise.all(teamsPromises);
    
    // Flatten the array of arrays and return
    return teamsArrays.flat();
  } catch (error) {
    console.error(`Error getting fantasy teams for league ${leagueId}:`, error);
    return [];
  }
}

export { app, auth, db }; 