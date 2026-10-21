import { Injectable, signal } from '@angular/core';
import { Dados } from '../models';
import { DADOS_INICIAIS } from './dados-iniciais';

const CHAVE = 'tally:banco-mock';

/**
 * Banco de dados falso. Fica no localStorage pra não perder os pontos
 * quando a página recarrega.
 */
@Injectable({ providedIn: 'root' })
export class BancoMock {
    private readonly estado = signal<Dados>(this.carregar());

    readonly dados = this.estado.asReadonly();

    constructor() {
        // se outra aba alterar o banco, atualiza aqui também
        window.addEventListener('storage', (evento) => {
            if (evento.key === CHAVE) {
                this.estado.set(this.carregar());
            }
        });
    }

    atualizar(alteracao: (dados: Dados) => Dados) {
        const novo = alteracao(this.estado());
        this.estado.set(novo);
        localStorage.setItem(CHAVE, JSON.stringify(novo));
    }

    resetar() {
        localStorage.removeItem(CHAVE);
        this.estado.set(this.carregar());
    }

    private carregar(): Dados {
        const salvo = localStorage.getItem(CHAVE);
        if (salvo) {
            try {
                return JSON.parse(salvo) as Dados;
            } catch {
                localStorage.removeItem(CHAVE);
            }
        }
        return structuredClone(DADOS_INICIAIS);
    }
}
