import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonContent, IonItem, IonLabel, IonList, NavController } from '@ionic/angular';
import { CartaoService } from '../../core/services/cartao.service';
import { Firebase } from '../../core/services/firebase';
import { SessaoService } from '../../core/services/sessao.service';
import { CabecalhoLojaComponent } from '../../shared/cabecalho-loja/cabecalho-loja.component';

/** Maximum number of recent loyalty cards shown on the seller summary page. */
const LIMITE_RESUMO = 5;

/**
 * Seller overview page listing the store's most recent active loyalty cards.
 */
@Component({
    selector: 'app-vendedor-cartoes',
    templateUrl: './cartoes.page.html',
    styleUrls: ['./cartoes.page.scss'],
    imports: [RouterLink, IonContent, IonList, IonItem, IonLabel, IonButton, CabecalhoLojaComponent],
})
export class CartoesPage implements OnInit {
    private readonly firebase = inject(Firebase);
    private readonly sessao = inject(SessaoService);
    private readonly cartaoService = inject(CartaoService);
    private readonly navigator = inject(NavController);

    /** All loyalty cards belonging to the active store. */
    private readonly todos = computed(() => {
        const loja = this.sessao.loja();
        return loja ? this.cartaoService.daLoja(loja.id) : [];
    });

    /** Most recent loyalty cards capped at `LIMITE_RESUMO`. */
    readonly recentes = computed(() => this.todos().slice(0, LIMITE_RESUMO));

    /** Indicates whether the store has more cards beyond `LIMITE_RESUMO`. */
    readonly temMais = computed(() => this.todos().length > LIMITE_RESUMO);

    /**
     * Ensures the mock seller session is populated when navigating directly while signed in to Firebase.
     */
    async ngOnInit(): Promise<void> {
        if (this.sessao.loja()) {
            return;
        }

        if (await this.firebase.isLoggedIn()) {
            // this.sessao.entrarComoVendedorFirebase(this.firebase.auth.currentUser?.email);
        }
    }

    async sair() {
        await this.firebase.logout()
        this.sessao.sair();
        this.navigator.navigateRoot('/login-cliente');
    }
}
