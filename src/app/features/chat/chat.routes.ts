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
  // Deep-link into a specific conversation. Notification actions of type
  // navigate_to_conversation emit the peer user id; without this child route
  // the URL /messages/<uid> would 404. The page reads the param via the
  // `userId` input and selects that conversation on load.
  {
    path: ':userId',
    canActivate: [authGuard],
    title: 'Chat',
    loadComponent: () =>
      import('./pages/chat-page/chat-page.component').then((m) => m.ChatPageComponent),
  },
];