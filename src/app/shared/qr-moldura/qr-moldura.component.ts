import { Component, input } from '@angular/core';
import { QRCodeComponent } from 'angularx-qrcode';

@Component({
  selector: 'app-qr-moldura',
  templateUrl: './qr-moldura.component.html',
  styleUrls: ['./qr-moldura.component.scss'],
  imports: [QRCodeComponent],
})
export class QrMolduraComponent {
  conteudo = input.required<string>();
  tamanho = input(180);
}
