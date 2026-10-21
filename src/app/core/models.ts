export interface Cliente {
    id: string;
    nome: string;
    email: string;
}

export interface Loja {
    id: string;
    nome: string;
    logo: string;
    banner: string;
    // quantos pontos completam o cartão
    meta: number;
}

export interface Vendedor {
    id: string;
    lojaId: string;
    email: string;
    senha: string;
}

export interface RegistroLog {
    data: string;
    tipo: 'ponto' | 'cupom';
}

export interface Cartao {
    id: string;
    clienteId: string;
    lojaId: string;
    pontos: number;
    criadoEm: string;
    ultimoPontoEm: string | null;
    log: RegistroLog[];
}

export interface CartaoDetalhado extends Cartao {
    cliente: Cliente;
    loja: Loja;
}

export type Sessao = { tipo: 'cliente' | 'vendedor'; id: string };

export interface Dados {
    clientes: Cliente[];
    lojas: Loja[];
    vendedores: Vendedor[];
    cartoes: Cartao[];
}
