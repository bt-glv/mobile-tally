import { Injectable, inject } from '@angular/core';
import { BancoMock } from '../mock/banco-mock';
import { Cartao, CartaoDetalhado, Cliente, Dados } from '../models';

export type ResultadoPonto =
| { ok: true; cartao: CartaoDetalhado }
| { ok: false; motivo: string };

export type ResultadoCupom = ResultadoPonto;

@Injectable({ providedIn: 'root' })
export class CartaoService {
    private readonly banco = inject(BancoMock);

    buscarCliente(id: string): Cliente | undefined {
        return this.banco.dados().clientes.find((c) => c.id === id);
    }

    buscarCartao(id: string): CartaoDetalhado | undefined {
        const cartao = this.banco.dados().cartoes.find((c) => c.id === id);
        return cartao && this.detalhar(cartao, this.banco.dados());
    }

    doCliente(clienteId: string): CartaoDetalhado[] {
        const dados = this.banco.dados();
        return dados.cartoes
            .filter((c) => c.clienteId === clienteId)
            .map((c) => this.detalhar(c, dados));
    }

    // mais recentes primeiro
    daLoja(lojaId: string): CartaoDetalhado[] {
        const dados = this.banco.dados();
        return dados.cartoes
            .filter((c) => c.lojaId === lojaId)
            .map((c) => this.detalhar(c, dados))
            .sort((a, b) => this.ultimaAtividade(b) - this.ultimaAtividade(a));
    }

    completo(cartao: CartaoDetalhado): boolean {
        return cartao.pontos >= cartao.loja.meta;
    }

    darPonto(clienteId: string, lojaId: string): ResultadoPonto {
        const dados = this.banco.dados();
        const loja = dados.lojas.find((l) => l.id === lojaId);
        if (!loja || !dados.clientes.some((c) => c.id === clienteId)) {
            return { ok: false, motivo: 'Cliente ou loja não encontrados.' };
        }

        const existente = dados.cartoes.find((c) => c.clienteId === clienteId && c.lojaId === lojaId);
        if (existente && existente.pontos >= loja.meta) {
            return { ok: false, motivo: 'Esse cartão já está completo. O cliente precisa usar o cupom.' };
        }

        const agora = new Date().toISOString();
        const id = existente?.id ?? `K-${Date.now().toString(36).toUpperCase()}`;

        this.banco.atualizar((atual) => {
            if (existente) {
                return this.alterarCartao(atual, id, (c) => ({
                    ...c,
                    pontos: c.pontos + 1,
                    ultimoPontoEm: agora,
                    log: [...c.log, { data: agora, tipo: 'ponto' }],
                }));
            }

            const novo: Cartao = {
                id,
                clienteId,
                lojaId,
                pontos: 1,
                criadoEm: agora,
                ultimoPontoEm: agora,
                log: [{ data: agora, tipo: 'ponto' }],
            };
            return { ...atual, cartoes: [...atual.cartoes, novo] };
        });

        return { ok: true, cartao: this.buscarCartao(id)! };
    }

    /** Marca o cupom como usado e zera o cartão pra começar um novo ciclo. */
    validarCupom(cartaoId: string, lojaId: string): ResultadoCupom {
        const cartao = this.buscarCartao(cartaoId);

        if (!cartao || cartao.lojaId !== lojaId) {
            return { ok: false, motivo: 'Esse cupom não pertence a esta loja.' };
        }
        if (!this.completo(cartao)) {
            return { ok: false, motivo: 'Cupom inválido ou já utilizado.' };
        }

        const agora = new Date().toISOString();
        this.banco.atualizar((atual) =>
            this.alterarCartao(atual, cartaoId, (c) => ({
                ...c,
                pontos: 0,
                log: [...c.log, { data: agora, tipo: 'cupom' }],
            })),
        );

        return { ok: true, cartao: this.buscarCartao(cartaoId)! };
    }

    private alterarCartao(dados: Dados, id: string, alteracao: (c: Cartao) => Cartao): Dados {
        return { ...dados, cartoes: dados.cartoes.map((c) => (c.id === id ? alteracao(c) : c)) };
    }

    private detalhar(cartao: Cartao, dados: Dados): CartaoDetalhado {
        return {
            ...cartao,
            cliente: dados.clientes.find((c) => c.id === cartao.clienteId)!,
            loja: dados.lojas.find((l) => l.id === cartao.lojaId)!,
        };
    }

    private ultimaAtividade(cartao: Cartao): number {
        return new Date(cartao.log.at(-1)?.data ?? cartao.criadoEm).getTime();
    }
}
