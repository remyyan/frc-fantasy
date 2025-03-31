import { NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/app/utils/firebase';

/**
 * Generate a random invite code for leagues
 */
function generateInviteCode(): string {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

export async function POST() {
  try {
    // Get all leagues from Firestore
    const leaguesCollection = collection(db, 'leagues');
    const leaguesSnapshot = await getDocs(leaguesCollection);
    
    let updatedCount = 0;
    
    // Loop through each league
    for (const leagueDoc of leaguesSnapshot.docs) {
      const league = leagueDoc.data();
      
      // Check if the league already has an invite code
      if (!league.inviteCode) {
        // Generate a new invite code
        const inviteCode = generateInviteCode();
        
        // Update the league with the new invite code
        const leagueRef = doc(db, 'leagues', leagueDoc.id);
        await updateDoc(leagueRef, {
          inviteCode: inviteCode,
          updatedAt: Date.now()
        });
        
        updatedCount++;
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCount} leagues with invite codes`,
      updatedCount
    });
  } catch (error) {
    console.error('Error updating league invite codes:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update league invite codes' },
      { status: 500 }
    );
  }
} 