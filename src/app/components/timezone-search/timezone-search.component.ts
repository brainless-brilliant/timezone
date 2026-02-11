import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import { TimezoneService } from '../../core/services/timezone.service';
import { GeocodingService } from '../../core/services/geocoding.service';
import { TimezoneEntry } from '../../core/models/timezone.model';
import { ClickOutsideDirective } from '../../shared/directives/click-outside.directive';

@Component({
  selector: 'app-timezone-search',
  standalone: true,
  imports: [CommonModule, FormsModule, ClickOutsideDirective],
  templateUrl: './timezone-search.component.html',
  styleUrls: ['./timezone-search.component.scss']
})
export class TimezoneSearchComponent implements OnInit, OnDestroy {
  private timezoneService = inject(TimezoneService);
  private geocodingService = inject(GeocodingService);

  protected searchQuery = signal('');
  protected isDropdownOpen = signal(false);
  protected isLoading = signal(false);
  protected activeIndex = signal(-1);
  protected suggestions = signal<TimezoneEntry[]>([]);

  private searchSubject = new Subject<string>();
  private searchSub: Subscription | null = null;

  ngOnInit(): void {
    this.searchSub = this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      tap(() => this.isLoading.set(true)),
      switchMap(query => this.geocodingService.search(query)),
    ).subscribe(results => {
      this.suggestions.set(results);
      this.isLoading.set(false);
    });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  protected onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.isDropdownOpen.set(value.length >= 2);
    this.activeIndex.set(-1);

    if (value.length >= 2) {
      this.searchSubject.next(value);
    } else {
      this.suggestions.set([]);
      this.isLoading.set(false);
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    const items = this.suggestions();

    if (event.key === 'Escape') {
      this.closeDropdown();
      this.searchQuery.set('');
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const activeIdx = this.activeIndex();
      const selectedEntry = activeIdx >= 0 ? items[activeIdx] : items[0];
      if (selectedEntry) {
        this.selectTimezone(selectedEntry);
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const newIndex = Math.min(this.activeIndex() + 1, items.length - 1);
      this.activeIndex.set(newIndex);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const newIndex = Math.max(this.activeIndex() - 1, -1);
      this.activeIndex.set(newIndex);
      return;
    }
  }

  protected isAlreadySelected(entry: TimezoneEntry): boolean {
    return this.timezoneService.selectedTimezoneIds().includes(entry.id);
  }

  protected selectTimezone(entry: TimezoneEntry): void {
    if (this.isAlreadySelected(entry)) return;
    this.timezoneService.addTimezone(entry.id, entry);
    this.searchQuery.set('');
    this.suggestions.set([]);
    this.closeDropdown();
    this.timezoneService.syncState();
  }

  protected closeDropdown(): void {
    this.isDropdownOpen.set(false);
    this.activeIndex.set(-1);
  }

  protected getDropdownId(): string {
    return 'timezone-suggestions';
  }

  protected getOptionId(index: number): string {
    return `timezone-option-${index}`;
  }
}
