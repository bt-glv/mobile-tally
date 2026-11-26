import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IonButton, IonCard, IonCardContent, IonContent, IonIcon, IonThumbnail, ModalController, NavController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logOutOutline } from 'ionicons/icons';
import { interval } from 'rxjs';
import { CartaoDetalhado } from '../../../model/models';
import { VALIDADE_QR_CLIENTE, montarQrCliente } from '../../../aux/qr/qr-conteudo';
import { CartaoService } from '../../../services/cartao.service';
import { Firebase } from '../../../services/firebase';
import { SessaoService } from '../../../services/sessao.service';
import { PontosGridComponent } from '../../../components/pontos-grid/pontos-grid.component';
import { QrMolduraComponent } from '../../../components/qr-moldura/qr-moldura.component';
import { CartaoPopupComponent } from '../../../components/cartao-popup/cartao-popup.component';
import { ThemeToggleComponent } from '../../../components/theme-toggle/theme-toggle.component';

/**
 * Customer home page displaying the customer's rotating identification QR code and loyalty cards.
 */
@Component({
    selector: 'app-cliente-menu',
    templateUrl: './cliente-menu.page.html',
    styleUrls: ['./cliente-menu.page.scss'],
    imports: [
        IonContent,
        IonCard,
        IonCardContent,
        IonThumbnail,
        IonButton,
        IonIcon,
        QrMolduraComponent,
        PontosGridComponent,
        ThemeToggleComponent,
    ],
})
export class ClienteMenuPage implements OnInit {
    private readonly sessao        = inject(SessaoService);
    private readonly cartaoService = inject(CartaoService);
    private readonly modalCtrl     = inject(ModalController);
    private readonly navigator     = inject(NavController);
    private readonly firebase      = inject(Firebase);

    /** Currently authenticated mock customer profile, or `null` when no session is active. */
    readonly cliente = this.sessao.cliente;

    /** Encoded QR payload identifying the active customer; regenerated periodically. */
    readonly qrCliente = signal('');

    /** Loyalty cards belonging to the active customer. */
    readonly cartoes = computed(() => {
        const cliente = this.cliente();
        return cliente ? this.cartaoService.doCliente(cliente.id) : [];
    });

    constructor() {
        addIcons({ logOutOutline });

        // Keep QR payload synchronized whenever the active customer session loads or clears.
        effect(() => {
            this.renovarQr();
        });

        // troca o código um pouco antes dos 3 minutos pra nunca ficar vencido na tela
        interval(VALIDADE_QR_CLIENTE - 10_000)
            .pipe(takeUntilDestroyed())
            .subscribe(() => this.renovarQr());
    }

    /**
     * Ensures the mock customer session is populated if the user enters directly while signed in to Firebase.
     */
    async ngOnInit(): Promise<void> {
        if (this.cliente()) {
            return;
        }

        if (await this.firebase.isLoggedIn()) {
            this.sessao.entrarComGoogle();
        }
    }

    /**
     * Opens the loyalty card detail modal for the selected card.
     *
     * @param cartao - Detailed loyalty card to inspect.
     */
    async abrirCartao(cartao: CartaoDetalhado): Promise<void> {
        const modal = await this.modalCtrl.create({
            component: CartaoPopupComponent,
            componentProps: { cartaoId: cartao.id },
            cssClass: 'cartao-popup',
        });
        await modal.present();
    }

    /**
     * Signs out from Firebase, clears the mock session, and returns to the customer login page.
     */
    async sair(): Promise<void> {
        await this.firebase.logout();
        this.sessao.sair();
        this.navigator.navigateRoot('/login-cliente');
    }

    /**
     * Generates a fresh QR code payload for the active customer or clears it if logged out.
     */
    private renovarQr(): void {
        const cliente = this.cliente();
        this.qrCliente.set(cliente ? montarQrCliente(cliente.id) : '');
    }
}
