import { Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { cart } from 'ionicons/icons';

@Component({
  selector: 'app-pontos-grid',
  templateUrl: './pontos-grid.component.html',
  styleUrls: ['./pontos-grid.component.scss'],
  imports: [IonIcon],
})
export class PontosGridComponent {
  pontos = input.required<number>();
  meta = input.required<number>();

  readonly casas = computed(() =>
    Array.from({ length: this.meta() }, (_, i) => i < this.pontos()),
  );

  constructor() {
    addIcons({ cart });
  }
}
