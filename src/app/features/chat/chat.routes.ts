import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';

export const CHAT_ROUTES: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    title: 'Chat',
    loadComponent: () =>
      import('./pages/chat-page/chat-page.component').then((m) => m.ChatPageComponent),
  },
];