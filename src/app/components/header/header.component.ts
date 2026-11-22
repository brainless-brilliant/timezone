import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimezoneService } from '../../core/services/timezone.service';
import { UrlStateService } from '../../core/services/url-state.service';
import { TimeCalculationService } from '../../core/services/time-calculation.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {
  private timezoneService = inject(TimezoneService);
  private urlStateService = inject(UrlStateService);
  private timeCalc = inject(TimeCalculationService);

  protected showCopiedFeedback = signal(false);
  protected isDarkMode = signal(true);
  protected hour12 = this.timezoneService.hour12;

  protected localZone = this.timezoneService.localZone;
  protected localLabel = this.localZone.split('/').pop()!.replace(/_/g, ' ');
  protected localTime = computed(() =>
    `${this.timeCalc.formatTime(this.timezoneService.currentTime(), this.localZone, this.hour12())} ${this.timeCalc.getTimezoneAbbr(this.localZone)}`,
  );

  ngOnInit(): void {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('theme');
    } catch {
      saved = null;
    }
    if (saved === 'light' || saved === 'dark') {
      this.applyTheme(saved);
    } else {
      // No explicit choice: follow the system.
      document.documentElement.removeAttribute('data-theme');
      this.isDarkMode.set(!window.matchMedia('(prefers-color-scheme: light)').matches);
    }
  }

  protected setHour12(value: boolean): void {
    this.timezoneService.setHour12(value);
  }

  protected toggleTheme(): void {
    const next = this.isDarkMode() ? 'light' : 'dark';
    this.applyTheme(next);
    try {
      localStorage.setItem('theme', next);
    } catch {
      // Storage unavailable; the choice lasts for this page view only.
    }
  }

  private applyTheme(theme: 'light' | 'dark'): void {
    this.isDarkMode.set(theme === 'dark');
    document.documentElement.setAttribute('data-theme', theme);
  }

  protected async copyLink(): Promise<void> {
    const url = this.urlStateService.generateShareableUrl(this.timezoneService.selectedKeys(), this.timezoneService.pinnedInstant());
    try {
      await navigator.clipboard.writeText(url);
      this.showCopiedFeedback.set(true);
      setTimeout(() => this.showCopiedFeedback.set(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  }
}
