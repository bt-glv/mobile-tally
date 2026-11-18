import { Component } from '@angular/core';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { qrCode, ticket } from 'ionicons/icons';

@Component({
  selector: 'app-vendedor-tabs',
  templateUrl: './vendedor-tabs.page.html',
  styleUrls: ['./vendedor-tabs.page.scss'],
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
})
export class VendedorTabsPage {
  constructor() {
    addIcons({ ticket, qrCode });
  }
}
