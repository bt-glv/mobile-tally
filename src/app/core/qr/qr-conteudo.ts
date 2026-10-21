export const VALIDADE_QR_CLIENTE = 3 * 60 * 1000;

const PREFIXO = 'tally';

export type ConteudoQr =
  | { tipo: 'cliente'; clienteId: string; expiraEm: number }
  | { tipo: 'cupom'; cartaoId: string };

export function montarQrCliente(clienteId: string, agora = Date.now()): string {
  return `${PREFIXO}:cliente:${clienteId}:${agora + VALIDADE_QR_CLIENTE}`;
}

export function montarQrCupom(cartaoId: string): string {
  return `${PREFIXO}:cupom:${cartaoId}`;
}

export function lerQr(texto: string): ConteudoQr | null {
  const [prefixo, tipo, id, expiracao] = texto.trim().split(':');
  if (prefixo !== PREFIXO || !id) {
    return null;
  }

  if (tipo === 'cliente') {
    const expiraEm = Number(expiracao);
    return Number.isFinite(expiraEm) ? { tipo, clienteId: id, expiraEm } : null;
  }

  if (tipo === 'cupom') {
    return { tipo, cartaoId: id };
  }

  return null;
}
