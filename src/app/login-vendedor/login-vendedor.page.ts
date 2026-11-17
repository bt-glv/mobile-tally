import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton, IonContent, IonIcon, IonInput, NavController, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { at, cartOutline, lockClosedOutline } from 'ionicons/icons';
import { SessaoService } from '../core/services/sessao.service';

/**
 * Seller login page handling email/password authentication and navigation back to customer login.
 */
@Component({
    selector: 'app-login-vendedor',
    templateUrl: './login-vendedor.page.html',
    styleUrls: ['./login-vendedor.page.scss'],
    imports: [ReactiveFormsModule, IonContent, IonButton, IonIcon, IonInput],
})
export class LoginVendedorPage {
    private readonly sessao = inject(SessaoService);
    private readonly nav = inject(NavController);
    private readonly toastCtrl = inject(ToastController);

    /** Reactive login form holding the seller's email and password credentials. */
    readonly form = new FormGroup({
        email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
        senha: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    });

    constructor() {
        addIcons({ at, lockClosedOutline, cartOutline });
    }

    /**
     * Validates credentials and authenticates the seller before navigating to `/vendedor`.
     */
    async entrar(): Promise<void> {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return this.avisar('Informe um e-mail e uma senha válidos.');
        }

        const { email, senha } = this.form.getRawValue();
        if (!this.sessao.entrarComoVendedor(email, senha)) {
            return this.avisar('E-mail ou senha incorretos.');
        }

        this.nav.navigateRoot('/vendedor');
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
     * Shows a short top-aligned toast notification with the given message.
     *
     * @param mensagem - Text displayed inside the toast.
     */
    private async avisar(mensagem: string): Promise<void> {
        const toast = await this.toastCtrl.create({ message: mensagem, duration: 2500, position: 'top' });
        await toast.present();
    }
}
