import { Component, inject, computed, signal, HostListener, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, CdkDropList, CdkDrag, CdkDragPlaceholder } from '@angular/cdk/drag-drop';
import { TimezoneService } from '../../core/services/timezone.service';
import { TimeCalculationService } from '../../core/services/time-calculation.service';
import { CalendarService, CalendarEvent } from '../../core/services/calendar.service';
import { TimezoneRowComponent } from '../timezone-row/timezone-row.component';
import { ClickOutsideDirective } from '../../shared/directives/click-outside.directive';

@Component({
  selector: 'app-timezone-grid',
  standalone: true,
  imports: [CommonModule, CdkDropList, CdkDrag, CdkDragPlaceholder, TimezoneRowComponent, ClickOutsideDirective],
  templateUrl: './timezone-grid.component.html',
  styleUrls: ['./timezone-grid.component.scss']
})
export class TimezoneGridComponent {
  protected timezoneService = inject(TimezoneService);
  private timeCalc = inject(TimeCalculationService);
  private calendar = inject(CalendarService);

  @ViewChild('dateInput') private dateInput?: ElementRef<HTMLInputElement>;

  protected copied = signal(false);
  protected calendarOpen = signal(false);
  protected workOpen = signal(false);
  protected duration = signal(60);
  protected readonly durations = [30, 45, 60, 90];
  protected readonly hours = Array.from({ length: 25 }, (_, h) => h);

  /** Column whose times are shown in the rows: hovered, else pinned, else none (live time). */
  protected inspectColumn = computed(() => this.timezoneService.hoveredColumn() ?? this.timezoneService.pinnedColumn());

  /** Exact moment the rows display: hovered column, else the pinned instant, else null (live). */
  protected inspectInstant = computed<number | null>(() => {
    const hovered = this.timezoneService.hoveredColumn();
    const ref = this.timezoneService.timezoneRows()[0];
    if (hovered !== null && ref) return ref.hourBlocks[hovered].instant;
    const pinned = this.timezoneService.pinnedInstant();
    return pinned !== null && this.timezoneService.pinnedColumn() !== null ? pinned : null;
  });

  /** Column under the lens: inspected, else the current hour when viewing today, else none. */
  protected activeColumn = computed<number | null>(() => {
    const inspected = this.inspectColumn();
    if (inspected !== null) return inspected;
    return this.timezoneService.isToday() ? this.timezoneService.currentColumn() : null;
  });

  protected pinnedSummary = computed(() => {
    const pinned = this.timezoneService.pinnedInstant();
    const ref = this.timezoneService.timezoneRows()[0];
    if (pinned === null || !ref) return null;
    const at = new Date(pinned);
    return {
      time: this.timeCalc.formatTime(at, ref.entry.id, this.timezoneService.hour12()),
      date: this.timeCalc.formatDate(at, ref.entry.id),
      city: ref.entry.name,
    };
  });

  protected suggestionText = computed(() => {
    const s = this.timezoneService.meetingSuggestion();
    const ref = this.timezoneService.timezoneRows()[0];
    if (!s || !ref) return null;
    const hour12 = this.timezoneService.hour12();
    const start = this.timeCalc.formatTime(new Date(ref.hourBlocks[s.startCol].instant), ref.entry.id, hour12);
    const endInstant = ref.hourBlocks[s.endCol - 1].instant + 3_600_000;
    const end = this.timeCalc.formatTime(new Date(endInstant), ref.entry.id, hour12);
    const range = s.endCol - s.startCol > 1 ? `${start} - ${end}` : start;
    return { range, city: ref.entry.name, ...s };
  });

  /** First upcoming hour when everyone is in working hours, phrased for the finder. */
  protected nextGood = computed(() => {
    const n = this.timezoneService.nextEveryoneWorking();
    const ref = this.timezoneService.timezoneRows()[0];
    if (!n || !ref) return null;
    if (n.never) return { never: true, instant: 0, label: '' };
    const at = new Date(n.instant);
    const day = this.timeCalc.formatDate(at, ref.entry.id);
    const time = this.timeCalc.formatTime(at, ref.entry.id, this.timezoneService.hour12());
    return { never: false, instant: n.instant, label: `${day}, ${time} ${ref.entry.name}` };
  });

  protected workLabel = computed(() => {
    const w = this.timezoneService.workHours();
    const f = (h: number) => this.timezoneService.hour12()
      ? `${h % 12 === 0 ? 12 : h % 12}${h < 12 || h === 24 ? 'am' : 'pm'}`
      : `${String(h).padStart(2, '0')}:00`;
    return `${f(w.start)} - ${f(w.end)}`;
  });

  // ---- Rows ----

  protected onDrop(event: CdkDragDrop<unknown>): void {
    this.timezoneService.reorderTimezones(event.previousIndex, event.currentIndex);
    this.timezoneService.syncState();
  }

