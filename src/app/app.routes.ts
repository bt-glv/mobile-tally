import { Routes } from '@angular/router';

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
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
];
