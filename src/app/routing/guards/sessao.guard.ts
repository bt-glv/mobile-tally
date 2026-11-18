import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Firebase } from '../../services/firebase';

/**
 * Creates a route guard that verifies whether the user is authenticated via Firebase.
 * Unauthenticated navigation attempts are redirected to the given login route.
 *
 * @param loginRoute - Route path to redirect to when the user is not logged in.
 * @returns A `CanActivateFn` that resolves to `true` if logged in, or a `UrlTree` to the login page.
 */
function createAuthGuard(loginRoute: string): CanActivateFn {
    return async () => {
        const firebase = inject(Firebase);
        const router   = inject(Router);

        const loggedIn = await firebase.isLoggedIn();
        return loggedIn ? true : router.createUrlTree([loginRoute]);
    };
}

/**
 * Route guard protecting customer pages by redirecting unauthenticated users to `/login-cliente`.
 */
export const clienteGuard: CanActivateFn = createAuthGuard('/login-cliente');

/**
 * Route guard protecting seller pages by redirecting unauthenticated users to `/login-vendedor`.
 */
export const vendedorGuard: CanActivateFn = createAuthGuard('/login-vendedor');
