import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';

export const roomRoutes: Routes = [
  {
    path: ':cname/:busiType',
    title: 'Room',
    canActivate: [authGuard],
    data: { immersive: true },
    loadComponent: () =>
      import('./pages/room-page/room-page').then((m) => m.RoomPageComponent),
  },
  {
    path: 'video/:cname/:busiType',
    title: 'Video Room',
    canActivate: [authGuard],
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