import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimezoneService } from '../../core/services/timezone.service';
import { UrlStateService } from '../../core/services/url-state.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent {
  private timezoneService = inject(TimezoneService);
  private urlStateService = inject(UrlStateService);

  protected showCopiedFeedback = signal(false);

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
