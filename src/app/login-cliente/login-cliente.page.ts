import { Component } from '@angular/core';
import { IonContent, IonButton, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logoGoogle, storefront } from 'ionicons/icons';

@Component({
  selector: 'app-login-cliente',
  templateUrl: './login-cliente.page.html',
  styleUrls: ['./login-cliente.page.scss'],
  imports: [IonContent, IonButton, IonIcon],
})
export class LoginClientePage {
  constructor() {
    addIcons({ logoGoogle, storefront });
  }
}
