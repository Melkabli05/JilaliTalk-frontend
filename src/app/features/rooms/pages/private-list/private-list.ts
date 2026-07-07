import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-private-list',

  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './private-list.html',
  styleUrl: './private-list.scss',
})
export class PrivateList {}
