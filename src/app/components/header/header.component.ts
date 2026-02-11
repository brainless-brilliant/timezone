import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimezoneService } from '../../core/services/timezone.service';
import { UrlStateService } from '../../core/services/url-state.service';

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

  protected showCopiedFeedback = signal(false);
  protected isDarkMode = signal(true);

  ngOnInit(): void {
    // Default theme is dark - only switch to light if explicitly saved
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      this.isDarkMode.set(false);
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      // Explicitly ensure dark mode is set (default)
      this.isDarkMode.set(true);
      document.documentElement.removeAttribute('data-theme');
      if (savedTheme !== 'dark') {
        localStorage.setItem('theme', 'dark');
      }
    }
  }

  protected toggleTheme(): void {
    const newTheme = this.isDarkMode() ? 'light' : 'dark';
    this.isDarkMode.set(!this.isDarkMode());

    if (newTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'dark');
    }
  }

  protected async copyLink(): Promise<void> {
    const url = this.urlStateService.generateShareableUrl(this.timezoneService.selectedTimezoneIds());

    try {
      await navigator.clipboard.writeText(url);
      this.showCopiedFeedback.set(true);

      setTimeout(() => {
        this.showCopiedFeedback.set(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  }
}
