import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonSearchbar,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { CartaoService } from '../../core/services/cartao.service';
import { SessaoService } from '../../core/services/sessao.service';

@Component({
  selector: 'app-cartoes-ativos',
  templateUrl: './cartoes-ativos.page.html',
  styleUrls: ['./cartoes-ativos.page.scss'],
  imports: [
    RouterLink,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonFooter,
    IonSearchbar,
  ],
})
export class CartoesAtivosPage {
  private readonly sessao = inject(SessaoService);
  private readonly cartaoService = inject(CartaoService);

  readonly busca = signal('');

  readonly cartoes = computed(() => {
    const loja = this.sessao.loja();
    const termo = this.busca().trim().toLowerCase();
    const todos = loja ? this.cartaoService.daLoja(loja.id) : [];

    return termo ? todos.filter((c) => c.cliente.nome.toLowerCase().includes(termo)) : todos;
  });

  filtrar(evento: Event) {
    this.busca.set((evento.target as HTMLIonSearchbarElement).value ?? '');
  }
}
