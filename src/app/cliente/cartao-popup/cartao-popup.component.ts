import { Component, Input, OnInit, inject } from '@angular/core';
import { IonButton, IonIcon, IonThumbnail, ModalController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { close } from 'ionicons/icons';
import { CartaoDetalhado } from '../../core/models';
import { montarQrCupom } from '../../core/qr/qr-conteudo';
import { CartaoService } from '../../core/services/cartao.service';
import { PontosGridComponent } from '../../shared/pontos-grid/pontos-grid.component';
import { QrMolduraComponent } from '../../shared/qr-moldura/qr-moldura.component';

@Component({
  selector: 'app-cartao-popup',
  templateUrl: './cartao-popup.component.html',
  styleUrls: ['./cartao-popup.component.scss'],
  imports: [IonButton, IonIcon, IonThumbnail, PontosGridComponent, QrMolduraComponent],
})
export class CartaoPopupComponent implements OnInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly cartaoService = inject(CartaoService);

  @Input({ required: true }) cartaoId!: string;

  cartao!: CartaoDetalhado;
  completo = false;
  qrCupom = '';

  constructor() {
    addIcons({ close });
  }

  ngOnInit() {
    this.cartao = this.cartaoService.buscarCartao(this.cartaoId)!;
    this.completo = this.cartaoService.completo(this.cartao);
    this.qrCupom = montarQrCupom(this.cartao.id);
  }

  fechar() {
    this.modalCtrl.dismiss();
  }
}
