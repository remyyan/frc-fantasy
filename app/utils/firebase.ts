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
  updateProfile as firebaseUpdateProfile,
  sendPasswordResetEmail
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
  limit,
  deleteDoc
} from 'firebase/firestore';
import { TEAM_LOCK_BYPASS_EMAILS } from './config';

// Firebase configuration
// const firebaseConfig = {
//   apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
//   authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
//   projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
//   storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
//   messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
//   appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
//   measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
// };

const firebaseConfig = {
  apiKey: "AIzaSyDYUvKGh00lqZDH71K2rDiwRei0tDPX7To",
  authDomain: "provsfantasy.firebaseapp.com",
  projectId: "provsfantasy",
  storageBucket: "provsfantasy.firebasestorage.app",
  messagingSenderId: "469716673919",
  appId: "1:469716673919:web:80f9e344480f4d3b37a64a",
  measurementId: "G-LJE6J4R70H"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// Auth functions
export const signIn = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // Update user profile in Firestore
    await saveUserProfile(userCredential.user);
    
    return userCredential;
  } catch (error) {
    console.error("Sign in error:", error);
    throw error;
  }
};

export const signUp = async (email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Create a user profile in Firestore
    await saveUserProfile(userCredential.user);
    
    return userCredential;
  } catch (error: any) {
    console.error("Sign up error:", error);
    throw error;
  }
};

export const signOut = () => {
  return fbSignOut(auth);
};

export const signInWithGoogle = async () => {
  try {
    const userCredential = await signInWithPopup(auth, googleProvider);
    
    // Create or update user profile in Firestore
    await saveUserProfile(userCredential.user);
    
    return userCredential;
  } catch (error: any) {
    console.error("Google sign in error:", error);
    throw error;
  }
};

/**
 * Save user profile data to Firestore
 */
