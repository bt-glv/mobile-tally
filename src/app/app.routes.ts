import { Routes } from '@angular/router';
import { clienteGuard, vendedorGuard } from './core/guards/sessao.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login-cliente',
    pathMatch: 'full',
  },
  {
    path: 'login-cliente',
    loadComponent: () => import('./login-cliente/login-cliente.page').then((m) => m.LoginClientePage),
  },
  {
    path: 'login-vendedor',
    loadComponent: () => import('./login-vendedor/login-vendedor.page').then((m) => m.LoginVendedorPage),
  },
  {
    path: 'cliente',
    canActivate: [clienteGuard],
    loadComponent: () => import('./cliente/cliente-menu/cliente-menu.page').then((m) => m.ClienteMenuPage),
  },
  // telas do vendedor que ficam fora das abas (precisam vir antes do 'vendedor' das abas)
  {
    path: 'vendedor/cartoes-ativos',
    canActivate: [vendedorGuard],
    loadComponent: () =>
      import('./vendedor/cartoes-ativos/cartoes-ativos.page').then((m) => m.CartoesAtivosPage),
  },
  {
    path: 'vendedor/cartao/:id',
    canActivate: [vendedorGuard],
    loadComponent: () =>
      import('./vendedor/cartao-detalhe/cartao-detalhe.page').then((m) => m.CartaoDetalhePage),
  },
  {
    path: 'vendedor',
    canActivate: [vendedorGuard],
    loadComponent: () => import('./vendedor/tabs/vendedor-tabs.page').then((m) => m.VendedorTabsPage),
    children: [
      {
        path: 'cartoes',
        loadComponent: () => import('./vendedor/cartoes/cartoes.page').then((m) => m.CartoesPage),
      },
      {
        path: 'pontos',
        loadComponent: () => import('./vendedor/pontos/pontos.page').then((m) => m.PontosPage),
      },
      {
        path: '',
        redirectTo: 'cartoes',
        pathMatch: 'full',
      },
    ],
  },
];
