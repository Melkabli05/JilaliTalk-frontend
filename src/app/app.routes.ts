import { Routes } from '@angular/router';
import { ErrorPageComponent } from '@core/error/error-page.component';

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
    path: 'rtm',
    title: 'Messages',
    loadComponent: () =>
      import('./features/rtm').then((m) => m.RtmPageComponent),
  },
  {
    path: 'profile',
    title: 'Profile',
    loadComponent: () =>
      import('./features/profile').then((m) => m.ProfilePageComponent),
  },
  {
    path: 'room',
    loadChildren: () => import('./features/room').then((m) => m.roomRoutes),
  },
  { path: 'error/401', title: 'Unauthorized', component: ErrorPageComponent, data: { code: 401 } },
  { path: 'error/403', title: 'Forbidden', component: ErrorPageComponent, data: { code: 403 } },
  { path: 'error/404', title: 'Not Found', component: ErrorPageComponent, data: { code: 404 } },
  { path: 'error/500', title: 'Server Error', component: ErrorPageComponent, data: { code: 500 } },
  { path: '**', title: 'Not found', component: ErrorPageComponent, data: { code: 404 } },
];