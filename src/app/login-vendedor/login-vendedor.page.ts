import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonButton, IonContent, IonIcon, IonInput, NavController, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { at, cartOutline, lockClosedOutline } from 'ionicons/icons';
import { SessaoService } from '../core/services/sessao.service';

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

  readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    senha: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    addIcons({ at, lockClosedOutline, cartOutline });
  }

  async entrar() {
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

  voltarParaCliente() {
    this.nav.navigateBack('/login-cliente');
  }

  esqueceuSenha() {
    this.avisar('Recuperação de senha ainda não está disponível.');
  }

  cadastrar() {
    this.avisar('Cadastro de lojas ainda não está disponível.');
  }

  private async avisar(mensagem: string) {
    const toast = await this.toastCtrl.create({ message: mensagem, duration: 2500, position: 'top' });
    await toast.present();
  }
}
