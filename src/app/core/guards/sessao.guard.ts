import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessaoService } from '../services/sessao.service';

export const clienteGuard: CanActivateFn = () => {
  const sessao = inject(SessaoService);
  return sessao.cliente() ? true : inject(Router).createUrlTree(['/login-cliente']);
};

export const vendedorGuard: CanActivateFn = () => {
  const sessao = inject(SessaoService);
  return sessao.vendedor() ? true : inject(Router).createUrlTree(['/login-vendedor']);
};
