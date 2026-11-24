import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import {
    createUserWithEmailAndPassword,
    getAuth,
    GoogleAuthProvider,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    User,
} from 'firebase/auth';
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Client, clientConverter } from '../model/Client';
import { Store, storeConverter } from '../model/Store';

/**
 * Provides Firebase App, Auth, and Firestore instances along with authentication helper methods.
 */
@Injectable({ providedIn: 'root' })
export class Firebase {

    readonly app  = initializeApp(environment.firebase);
    readonly auth = getAuth(this.app);
    readonly db   = getFirestore(this.app);

    /** Reactive stream emitting the currently authenticated Firebase user or `null` when signed out. */
    readonly user$ = new Observable<User | null>((subscriber) => {
        return onAuthStateChanged(this.auth, (user) => subscriber.next(user));
    });

    /**
     * Signs in a user using the Google OAuth popup flow.
     *
     * @returns The authenticated `User`, or `null` if unavailable.
     */
    async loginWithGoogle(): Promise<User | null> {
        const provider = new GoogleAuthProvider();
        const userCredential = await signInWithPopup(this.auth, provider);

        if(userCredential.user) {
            await this.getCliente(userCredential.user)
        }

        return userCredential.user;
    }

    /**
     * Signs in an existing user with email and password credentials.
     *
     * @param email - User email address (trimmed before authentication).
     * @param password - User account password.
     * @returns The authenticated `User`, or `null` if unavailable.
     */
    async loginWithEmail(email: string, password: string): Promise<User | null> {
        const userCredential = await signInWithEmailAndPassword(this.auth, email.trim(), password);

        if (userCredential.user) {
            await this.getStore(userCredential.user);
        }

        return userCredential.user;
    }

    /**
     * Creates a new user account with email and password credentials.
     *
     * @param email - Email address for the new account (trimmed before registration).
     * @param password - Password for the new account.
     * @returns The newly created `User`, or `null` if unavailable.
     */
    async registerWithEmail(email: string, password: string): Promise<User | null> {
        const userCredential = await createUserWithEmailAndPassword(this.auth, email.trim(), password);
        return userCredential.user;
    }

    /**
     * Sends a password reset email to the specified account address.
     *
     * @param email - Target user email address (trimmed before sending).
     */
    async resetPassword(email: string): Promise<void> {
        await sendPasswordResetEmail(this.auth, email.trim());
    }

    /**
     * Signs out the currently authenticated user.
     */
    async logout(): Promise<void> {
        await signOut(this.auth);
    }

    /**
     * Waits for Firebase Auth initialization and checks if a user is currently signed in.
     * Use in route guards or on page reload.
     *
     * @returns `true` if a user is signed in, otherwise `false`.
     */
    async isLoggedIn(): Promise<boolean> {
        await this.auth.authStateReady();
        return this.auth.currentUser !== null;
    }

    /**
     * Synchronously checks if a user is currently signed in.
     * Use only after the application and Firebase Auth have finished initializing.
     *
     * @returns `true` if `auth.currentUser` is non-null, otherwise `false`.
     */
    isLoggedInSync(): boolean {
        return this.auth.currentUser !== null;
    }

    /**
     * Returns the client object and, if it does not exists for the current client, create it.
    */
    async getCliente(
        user: User,
        customName?: string
    ): Promise<Client> {

        // Reference clients/{user.uid} with your converter attached
        const clientRef = doc(this.db, "clients", user.uid).withConverter(clientConverter);
        const snapshot  = await getDoc(clientRef);

        // Returning user: return their existing Client instance
        if (snapshot.exists()) { return snapshot.data(); }

        // First login: create the Client document using their Auth UID
        const newClient = new Client(
            user.uid,
            customName ?? user.displayName ?? "Client",
            user.email ?? "",
            new Date()
        );

        await setDoc(clientRef, newClient);
        return newClient;
    }

    /**
     * Fetches the store document for the given authenticated user from Firestore,
     * creating a default store document if none exists yet.
     *
     * @param user - Authenticated Firebase user representing the store owner.
     * @param customName - Optional custom display name for the store on initial creation.
     * @param rewardDescription - Optional reward description for the store on initial creation.
     * @returns The existing or newly created `Store` instance.
     */
    async getStore(
        user: User,
        customName?: string,
        rewardDescription?: string
    ): Promise<Store> {
        /** Default number of points required to complete a loyalty card for newly created stores. */
        const DEFAULT_POINTS_REQUIRED = 3;

        const storeRef = doc(this.db, 'stores', user.uid).withConverter(storeConverter);
        const snapshot = await getDoc(storeRef);

        if (snapshot.exists()) {
            return snapshot.data();
        }

        const newStore = new Store(
            user.uid,
            customName ?? user.displayName ?? 'Store',
            DEFAULT_POINTS_REQUIRED,
            rewardDescription ?? '',
            new Date()
        );

        await setDoc(storeRef, newStore);
        return newStore;
    }
}
