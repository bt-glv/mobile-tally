import { Routes } from '@angular/router';
import { clienteGuard, vendedorGuard } from './routing/guards/sessao.guard';

export const routes: Routes = [
    {
        path: '',
        redirectTo: 'login-cliente',
        pathMatch: 'full',
    },
    {
        path: 'login-cliente',
        loadComponent: () => import('./screens/login-cliente/login-cliente.page').then((m) => m.LoginClientePage),
    },
    {
        path: 'login-vendedor',
        loadComponent: () => import('./screens/login-vendedor/login-vendedor.page').then((m) => m.LoginVendedorPage),
    },
    {
        path: 'cliente',
        canActivate: [clienteGuard],
        loadComponent: () => import('./screens/cliente/cliente-menu/cliente-menu.page').then((m) => m.ClienteMenuPage),
    },
    // telas do vendedor que ficam fora das abas (precisam vir antes do 'vendedor' das abas)
    {
        path: 'vendedor/cartoes-ativos',
        canActivate: [vendedorGuard],
        loadComponent: () =>
            import('./components/cartoes-ativos/cartoes-ativos.page').then((m) => m.CartoesAtivosPage),
    },
    {
        path: 'vendedor/cartao/:id',
        canActivate: [vendedorGuard],
        loadComponent: () =>
            import('./components/cartao-detalhe/cartao-detalhe.page').then((m) => m.CartaoDetalhePage),
    },
    {
        path: 'vendedor',
        canActivate: [vendedorGuard],
        loadComponent: () => import('./components/tabs/vendedor-tabs.page').then((m) => m.VendedorTabsPage),
        children: [
            {
                path: 'cartoes',
                loadComponent: () => import('./screens/vendedor/cartoes/cartoes.page').then((m) => m.CartoesPage),
            },
            {
                path: 'pontos',
                loadComponent: () => import('./screens/vendedor/pontos/pontos.page').then((m) => m.PontosPage),
            },
            {
                path: '',
                redirectTo: 'cartoes',
                pathMatch: 'full',
            },
        ],
    },
];