export const saveUserProfile = async (user: User) => {
  try {
    const userProfileRef = doc(db, 'userProfiles', user.uid);
    
    // Check if profile already exists
    const docSnap = await getDoc(userProfileRef);
    
    if (!docSnap.exists()) {
      // Create new profile
      await setDoc(userProfileRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        photoURL: user.photoURL,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    } else {
      // Update existing profile with latest user data
      await updateDoc(userProfileRef, {
        email: user.email,
        displayName: user.displayName || docSnap.data().displayName,
        photoURL: user.photoURL,
        updatedAt: Date.now()
      });
    }
  } catch (error) {
    console.error('Error saving user profile:', error);
  }
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export const onAuthChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, async (user) => {
    // If user is signed in, update their profile in Firestore
    if (user) {
      try {
        await saveUserProfile(user);
      } catch (error) {
        console.error('Error updating user profile on auth change:', error);
      }
    }
    
    // Call the original callback
    callback(user);
  });
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
    
    // Also update the user profile in Firestore
    const userProfileRef = doc(db, 'userProfiles', user.uid);
    await updateDoc(userProfileRef, {
      ...profileData,
      updatedAt: Date.now()
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
};

/**
 * Send a password reset email to the specified email address
 */
export const forgotPassword = async (email: string) => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

// ─── Event configuration (Firestore-backed, replaces globals.ts) ───────────
export interface EventConfig {
  id?: string;                          // Firestore document ID
  eventIds: string[];                   // TBA event keys, e.g. ['2026oncmp1','2026oncmp2']
  eventName: string;
  eventDates: string;
  eventLocation: string;
  competitionStartTime: number;         // Unix timestamp (ms)
  budget: number;
  maxTeams: number;
  isActive: boolean;                    // Is this the currently active event?
  isCompleted: boolean;                 // Has this event finished?
  divisionNames: Record<string, string>; // eventKey -> readable name, e.g. '2026oncmp1' -> 'Science Division'
  createdAt: number;
  updatedAt: number;
}

// Fantasy team interfaces
export interface FantasyTeam {
  id?: string;
  name: string;
  userId: string;
  userName?: string;
  eventId?: string;                     // Which event this team belongs to (Firestore EventConfig doc ID)
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
  isPublic: boolean; // Whether the league is public or private
  password?: string; // Password for private leagues
  inviteCode?: string; // Invite code for direct join links
  eventId?: string;  // Which event this league belongs to
}

// ─── Event Config CRUD ──────────────────────────────────────────────────────

/**
 * Get all events from Firestore
 */
export async function getAllEvents(): Promise<EventConfig[]> {
  try {
    const eventsRef = collection(db, 'events');
    const snapshot = await getDocs(eventsRef);
    const events: EventConfig[] = [];
    snapshot.forEach(d => events.push({ id: d.id, ...d.data() } as EventConfig));
    return events.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('Error getting events:', error);
    return [];
  }
}

/**
 * Get a single event by its Firestore document ID
 */
export async function getEvent(eventId: string): Promise<EventConfig | null> {
  try {
    const eventRef = doc(db, 'events', eventId);
    const snap = await getDoc(eventRef);
    if (snap.exists()) return { id: snap.id, ...snap.data() } as EventConfig;
    return null;
  } catch (error) {
    console.error('Error getting event:', error);
    return null;
  }
}

/**
 * Get the currently active event from Firestore.
 * Falls back to null if no active event is set.
 */
export async function getActiveEvent(): Promise<EventConfig | null> {
  try {
    // First try the systemConfig pointer
    const configRef = doc(db, 'systemConfig', 'active');
    const configSnap = await getDoc(configRef);
    if (configSnap.exists()) {
      const { activeEventId } = configSnap.data();
      if (activeEventId) return getEvent(activeEventId);
    }
    // Fallback: find any event with isActive === true
    const eventsRef = collection(db, 'events');
    const q = query(eventsRef, where('isActive', '==', true));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const d = snapshot.docs[0];
      return { id: d.id, ...d.data() } as EventConfig;
    }
    return null;
  } catch (error) {
    console.error('Error getting active event:', error);
    return null;
  }
}

/**
 * Create a new event in Firestore
 */
export async function createEvent(eventConfig: Omit<EventConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    const eventsRef = collection(db, 'events');
    const docRef = doc(eventsRef);
    await setDoc(docRef, {
      ...eventConfig,
      id: docRef.id,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating event:', error);
    throw error;
  }
}

/**
 * Update an existing event
 */
export async function updateEvent(eventId: string, data: Partial<EventConfig>): Promise<void> {
  try {
    const eventRef = doc(db, 'events', eventId);
    await updateDoc(eventRef, { ...data, updatedAt: Date.now() });
  } catch (error) {
    console.error('Error updating event:', error);
    throw error;
  }
}

/**
 * Set the active event by updating the systemConfig document and toggling isActive flags
 */
export async function setActiveEvent(eventId: string): Promise<void> {
  try {
    // Mark all other events as inactive
    const allEvents = await getAllEvents();
    const updates = allEvents.map(e => {
      const eventRef = doc(db, 'events', e.id!);
      return updateDoc(eventRef, { isActive: e.id === eventId, updatedAt: Date.now() });
    });
    await Promise.all(updates);

    // Update the systemConfig pointer
    const configRef = doc(db, 'systemConfig', 'active');
    await setDoc(configRef, { activeEventId: eventId, updatedAt: Date.now() }, { merge: true });
  } catch (error) {
    console.error('Error setting active event:', error);
    throw error;
  }
}

// ─── Bypass Email List (Firestore-backed) ──────────────────────────────────

/**
 * Get the lock-bypass email list from Firestore.
 * Falls back to the static TEAM_LOCK_BYPASS_EMAILS list if not yet configured.
 */
export async function getBypassEmails(): Promise<string[]> {
  try {
    const configRef = doc(db, 'systemConfig', 'bypassEmails');
    const snap = await getDoc(configRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.emails)) return data.emails as string[];
    }
    return TEAM_LOCK_BYPASS_EMAILS;
  } catch {
    return TEAM_LOCK_BYPASS_EMAILS;
  }
}

/**
 * Overwrite the lock-bypass email list in Firestore.
 */