  protected onRemove(key: string): void {
    this.timezoneService.removeTimezone(key);
    this.timezoneService.syncState();
  }

  protected onMakeReference(key: string): void {
    this.timezoneService.setReference(key);
    this.timezoneService.syncState();
  }

  protected onRename(event: { key: string; label: string }): void {
    this.timezoneService.renameRow(event.key, event.label);
  }

  // ---- Pointer ----

  private columnAt(event: MouseEvent): number {
    const strip = (event.currentTarget as HTMLElement).querySelector('.availability-strip') as HTMLElement | null;
    const rect = (strip ?? (event.currentTarget as HTMLElement)).getBoundingClientRect();
    const col = Math.floor((event.clientX - rect.left) / (rect.width / 24));
    return Math.max(0, Math.min(23, col));
  }

  protected onGridMouseMove(event: MouseEvent): void {
    if (!window.matchMedia('(hover: hover)').matches) return;
    this.timezoneService.hoveredColumn.set(this.columnAt(event));
  }

  protected onGridMouseLeave(): void {
    this.timezoneService.hoveredColumn.set(null);
  }

  protected onGridClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('button, input')) return;
    if (!target.closest('.hour-blocks, .availability-strip')) return;
    this.timezoneService.togglePinnedColumn(this.columnAt(event));
    this.copied.set(false);
  }

  // ---- Day navigation ----

  protected shiftDay(delta: number): void {
    this.timezoneService.setDayOffset(this.timezoneService.dayOffset() + delta);
  }

  protected openDatePicker(): void {
    const input = this.dateInput?.nativeElement;
    if (!input) return;
    try {
      input.showPicker();
    } catch {
      input.focus();
      input.click();
    }
  }

  protected onDatePicked(value: string): void {
    if (value) this.timezoneService.goToDate(value);
  }

  // ---- Meeting finder ----

  protected pinSuggestion(): void {
    const s = this.timezoneService.meetingSuggestion();
    const ref = this.timezoneService.timezoneRows()[0];
    if (s && ref) this.timezoneService.pinInstant(ref.hourBlocks[s.startCol].instant);
  }

  protected setWork(which: 'start' | 'end', value: string): void {
    const w = this.timezoneService.workHours();
    const h = Number(value);
    if (which === 'start') this.timezoneService.setWorkHours(h, Math.max(w.end, h + 1));
    else this.timezoneService.setWorkHours(Math.min(w.start, h - 1), h);
  }

  protected formatHourOption(h: number): string {
    if (!this.timezoneService.hour12()) return `${String(h).padStart(2, '0')}:00`;
    if (h === 0 || h === 24) return '12 am';
    if (h === 12) return '12 pm';
    return h < 12 ? `${h} am` : `${h - 12} pm`;
  }

  // ---- Pin actions ----

  protected clearPin(): void {
    this.timezoneService.backToNow();
    this.calendarOpen.set(false);
  }

  protected async copyPinned(): Promise<void> {
    const pinned = this.timezoneService.pinnedInstant();
    if (pinned === null) return;
    try {
      await navigator.clipboard.writeText(this.timezoneService.summarizeInstant(pinned));
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    } catch (err) {
      console.error('Failed to copy times:', err);
    }
  }

  private event(): CalendarEvent | null {
    const pinned = this.timezoneService.pinnedInstant();
    if (pinned === null) return null;
    const link = window.location.href;
    return {
      title: this.timezoneService.meetingTitle(),
      start: pinned,
      durationMinutes: this.duration(),
      description: `${this.timezoneService.summarizeInstant(pinned)}\n\nCompare: ${link}`,
    };
  }

  protected downloadIcs(): void {
    const e = this.event();
    if (e) this.calendar.downloadIcs(e);
    this.calendarOpen.set(false);
  }

  protected calendarUrl(kind: 'google' | 'outlook'): string {
    const e = this.event();
    if (!e) return '#';
    return kind === 'google' ? this.calendar.googleUrl(e) : this.calendar.outlookUrl(e);
  }

  // ---- Keyboard: arrows move the pinned hour, Shift+arrows change day, Esc / T go back to now ----

  @HostListener('document:keydown', ['$event'])
  protected onKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const dir = event.key === 'ArrowLeft' ? -1 : 1;
      if (event.shiftKey) this.shiftDay(dir);
      else this.timezoneService.nudgePin(dir);
    } else if (event.key === 'Escape' && (this.calendarOpen() || this.workOpen())) {
      this.calendarOpen.set(false);
      this.workOpen.set(false);
    } else if (event.key === 'Escape' || event.key.toLowerCase() === 't') {
      if (this.timezoneService.pinnedInstant() !== null || !this.timezoneService.isToday()) this.clearPin();
    }
  }
}
