import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonItem, IonLabel, IonList } from '@ionic/angular';
import { CartaoService } from '../../core/services/cartao.service';
import { SessaoService } from '../../core/services/sessao.service';
import { CabecalhoLojaComponent } from '../../shared/cabecalho-loja/cabecalho-loja.component';

const LIMITE_RESUMO = 5;

@Component({
  selector: 'app-vendedor-cartoes',
  templateUrl: './cartoes.page.html',
  styleUrls: ['./cartoes.page.scss'],
  imports: [RouterLink, IonContent, IonList, IonItem, IonLabel, IonButton, CabecalhoLojaComponent],
})
export class CartoesPage {
  private readonly sessao = inject(SessaoService);
  private readonly cartaoService = inject(CartaoService);

  private readonly todos = computed(() => {
    const loja = this.sessao.loja();
    return loja ? this.cartaoService.daLoja(loja.id) : [];
  });

  readonly recentes = computed(() => this.todos().slice(0, LIMITE_RESUMO));
  readonly temMais = computed(() => this.todos().length > LIMITE_RESUMO);
}
