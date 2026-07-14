import { Routes } from '@angular/router';
import { ErrorPageComponent } from '@core/error/error-page/error-page.component';
import { authGuard } from '@core/guards/auth.guard';
import { profileBundleResolver } from './features/profile/data-access/profile-bundle.resolver';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'rooms',
    pathMatch: 'full',
  },
  {
    path: 'rooms',
    loadChildren: () => import('./features/rooms').then((m) => m.roomsRoutes),
  },
  {
    path: 'login',
    title: 'Sign in',
    data: { fullscreen: true },
    loadComponent: () =>
      import('./features/auth/pages/login-page/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: 'signup',
    title: 'Create account',
    data: { fullscreen: true },
    loadComponent: () =>
      import('./features/auth/pages/signup-page/signup-page.component').then((m) => m.SignupPageComponent),
  },
  {
    path: 'messages',
    title: 'Messages',
    canActivate: [authGuard],
    data: { standalone: true },
    loadComponent: () =>
      import('./features/messages').then((m) => m.MessagesPageComponent),
  },
  { path: 'rtm', redirectTo: 'messages', pathMatch: 'full' },
  {
    path: 'profile',
    title: 'Profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile').then((m) => m.ProfilePageComponent),
    /**
     * Prefetch the bundle in parallel with the lazy chunk download. See
     * `profile-bundle.resolver.ts` for the rationale.
     */
    resolve: { bundle: profileBundleResolver },
  },
  {
    path: 'room',
    loadChildren: () => import('./features/room').then((m) => m.roomRoutes),
  },
  {
    path: 'dev/packets',
    loadChildren: () => import('./features/dev-tools').then((m) => m.devToolsRoutes),
  },
  { path: 'error/401', title: 'Unauthorized', component: ErrorPageComponent, data: { code: 401 } },
  { path: 'error/403', title: 'Forbidden', component: ErrorPageComponent, data: { code: 403 } },
  { path: 'error/404', title: 'Not Found', component: ErrorPageComponent, data: { code: 404 } },
  { path: 'error/500', title: 'Server Error', component: ErrorPageComponent, data: { code: 500 } },
  { path: '**', title: 'Not found', component: ErrorPageComponent, data: { code: 404 } },
];