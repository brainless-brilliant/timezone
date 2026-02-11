import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { HeaderComponent } from './components/header/header.component';
import { TimezoneSearchComponent } from './components/timezone-search/timezone-search.component';
import { TimezoneGridComponent } from './components/timezone-grid/timezone-grid.component';
import { EmptyStateComponent } from './components/empty-state/empty-state.component';
import { FooterComponent } from './components/footer/footer.component';
import { TimezoneService } from './core/services/timezone.service';

@Component({
  selector: 'app-root',
  imports: [
    HeaderComponent,
    TimezoneSearchComponent,
    TimezoneGridComponent,
    EmptyStateComponent,
    FooterComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit, OnDestroy {
  timezoneService = inject(TimezoneService);
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.timezoneService.initialize();
    this.timezoneService.syncState();
    this.tickInterval = setInterval(() => {
      this.timezoneService.tick();
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }
  }
}
