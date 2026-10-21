import { DatePipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { IonBackButton, IonButtons, IonCard, IonCardContent, IonContent, IonHeader, IonToolbar } from '@ionic/angular';
import { CartaoService } from '../../core/services/cartao.service';

@Component({
  selector: 'app-cartao-detalhe',
  templateUrl: './cartao-detalhe.page.html',
  styleUrls: ['./cartao-detalhe.page.scss'],
  imports: [DatePipe, IonHeader, IonToolbar, IonButtons, IonBackButton, IonContent, IonCard, IonCardContent],
})
export class CartaoDetalhePage {
  private readonly cartaoService = inject(CartaoService);

  // vem do :id da rota
  readonly id = input.required<string>();

  readonly cartao = computed(() => this.cartaoService.buscarCartao(this.id()));
}
