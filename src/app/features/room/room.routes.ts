import { Routes } from '@angular/router';

export const roomRoutes: Routes = [
  {
    path: ':cname/:busiType',
    title: 'Room',
    data: { immersive: true },
    loadComponent: () =>
      import('./pages/room-page/room-page').then((m) => m.RoomPageComponent),
  },
  {
    path: 'video/:cname/:busiType',
    title: 'Video Room',
    data: { immersive: true },
    loadComponent: () =>
      import('./pages/video-room-page/video-room-page').then((m) => m.VideoRoomPageComponent),
  },
  {
    path: '',
    title: 'Room',
    redirectTo: 'voice/2',
    pathMatch: 'full',
  },
];