import { Routes } from '@angular/router';

export const roomsRoutes: Routes = [
  {
    path: '',
    redirectTo: 'voice',
    pathMatch: 'full',
  },
  {
    path: 'voice',
    title: 'Voice Rooms',
    loadComponent: () =>
      import('./pages/voice-list/voice-list').then((m) => m.VoiceListComponent),
  },
  {
    path: 'live',
    title: 'Live Rooms',
    loadComponent: () =>
      import('./pages/live-list/live-list').then((m) => m.LiveList),
  },
];