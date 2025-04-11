"use client";

import { useEffect } from "react";
import { useUser, useAuth } from "@clerk/nextjs";
import { doc, setDoc, getDoc, getFirestore, collection} from "firebase/firestore";

export default function useSyncUserProfile() {
    const { userId, isLoaded } = useAuth();
    const { user } = useUser();

    useEffect(() => {
        if (!userId || !user) return;

        const sync = async () => {
            const ref = doc(collection(getFirestore(), "userProfiles", userId));
            const existing = await getDoc(ref);

            if (!existing.exists()) {
                await setDoc(ref, {
                    username: user.username,
                    email: user.primaryEmailAddress?.emailAddress,
                    createdAt: Date.now(),
                });
            }
        };

        sync();
    }, [userId, user, isLoaded]);
}
