import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton, IonContent, IonIcon, IonInput, NavController, ToastController } from '@ionic/angular';
import { FirebaseError } from 'firebase/app';
import { addIcons } from 'ionicons';
import { at, cartOutline, lockClosedOutline } from 'ionicons/icons';
import { Firebase } from '../../services/firebase';
import { SessaoService } from '../../services/sessao.service';
import { VendedorUsuarioCriar } from '../../aux/mock/vendedor-usuario-criar';

/** Maps Firebase Auth error codes to user-facing Portuguese feedback messages. */
const FIREBASE_AUTH_ERRORS: Record<string, string> = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'E-mail ou senha incorretos.',
    'auth/invalid-email': 'Informe um e-mail válido.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns instantes e tente novamente.',
    'auth/network-request-failed': 'Sem conexão com a internet. Verifique sua rede.',
};

/**
 * Seller login page handling Firebase email/password authentication and navigation back to customer login.
 */
@Component({
    selector: 'app-login-vendedor',
    templateUrl: './login-vendedor.page.html',
    styleUrls: ['./login-vendedor.page.scss'],
    imports: [ReactiveFormsModule, IonContent, IonButton, IonIcon, IonInput],
})
export class LoginVendedorPage {
    private readonly firebase  = inject(Firebase);
    private readonly sessao    = inject(SessaoService);
    private readonly nav       = inject(NavController);
    private readonly toastCtrl = inject(ToastController);

    private authenticating = false;

    /** Reactive login form holding the seller's email and password credentials. */
    readonly form = new FormGroup({
        email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
        senha: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    });

    constructor() {
        addIcons({ at, lockClosedOutline, cartOutline });
    }

    /**
     * Authenticates the seller with Firebase email/password credentials, initializes mock store data,
     * and navigates to the seller `cartoes` page on success.
     */
    async entrar(): Promise<void> {
        if (this.authenticating) {
            return;
        }

        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return this.avisar('Informe um e-mail e uma senha válidos.');
        }

        const { email, senha } = this.form.getRawValue();
        this.authenticating = true;

        try {
            const user = await this.firebase.loginWithEmail(email, senha);
            if (!user) {
                return this.avisar('Não foi possível autenticar. Tente novamente.');
            }

            this.sessao.entrarComoVendedorFirebase(user.email ?? email);
            await this.nav.navigateRoot('/vendedor/cartoes');
        } catch (error) {
            console.error('Seller login failed', error);
            await this.avisar(this.mensagemErroLogin(error));
        } finally {
            this.authenticating = false;
        }
    }

    /**
     * Navigates back to the customer login page (`/login-cliente`).
     */
    voltarParaCliente(): void {
        this.nav.navigateBack('/login-cliente');
    }

    /**
     * Displays a placeholder message while password recovery is unavailable.
     */
    esqueceuSenha(): void {
        void this.avisar('Recuperação de senha ainda não está disponível.');
    }

    /**
     * Displays a placeholder message while store registration is unavailable.
     */
    cadastrar(): void {
        void this.avisar('Cadastro de lojas ainda não está disponível.');
    }

    /**
     * Resolves a Firebase error into a localized user-facing message.
     *
     * @param error - Unknown error thrown during Firebase authentication.
     * @returns Localized error message suitable for toast feedback.
     */
    private mensagemErroLogin(error: unknown): string {
        if (error instanceof FirebaseError) {
            return FIREBASE_AUTH_ERRORS[error.code] ?? 'Não foi possível fazer login. Tente novamente.';
        }

        return 'Não foi possível fazer login. Tente novamente.';
    }

    /**
     * Shows a short top-aligned toast notification with the given message.
     *
     * @param mensagem - Text displayed inside the toast.
     */
    private async avisar(mensagem: string): Promise<void> {
        const toast = await this.toastCtrl.create({ message: mensagem, duration: 2500, position: 'top' });
        await toast.present();
    }
}
