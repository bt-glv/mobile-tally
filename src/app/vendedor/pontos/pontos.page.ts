import { Component, ElementRef, OnDestroy, inject, signal, viewChild } from '@angular/core';
import { AlertController, IonButton, IonContent, IonIcon, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { keypadOutline, videocamOffOutline } from 'ionicons/icons';
import QrScanner from 'qr-scanner';
import { ConteudoQr, lerQr } from '../../core/qr/qr-conteudo';
import { CartaoService } from '../../core/services/cartao.service';
import { SessaoService } from '../../core/services/sessao.service';
import { CabecalhoLojaComponent } from '../../shared/cabecalho-loja/cabecalho-loja.component';

@Component({
  selector: 'app-vendedor-pontos',
  templateUrl: './pontos.page.html',
  styleUrls: ['./pontos.page.scss'],
  imports: [IonContent, IonButton, IonIcon, CabecalhoLojaComponent],
})
export class PontosPage implements OnDestroy {
  private readonly sessao = inject(SessaoService);
  private readonly cartaoService = inject(CartaoService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);

  private readonly video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private scanner?: QrScanner;
  private processando = false;

  readonly semCamera = signal(false);

  constructor() {
    addIcons({ keypadOutline, videocamOffOutline });
  }

  async ionViewDidEnter() {
    if (!this.scanner) {
      this.scanner = new QrScanner(this.video().nativeElement, (resultado) => this.aoLer(resultado.data), {
        preferredCamera: 'environment',
        highlightScanRegion: false,
        highlightCodeOutline: false,
      });
    }

    try {
      await this.scanner.start();
      this.semCamera.set(false);
    } catch {
      this.semCamera.set(true);
    }
  }

  ionViewWillLeave() {
    this.scanner?.stop();
  }

  ngOnDestroy() {
    this.scanner?.destroy();
  }

  async digitarCodigo() {
    this.scanner?.pause();

    const alerta = await this.alertCtrl.create({
      header: 'Digitar código',
      message: 'Informe o Client ID que aparece abaixo do QR Code do cliente.',
      inputs: [{ name: 'codigo', type: 'text', placeholder: 'Ex.: C-0001' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Continuar', role: 'confirm' },
      ],
    });
    await alerta.present();

    const { role, data } = await alerta.onDidDismiss();
    if (role === 'confirm' && data?.values?.codigo) {
      await this.tratar(this.interpretarDigitado(String(data.values.codigo)));
    }
    this.retomar();
  }

  private async aoLer(texto: string) {
    if (this.processando) {
      return;
    }

    this.processando = true;
    this.scanner?.pause();
    await this.tratar(lerQr(texto));
    this.retomar();
  }

  private retomar() {
    this.processando = false;
    if (!this.semCamera()) {
      this.scanner?.start().catch(() => this.semCamera.set(true));
    }
  }

  // aceita o QR completo ou só o ID do cliente, quando a câmera não ajuda
  private interpretarDigitado(texto: string): ConteudoQr | null {
    const lido = lerQr(texto);
    if (lido) {
      return lido;
    }

    const id = texto.trim().toUpperCase();
    return this.cartaoService.buscarCliente(id) ? { tipo: 'cliente', clienteId: id, expiraEm: Date.now() + 60_000 } : null;
  }

  private async tratar(conteudo: ConteudoQr | null) {
    if (!conteudo) {
      return this.mostrarAlerta('QR Code inválido', 'Esse código não pertence ao Tally.');
    }

    return conteudo.tipo === 'cliente' ? this.adicionarPonto(conteudo) : this.validarCupom(conteudo.cartaoId);
  }

  private async adicionarPonto(qr: Extract<ConteudoQr, { tipo: 'cliente' }>) {
    const loja = this.sessao.loja();
    const cliente = this.cartaoService.buscarCliente(qr.clienteId);

    if (!loja || !cliente) {
      return this.mostrarAlerta('Cliente não encontrado', 'Confira o código e tente de novo.');
    }
    if (qr.expiraEm < Date.now()) {
      return this.mostrarAlerta('QR Code expirado', 'Peça para o cliente atualizar a tela do aplicativo.');
    }

    const confirmado = await this.confirmar('Dar ponto', `Adicionar 1 ponto no cartão de ${cliente.nome}?`);
    if (!confirmado) {
      return;
    }

    const resultado = this.cartaoService.darPonto(cliente.id, loja.id);
    if (!resultado.ok) {
      return this.mostrarAlerta('Não foi possível dar o ponto', resultado.motivo);
    }

    const { pontos, loja: lojaDoCartao } = resultado.cartao;
    return this.avisar(`+1 ponto para ${cliente.nome} (${pontos}/${lojaDoCartao.meta})`);
  }

  private async validarCupom(cartaoId: string) {
    const loja = this.sessao.loja();
    const cartao = this.cartaoService.buscarCartao(cartaoId);

    if (!loja || !cartao) {
      return this.mostrarAlerta('Cupom inválido', 'Não encontramos esse cartão.');
    }

    const confirmado = await this.confirmar('Validar cupom', `Usar o cupom de ${cartao.cliente.nome}?`);
    if (!confirmado) {
      return;
    }

    const resultado = this.cartaoService.validarCupom(cartaoId, loja.id);
    if (!resultado.ok) {
      return this.mostrarAlerta('Cupom inválido', resultado.motivo);
    }

    return this.mostrarAlerta('Cupom validado com sucesso', 'Aplique o desconto na compra. O cartão do cliente foi reiniciado.');
  }

  private async confirmar(titulo: string, mensagem: string): Promise<boolean> {
    const alerta = await this.alertCtrl.create({
      header: titulo,
      message: mensagem,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Confirmar', role: 'confirm' },
      ],
    });
    await alerta.present();

    const { role } = await alerta.onDidDismiss();
    return role === 'confirm';
  }

  private async mostrarAlerta(titulo: string, mensagem: string) {
    const alerta = await this.alertCtrl.create({ header: titulo, message: mensagem, buttons: ['OK'] });
    await alerta.present();
    await alerta.onDidDismiss();
  }

  private async avisar(mensagem: string) {
    const toast = await this.toastCtrl.create({ message: mensagem, duration: 3000, position: 'top', color: 'success' });
    await toast.present();
  }
}
