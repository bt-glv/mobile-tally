import { Injectable, inject } from '@angular/core';
import { BancoMock } from '../mock/banco-mock';

@Injectable({ providedIn: 'root' })
export class LojaService {
  private readonly banco = inject(BancoMock);

  renomear(id: string, nome: string) {
    this.banco.atualizar((dados) => ({
      ...dados,
      lojas: dados.lojas.map((loja) => (loja.id === id ? { ...loja, nome } : loja)),
    }));
  }
}
