import { Component, inject } from '@angular/core';
import { IonContent, IonButton, IonIcon, NavController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logoGoogle, storefront } from 'ionicons/icons';
import { SessaoService } from '../core/services/sessao.service';

@Component({
  selector: 'app-login-cliente',
  templateUrl: './login-cliente.page.html',
  styleUrls: ['./login-cliente.page.scss'],
  imports: [IonContent, IonButton, IonIcon],
})
export class LoginClientePage {
  private readonly sessao = inject(SessaoService);
  private readonly nav = inject(NavController);

  constructor() {
    addIcons({ logoGoogle, storefront });
  }

  entrarComGoogle() {
    this.sessao.entrarComGoogle();
    this.nav.navigateRoot('/cliente');
  }

  irParaVendedor() {
    this.nav.navigateForward('/login-vendedor');
  }
}
