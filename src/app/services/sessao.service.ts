import { Injectable, computed, inject, signal } from '@angular/core';
import { BancoMock } from '../aux/mock/banco-mock';
import { Sessao } from '../model/models';

const CHAVE = 'tally:sessao';

// conta que o "login com Google" simulado sempre devolve
const CLIENTE_GOOGLE = 'C-0001';

// loja/vendedor padrão quando o e-mail autenticado no Firebase não corresponde a um vendedor mockado
const VENDEDOR_PADRAO = 'V-01';

@Injectable({ providedIn: 'root' })
export class SessaoService {
    private readonly banco = inject(BancoMock);

    // sessionStorage: cada aba tem a sua, dá pra testar cliente e vendedor lado a lado
    private readonly atual = signal<Sessao | null>(this.lerSalva());

    readonly cliente = computed(() => {
        const sessao = this.atual();
        if (sessao?.tipo !== 'cliente') {
            return null;
        }
        return this.banco.dados().clientes.find((c) => c.id === sessao.id) ?? null;
    });

    readonly vendedor = computed(() => {
        const sessao = this.atual();
        if (sessao?.tipo !== 'vendedor') {
            return null;
        }
        return this.banco.dados().vendedores.find((v) => v.id === sessao.id) ?? null;
    });

    readonly loja = computed(() => {
        const vendedor = this.vendedor();
        return this.banco.dados().lojas.find((l) => l.id === vendedor?.lojaId) ?? null;
    });

    entrarComGoogle() {
        this.salvar({ tipo: 'cliente', id: CLIENTE_GOOGLE });
    }

    entrarComoVendedor(email: string, senha: string): boolean {
        const vendedor = this.banco
            .dados()
            .vendedores.find((v) => v.email === email.trim().toLowerCase() && v.senha === senha);

        if (!vendedor) {
            return false;
        }

        this.salvar({ tipo: 'vendedor', id: vendedor.id });
        return true;
    }

    /**
     * Activates the mock seller session after Firebase authentication.
     * Matches an existing mock seller by email when available, otherwise falls back to `VENDEDOR_PADRAO`.
     *
     * @param email - Authenticated seller email from Firebase.
     */
    entrarComoVendedorFirebase(email?: string | null): void {
        const emailNormalizado = email?.trim().toLowerCase();
        const vendedores = this.banco.dados().vendedores;
        const vendedor =
            (emailNormalizado && vendedores.find((v) => v.email === emailNormalizado)) ||
            vendedores.find((v) => v.id === VENDEDOR_PADRAO) ||
            vendedores[0];

        if (vendedor) {
            this.salvar({ tipo: 'vendedor', id: vendedor.id });
        }
    }

    sair() {
        sessionStorage.removeItem(CHAVE);
        this.atual.set(null);
    }

    private salvar(sessao: Sessao) {
        sessionStorage.setItem(CHAVE, JSON.stringify(sessao));
        this.atual.set(sessao);
    }

    private lerSalva(): Sessao | null {
        const salva = sessionStorage.getItem(CHAVE);
        return salva ? (JSON.parse(salva) as Sessao) : null;
    }
}
