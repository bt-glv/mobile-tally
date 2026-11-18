import { Component, inject } from '@angular/core';
import { AlertController, IonAvatar, IonButton, IonIcon, NavController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logOutOutline, pencil } from 'ionicons/icons';
import { Firebase } from '../../services/firebase';
import { LojaService } from '../../services/loja.service';
import { SessaoService } from '../../services/sessao.service';

/**
 * Store header displayed across seller tabs with inline store renaming and logout controls.
 */
@Component({
    selector: 'app-cabecalho-loja',
    templateUrl: './cabecalho-loja.component.html',
    styleUrls: ['./cabecalho-loja.component.scss'],
    imports: [IonAvatar, IonButton, IonIcon],
})
export class CabecalhoLojaComponent {
    private readonly firebase = inject(Firebase);
    private readonly sessao = inject(SessaoService);
    private readonly lojaService = inject(LojaService);
    private readonly alertCtrl = inject(AlertController);
    private readonly nav = inject(NavController);

    /** Active store signal for the currently signed-in seller. */
    readonly loja = this.sessao.loja;

    constructor() {
        addIcons({ pencil, logOutOutline });
    }

    /**
     * Prompts the seller to update the active store's display name.
     */
    async editarNome(): Promise<void> {
        const loja = this.loja();
        if (!loja) {
            return;
        }

        const alerta = await this.alertCtrl.create({
            header: 'Nome da loja',
            inputs: [{ name: 'nome', type: 'text', value: loja.nome, attributes: { maxlength: 40 } }],
            buttons: [
                { text: 'Cancelar', role: 'cancel' },
                {
                    text: 'Salvar',
                    handler: ({ nome }: { nome: string }) => {
                        if (nome.trim()) {
                            this.lojaService.renomear(loja.id, nome.trim());
                        }
                    },
                },
            ],
        });
        await alerta.present();
    }

    /**
     * Signs out from Firebase, clears the mock seller session, and navigates to `/login-vendedor`.
     */
    async sair(): Promise<void> {
        await this.firebase.logout();
        this.sessao.sair();
        await this.nav.navigateRoot('/login-vendedor');
    }
}
