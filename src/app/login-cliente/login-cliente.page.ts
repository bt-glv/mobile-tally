import { Component, inject, OnInit } from '@angular/core';
import { IonButton, IonContent, IonIcon, NavController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logoGoogle, storefront } from 'ionicons/icons';
import { Firebase } from '../core/services/firebase';
import { SessaoService } from '../core/services/sessao.service';

/**
 * Customer login page backed by Firebase Google authentication and mock session initialization.
 */
@Component({
    selector: 'app-login-cliente',
    templateUrl: './login-cliente.page.html',
    styleUrls: ['./login-cliente.page.scss'],
    imports: [IonContent, IonButton, IonIcon],
})
export class LoginClientePage implements OnInit {
    private readonly firebaseService = inject(Firebase);
    private readonly sessaoService   = inject(SessaoService);
    private readonly navController   = inject(NavController);

    constructor() {
        addIcons({ logoGoogle, storefront });
    }

    /**
     * Checks whether a Firebase user is already signed in and redirects to the customer menu.
     */
    async ngOnInit(): Promise<void> {
        const isLoggedIn = await this.firebaseService.isLoggedIn();
        if (!isLoggedIn) {
            return;
        }

        this.enterClienteMenu();
    }

    /**
     * Authenticates the customer with Google via Firebase and initializes the mock customer session.
     */
    async login_google(): Promise<void> {
        try {
            const user = await this.firebaseService.loginWithGoogle();
            if (!user) {
                return;
            }

            this.enterClienteMenu();
        } catch (error) {
            console.error('Login failed', error);
        }
    }

    /**
     * Activates the mock customer session so mock cards and QR data load, then navigates to `/cliente`.
     */
    private enterClienteMenu(): void {
        this.sessaoService.entrarComGoogle();
        this.navController.navigateRoot('/cliente');
    }
}
