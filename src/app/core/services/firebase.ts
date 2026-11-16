import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithCredential,
    signOut,
    onAuthStateChanged,
    User
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root'})
export class Firebase {

    readonly app  = initializeApp(environment.firebase);
    readonly auth = getAuth(this.app);
    readonly db   = getFirestore(this.app);

    readonly user$ = new Observable<User | null>((subscriber) => {
        return onAuthStateChanged(this.auth, (user) => subscriber.next(user));
    });

    async loginWithGoogle(): Promise<User | null> {
            const provider       = new GoogleAuthProvider();
            const userCredential = await signInWithPopup(this.auth, provider);
            return userCredential.user;
    }

    async logout(): Promise<void> {
        await signOut(this.auth);
    }

    // Usar dentro de "Route Guards" ou ao recarregar a página
    async isLoggedIn(): Promise<boolean> {
        await this.auth.authStateReady();
        return this.auth.currentUser !== null;
    }

    // Usar quando o app já estivar inicializado
    isLoggedInSync(): boolean {
        return this.auth.currentUser !== null;
    }







}
