import { Routes } from '@angular/router';

export const devToolsRoutes: Routes = [
  {
    path: '',
    title: 'Packet Inspector',
    loadComponent: () =>
      import('./pages/packet-inspector-page/packet-inspector-page').then((m) => m.PacketInspectorPageComponent),
  },
];
