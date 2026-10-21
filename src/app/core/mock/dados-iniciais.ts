import { Cartao, Cliente, Dados, Loja, RegistroLog, Vendedor } from '../models';

const LOGO = 'assets/placeholders/logo-loja.svg';
const BANNER = 'assets/placeholders/banner-loja.svg';

const clientes: Cliente[] = [
  { id: 'C-0001', nome: 'Silvinha da Silva', email: 'silvinha@gmail.com' },
  { id: 'C-0002', nome: 'Fulano de Tal', email: 'fulano.tal@gmail.com' },
  { id: 'C-0003', nome: 'Ciclano Oliveira', email: 'ciclano.oliveira@gmail.com' },
  { id: 'C-0004', nome: 'Beltrano Souza', email: 'beltrano.souza@gmail.com' },
  { id: 'C-0005', nome: 'Maria Aparecida', email: 'maria.aparecida@gmail.com' },
  { id: 'C-0006', nome: 'João Pereira', email: 'joao.pereira@gmail.com' },
  { id: 'C-0007', nome: 'Ana Lima', email: 'ana.lima@gmail.com' },
];

const lojas: Loja[] = [
  { id: 'L-01', nome: 'Verdemar', logo: 'assets/placeholders/logo-loja.svg', banner: 'assets/placeholders/banner-loja.svg', meta: 10 },
  { id: 'L-02', nome: 'Café do Porto', logo: 'assets/placeholders/logo-cafe.svg', banner: 'assets/placeholders/banner-cafe.svg', meta: 10 },
  { id: 'L-03', nome: 'Mercadinho Bom Preço', logo: 'assets/placeholders/logo-mercado.svg', banner: 'assets/placeholders/banner-loja.svg', meta: 10 },
];

const vendedores: Vendedor[] = [
  { id: 'V-01', lojaId: 'L-01', email: 'verdemar@tally.com', senha: '123456' },
  { id: 'V-02', lojaId: 'L-02', email: 'cafe@tally.com', senha: '123456' },
];

const UM_DIA = 24 * 60 * 60 * 1000;

// gera um histórico de pontos espaçados a partir da data de criação
function historico(inicio: string, pontos: number): RegistroLog[] {
  const base = new Date(inicio).getTime();
  return Array.from({ length: pontos }, (_, i) => ({
    data: new Date(base + i * UM_DIA + (i % 3) * 95 * 60 * 1000).toISOString(),
    tipo: 'ponto' as const,
  }));
}

function cartao(id: string, clienteId: string, lojaId: string, criadoEm: string, pontos: number): Cartao {
  const log = historico(criadoEm, pontos);
  return {
    id,
    clienteId,
    lojaId,
    pontos,
    criadoEm: new Date(criadoEm).toISOString(),
    ultimoPontoEm: log.length ? log[log.length - 1].data : null,
    log,
  };
}

const cartoes: Cartao[] = [
  cartao('K-001', 'C-0001', 'L-01', '2026-10-10T13:10:00', 6),
  cartao('K-002', 'C-0001', 'L-02', '2026-09-28T08:30:00', 10),
  cartao('K-003', 'C-0001', 'L-03', '2026-10-14T18:45:00', 3),
  cartao('K-004', 'C-0002', 'L-01', '2026-10-17T09:05:00', 1),
  cartao('K-005', 'C-0003', 'L-01', '2026-10-01T11:20:00', 7),
  cartao('K-006', 'C-0004', 'L-01', '2026-10-08T16:40:00', 3),
  cartao('K-007', 'C-0005', 'L-01', '2026-10-05T10:15:00', 5),
  cartao('K-008', 'C-0006', 'L-01', '2026-09-30T19:00:00', 9),
  cartao('K-009', 'C-0007', 'L-01', '2026-10-15T14:25:00', 2),
  cartao('K-010', 'C-0003', 'L-02', '2026-10-12T07:50:00', 4),
];

export const DADOS_INICIAIS: Dados = { clientes, lojas, vendedores, cartoes };
