import { Component, inject } from '@angular/core';
import { AlertController, IonAvatar, IonButton, IonIcon, NavController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { logOutOutline, pencil } from 'ionicons/icons';
import { LojaService } from '../../core/services/loja.service';
import { SessaoService } from '../../core/services/sessao.service';

@Component({
  selector: 'app-cabecalho-loja',
  templateUrl: './cabecalho-loja.component.html',
  styleUrls: ['./cabecalho-loja.component.scss'],
  imports: [IonAvatar, IonButton, IonIcon],
})
export class CabecalhoLojaComponent {
  private readonly sessao = inject(SessaoService);
  private readonly lojaService = inject(LojaService);
  private readonly alertCtrl = inject(AlertController);
  private readonly nav = inject(NavController);

  readonly loja = this.sessao.loja;

  constructor() {
    addIcons({ pencil, logOutOutline });
  }

  async editarNome() {
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

  sair() {
    this.sessao.sair();
    this.nav.navigateRoot('/login-vendedor');
  }
}
