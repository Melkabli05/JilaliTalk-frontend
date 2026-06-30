import { Routes } from '@angular/router';

export const roomRoutes: Routes = [
  {
    path: ':cname/:busiType',
    title: 'Room',
    loadComponent: () =>
      import('./pages/room-page').then((m) => m.RoomPageComponent),
  },
  {
    path: 'video/:cname/:busiType',
    title: 'Video Room',
    loadComponent: () =>
      import('./pages/video-room-page').then((m) => m.VideoRoomPageComponent),
  },
  {
    path: '',
    title: 'Room',
    redirectTo: 'voice/2',
    pathMatch: 'full',
  },
];