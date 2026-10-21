import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonButton, IonCard, IonCardContent, IonContent, IonIcon, IonThumbnail, ModalController, NavController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logOutOutline } from 'ionicons/icons';
import { interval } from 'rxjs';
import { CartaoDetalhado } from '../../core/models';
import { VALIDADE_QR_CLIENTE, montarQrCliente } from '../../core/qr/qr-conteudo';
import { CartaoService } from '../../core/services/cartao.service';
import { SessaoService } from '../../core/services/sessao.service';
import { PontosGridComponent } from '../../shared/pontos-grid/pontos-grid.component';
import { QrMolduraComponent } from '../../shared/qr-moldura/qr-moldura.component';
import { CartaoPopupComponent } from '../cartao-popup/cartao-popup.component';

@Component({
  selector: 'app-cliente-menu',
  templateUrl: './cliente-menu.page.html',
  styleUrls: ['./cliente-menu.page.scss'],
  imports: [IonContent, IonCard, IonCardContent, IonThumbnail, IonButton, IonIcon, QrMolduraComponent, PontosGridComponent],
})
export class ClienteMenuPage {
  private readonly sessao = inject(SessaoService);
  private readonly cartaoService = inject(CartaoService);
  private readonly modalCtrl = inject(ModalController);
  private readonly nav = inject(NavController);

  readonly cliente = this.sessao.cliente;
  readonly qrCliente = signal('');

  readonly cartoes = computed(() => {
    const cliente = this.cliente();
    return cliente ? this.cartaoService.doCliente(cliente.id) : [];
  });

  constructor() {
    addIcons({ logOutOutline });
    this.renovarQr();

    // troca o código um pouco antes dos 3 minutos pra nunca ficar vencido na tela
    interval(VALIDADE_QR_CLIENTE - 10_000)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.renovarQr());
  }

  async abrirCartao(cartao: CartaoDetalhado) {
    const modal = await this.modalCtrl.create({
      component: CartaoPopupComponent,
      componentProps: { cartaoId: cartao.id },
      cssClass: 'cartao-popup',
    });
    await modal.present();
  }

  sair() {
    this.sessao.sair();
    this.nav.navigateRoot('/login-cliente');
  }

  private renovarQr() {
    const cliente = this.cliente();
    if (cliente) {
      this.qrCliente.set(montarQrCliente(cliente.id));
    }
  }
}
