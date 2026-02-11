import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimezoneService } from '../../core/services/timezone.service';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './empty-state.component.html',
  styleUrls: ['./empty-state.component.scss']
})
export class EmptyStateComponent {
  private timezoneService = inject(TimezoneService);

  protected quickAddCities = [
    { id: 'America/New_York', name: 'New York' },
    { id: 'Europe/London', name: 'London' },
    { id: 'Asia/Tokyo', name: 'Tokyo' },
    { id: 'Australia/Sydney', name: 'Sydney' }
  ];

  protected addQuickCity(id: string): void {
    this.timezoneService.addTimezone(id);
    this.timezoneService.syncState();
  }
}