export async function setBypassEmails(emails: string[]): Promise<void> {
  const configRef = doc(db, 'systemConfig', 'bypassEmails');
  await setDoc(configRef, { emails, updatedAt: Date.now() }, { merge: false });
}

// ─── Fantasy Team CRUD ──────────────────────────────────────────────────────

// Firestore functions
export const createFantasyTeam = async (fantasyTeam: FantasyTeam) => {
  try {
    // Check if user is an admin or special override user - they can create multiple teams
    const currentUser = auth.currentUser;
    const bypassEmails = await getBypassEmails();
    const isAdmin = currentUser && currentUser.email ? bypassEmails.includes(currentUser.email) : false;

    // If not an admin/override user, check if they already have a team FOR THIS EVENT
    if (!isAdmin) {
      const existingTeams = await getFantasyTeamsByUser(fantasyTeam.userId);
      const eventTeams = fantasyTeam.eventId
        ? existingTeams.filter(t => t.eventId === fantasyTeam.eventId)
        : existingTeams;

      if (eventTeams.length > 0) {
        throw new Error('You can only create one fantasy team per event');
      }
    }

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

export const deleteFantasyTeam = async (teamId: string, userId: string, isAdmin: boolean = false) => {
  try {
    // First check if the team exists and if the user is the owner or an admin
    const teamRef = doc(db, 'fantasyTeams', teamId);
    const teamSnap = await getDoc(teamRef);
    
    if (!teamSnap.exists()) {
      throw new Error('Fantasy team not found');
    }
    
    const teamData = teamSnap.data() as FantasyTeam;
    if (teamData.userId !== userId && !isAdmin) {
      throw new Error('You do not have permission to delete this team');
    }
    
    // If checks pass, delete the team
    await deleteDoc(teamRef);
  } catch (error) {
    console.error('Error deleting fantasy team:', error);
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

/**
 * Get all fantasy teams for a specific event
 */
export const getFantasyTeamsByEvent = async (eventId: string): Promise<FantasyTeam[]> => {
  try {
    const fantasyTeamsRef = collection(db, 'fantasyTeams');
    const q = query(fantasyTeamsRef, where('eventId', '==', eventId));
    const querySnapshot = await getDocs(q);
    const teams = querySnapshot.docs.map(d => d.data() as FantasyTeam);
    return teams.sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1));
  } catch (error) {
    console.error('Error getting fantasy teams by event:', error);
    return [];
  }
};

/**
 * Generate a random invite code for leagues
 * @returns A unique 6-character alphanumeric code
 */
function generateInviteCode(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * Find a league by its invite code
 * @param inviteCode The invite code to search for
 * @returns Promise resolving to the league or null if not found
 */
export async function getLeagueByInviteCode(inviteCode: string): Promise<FantasyLeague | null> {
  try {
    if (!inviteCode) return null;
    
    const leaguesRef = collection(db, 'leagues');
    const q = query(leaguesRef, where('inviteCode', '==', inviteCode.toUpperCase()));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) return null;
    
    // Return the first matching league (should be only one)
    return {
      id: querySnapshot.docs[0].id,
      ...querySnapshot.docs[0].data()
    } as FantasyLeague;
  } catch (error) {
    console.error('Error finding league by invite code:', error);
    return null;
  }
}

export const createLeague = async (league: FantasyLeague) => {
  try {
    const leaguesRef = collection(db, 'leagues');
    const docRef = doc(leaguesRef);
    
    // Generate a unique invite code for the league
    const inviteCode = generateInviteCode();
    
    let leagueData: any = {
      ...league,
      id: docRef.id,
      inviteCode: inviteCode,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    // Remove any undefined fields to prevent Firestore errors
    Object.keys(leagueData).forEach(key => {
      if (leagueData[key] === undefined) {
        delete leagueData[key];
      }
    });
    
    // Make sure private leagues have a password
    if (!league.isPublic && !league.password) {
      throw new Error("Private leagues must have a password");
    }
    
    await setDoc(docRef, leagueData);
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating league:', error);
    throw error;
  }
};

export const joinLeague = async (leagueId: string, userId: string) => {
  try {
    if (!leagueId || !userId) {
      throw new Error("League ID and User ID are required");
    }
    
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

/**
 * Retrieves all public leagues from the database
 * @returns Promise resolving to an array of public FantasyLeague objects
 */
export async function getPublicLeagues(): Promise<FantasyLeague[]> {
  try {
    const leaguesRef = collection(db, 'leagues');
    const q = query(
      leaguesRef,
      where('isPublic', '==', true)
    );
    
    const querySnapshot = await getDocs(q);
    const leagues: FantasyLeague[] = [];
    
    querySnapshot.forEach(doc => {
      leagues.push({
        id: doc.id,
        ...doc.data()
      } as FantasyLeague);
    });
    
    // Sort in memory instead to avoid needing composite index
    return leagues.sort((a, b) => b.createdAt - a.createdAt);
  }  catch (error) {
    console.error('Error getting public leagues:', error);
    return [];
  }
}

/**
 * Retrieves all private leagues from the database
 * @returns Promise resolving to an array of private FantasyLeague objects
 */
export async function getPrivateLeagues(): Promise<FantasyLeague[]> {
  try {
    const leaguesRef = collection(db, 'leagues');
    const q = query(
      leaguesRef,
      where('isPublic', '==', false)
    );
    
    const querySnapshot = await getDocs(q);
    const leagues: FantasyLeague[] = [];
    
    querySnapshot.forEach(doc => {
      leagues.push({
        id: doc.id,
        ...doc.data()
      } as FantasyLeague);
    });
    
    // Sort in memory instead to avoid needing composite index
    return leagues.sort((a, b) => b.createdAt - a.createdAt);
  } catch (error) {
    console.error('Error getting private leagues:', error);
    return [];
  }
}

/**
 * Verifies if the provided password matches the league's password
 * @param leagueId The ID of the league
 * @param password The password to verify
 * @returns Promise resolving to a boolean indicating if the password is correct
 */
export async function verifyLeaguePassword(leagueId: string, password: string): Promise<boolean> {
  try {
    const league = await getLeague(leagueId);
    
    if (!league) {
      return false;
    }
    
    // If the league is public, no password is needed
    if (league.isPublic) {
      return true;
    }
    
    // For private leagues, verify the password
    return league.password === password;
  } catch (error) {
    console.error('Error verifying league password:', error);
    return false;
  }
}

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
 * Update a league document
 */
export async function updateLeague(leagueId: string, data: Partial<FantasyLeague>): Promise<void> {
  try {
    const leagueRef = doc(db, 'leagues', leagueId);
    await updateDoc(leagueRef, { ...data, updatedAt: Date.now() });
  } catch (error) {
    console.error('Error updating league:', error);
    throw error;
  }
}

/**
 * Retrieves all fantasy teams within a specific league, filtered to the league's event.
 * @param leagueId The ID of the league
 * @returns Promise resolving to an array of FantasyTeam objects
 */
export async function getFantasyTeamsByLeague(leagueId: string): Promise<FantasyTeam[]> {
  try {
    // Get the league first to retrieve member IDs and eventId
    const leagueDoc = await getLeague(leagueId);

    if (!leagueDoc || !leagueDoc.members || leagueDoc.members.length === 0) {
      return [];
    }

    // Get teams for all members in the league
    const teamsPromises = leagueDoc.members.map(memberId => getFantasyTeamsByUser(memberId));
    const teamsArrays = await Promise.all(teamsPromises);
    const allTeams = teamsArrays.flat();

    // If the league has an eventId, filter teams to only that event
    if (leagueDoc.eventId) {
      return allTeams.filter(t => t.eventId === leagueDoc.eventId);
    }

    return allTeams;
  } catch (error) {
    console.error(`Error getting fantasy teams for league ${leagueId}:`, error);
    return [];
  }
}

/**
 * Gets teams for a specific division from the cache
 */
export async function getCachedDivisionTeams(eventKey: string): Promise<any[] | null> {
  try {
    const divisionRef = doc(db, 'divisions', eventKey);
    const divisionSnap = await getDoc(divisionRef);
    
    if (divisionSnap.exists()) {
      const data = divisionSnap.data();
      return data.teams || [];
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting cached teams for division ${eventKey}:`, error);
    return null;
  }
}

/**
 * Check if a division has cached data and is recent (less than 24 hours old)
 */
export async function hasCachedDivision(eventKey: string): Promise<boolean> {
  try {
    const divisionRef = doc(db, 'divisions', eventKey);
    const divisionSnap = await getDoc(divisionRef);
    
    if (!divisionSnap.exists()) return false;
    
    const data = divisionSnap.data();
    const lastUpdated = data.lastUpdated || 0;
    
    // Check if data is less than 24 hours old
    return (Date.now() - lastUpdated) < 24 * 60 * 60 * 1000;
  } catch (error) {
    console.error(`Error checking cached division ${eventKey}:`, error);
    return false;
  }
}

/**
 * Deletes a league and all associated data
 * @param leagueId The ID of the league to delete
 * @param userId The ID of the user attempting to delete the league
 * @returns Promise that resolves when the league is deleted
 */
export async function deleteLeague(leagueId: string, userId: string): Promise<void> {
  try {
    // First check if the league exists and if the user is the owner
    const leagueRef = doc(db, 'leagues', leagueId);
    const leagueSnap = await getDoc(leagueRef);
    
    if (!leagueSnap.exists()) {
      throw new Error('League not found');
    }
    
    const leagueData = leagueSnap.data() as FantasyLeague;
    if (leagueData.createdBy !== userId) {
      throw new Error('You do not have permission to delete this league');
    }
    
    // If checks pass, delete the league
    await deleteDoc(leagueRef);
  } catch (error) {
    console.error('Error deleting league:', error);
    throw error;
  }
}

/**
 * Gets user information by user IDs
 * @param userIds Array of user IDs to get information for
 * @returns Promise resolving to a map of user IDs to user information
 */
export async function getUsersByIds(userIds: string[]): Promise<Record<string, {displayName: string, email: string | null}>> {
  try {
    const userMap: Record<string, {displayName: string, email: string | null}> = {};
    
    // If the array is empty, return an empty map
    if (userIds.length === 0) {
      return userMap;
    }
    
    // Since Firebase Auth doesn't provide a direct way to get multiple users by ID
    // We'll use Firestore as a fallback to store user profiles
    
    // First try to get users from 'userProfiles' collection that we'll populate when users sign up
    const userProfilesRef = collection(db, 'userProfiles');
    
    // Use in batches of 10 due to Firestore limitations on 'in' queries
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < userIds.length; i += batchSize) {
      const batch = userIds.slice(i, i + batchSize);
      const q = query(userProfilesRef, where('uid', 'in', batch));
      batches.push(getDocs(q));
    }
    
    const results = await Promise.all(batches);
    
    results.forEach(querySnapshot => {
      querySnapshot.forEach(doc => {
        const userData = doc.data();
        if (userData.uid) {
          userMap[userData.uid] = {
            displayName: userData.displayName || 'Unknown User',
            email: userData.email || null
          };
        }
      });
    });
    
    // For any users we couldn't find, use a placeholder
    userIds.forEach(uid => {
      if (!userMap[uid]) {
        userMap[uid] = {
          displayName: 'User ' + uid.substring(0, 6),
          email: null
        };
      }
    });
    
    return userMap;
  } catch (error) {
    console.error('Error getting users:', error);
    
    // Return fallback data with user IDs as display names
    const fallbackUserMap: Record<string, {displayName: string, email: string | null}> = {};
    userIds.forEach(uid => {
      fallbackUserMap[uid] = {
        displayName: 'User ' + uid.substring(0, 6),
        email: null
      };
    });
    
    return fallbackUserMap;
  }
}

/**
 * Get a shareable invite URL for a league
 * @param league The league object or league ID
 * @returns A shareable URL that directly joins the league
 */
export function getLeagueInviteUrl(league: FantasyLeague | string): string {
  if (!league) return '';
  
  const leagueId = typeof league === 'string' ? league : league.id;
  const inviteCode = typeof league === 'string' ? null : league.inviteCode;
  
  if (!leagueId) return '';
  
  // Use the base URL for the app (assume current location in browser)
  const baseUrl = typeof window !== 'undefined' 
    ? `${window.location.protocol}//${window.location.host}`
    : '';
  
  // Create a direct join URL using the invite code
  if (inviteCode) {
    return `${baseUrl}/leagues/join/${inviteCode}`;
  } else {
    // If we don't have an invite code, just return the league page URL
    return `${baseUrl}/leagues/${leagueId}`;
  }
}

/**
 * Join a league using an invite code (bypasses password check)
 * @param inviteCode The invite code for the league
 * @param userId The ID of the user joining
 * @returns Promise resolving to a boolean indicating success
 */
export async function joinLeagueByInviteCode(inviteCode: string, userId: string): Promise<boolean> {
  try {
    // Find the league with this invite code
    const league = await getLeagueByInviteCode(inviteCode);
    
    if (!league || !league.id) {
      return false;
    }
    
    // Check if user is already a member
    if (league.members.includes(userId)) {
      return true; // Already a member, consider this successful
    }
    
    // Add the user to the league members
    await joinLeague(league.id, userId);
    return true;
  } catch (error) {
    console.error('Error joining league by invite code:', error);
    return false;
  }
}

/**
 * Calculate roster percentages for all teams based on fantasy team selections.
 * @param eventId  When provided, only fantasy teams belonging to that event are
 *                 counted, so percentages reflect the current competition only.
 * @returns Promise resolving to an object mapping team numbers to their roster percentage
 */
export async function calculateTeamRosterPercentages(eventId?: string): Promise<Record<number, number>> {
  try {
    const fantasyTeamsRef = collection(db, 'fantasyTeams');
    // Filter by event when an ID is supplied so old-event picks don't inflate %s
    const q = eventId
      ? query(fantasyTeamsRef, where('eventId', '==', eventId))
      : fantasyTeamsRef;
    const fantasyTeamsSnapshot = await getDocs(q);

    if (fantasyTeamsSnapshot.empty) {
      return {};
    }

    // Count total fantasy teams (in this event)
    const totalFantasyTeams = fantasyTeamsSnapshot.size;

    // Count occurrences of each team
    const teamCounts: Record<number, number> = {};

    fantasyTeamsSnapshot.forEach(doc => {
      const fantasyTeam = doc.data() as FantasyTeam;

      if (fantasyTeam.selectedTeams) {
        fantasyTeam.selectedTeams.forEach(team => {
          const teamNumber = team.teamNumber;
          teamCounts[teamNumber] = (teamCounts[teamNumber] || 0) + 1;
        });
      }
    });

    // Calculate percentages
    const percentages: Record<number, number> = {};

    Object.entries(teamCounts).forEach(([teamNumber, count]) => {
      percentages[parseInt(teamNumber)] = Math.round((count / totalFantasyTeams) * 100);
    });

    return percentages;
  } catch (error) {
    console.error('Error calculating team roster percentages:', error);
    return {};
  }
}

/**
 * Retrieves all fantasy teams from the database
 * @returns Promise resolving to an array of FantasyTeam objects
 */
export async function getAllFantasyTeams(): Promise<FantasyTeam[]> {
  try {
    const fantasyTeamsRef = collection(db, 'fantasyTeams');
    const querySnapshot = await getDocs(fantasyTeamsRef);
    
    const teams: FantasyTeam[] = [];
    querySnapshot.forEach(doc => {
      teams.push({ id: doc.id, ...doc.data() } as FantasyTeam);
    });
    
    console.log(`Retrieved ${teams.length} total fantasy teams`);
    return teams.sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1)); // Sort by score descending
  } catch (error) {
    console.error('Error getting all fantasy teams:', error);
    return [];
  }
}

export { app, auth, db }; 