import { TestBed } from '@angular/core/testing';
import { BancoMock } from '../mock/banco-mock';
import { CartaoService } from './cartao.service';

describe('CartaoService', () => {
    let service: CartaoService;

    beforeEach(() => {
        localStorage.clear();
        TestBed.configureTestingModule({});
        service = TestBed.inject(CartaoService);
        TestBed.inject(BancoMock).resetar();
    });

    it('soma ponto no cartão da loja', () => {
        const antes = service.buscarCartao('K-001')!.pontos;
        const res = service.darPonto('C-0001', 'L-01');

        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.cartao.pontos).toBe(antes + 1);
        }
    });

    it('valida cupom completo e zera os pontos', () => {
        const res = service.validarCupom('K-002', 'L-02');

        expect(res.ok).toBe(true);
        if (res.ok) {
            expect(res.cartao.pontos).toBe(0);
            expect(res.cartao.log.at(-1)?.tipo).toBe('cupom');
        }
    });
});
