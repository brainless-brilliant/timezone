import { Component, ElementRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, CdkDrag, CdkDragHandle, CdkDragPlaceholder, CdkDropList } from '@angular/cdk/drag-drop';
import { TimezoneService } from '../../core/services/timezone.service';
import { TimeCalculationService } from '../../core/services/time-calculation.service';

/**
 * Phone layout: one hour scrubber shared by everyone, and a card per row whose
 * headline is the time at the chosen moment. Replaces the 24-column grid, which
 * needs sideways scrolling and tiny cells on a narrow screen.
 */
@Component({
  selector: 'app-timezone-mobile',
  standalone: true,
  imports: [CommonModule, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder],
  templateUrl: './timezone-mobile.component.html',
  styleUrls: ['./timezone-mobile.component.scss'],
})
export class TimezoneMobileComponent {
  protected svc = inject(TimezoneService);
  private timeCalc = inject(TimeCalculationService);

  @ViewChild('scrubber') private scrubber?: ElementRef<HTMLElement>;

  protected editingKey = signal<string | null>(null);
  protected renameError = signal<{ key: string; message: string } | null>(null);

  /** Column highlighted in the scrubber: pinned, else the current hour when viewing today. */
  protected activeColumn = computed<number | null>(() =>
    this.svc.pinnedColumn() ?? (this.svc.isToday() ? this.svc.currentColumn() : null));

  /** Moment shown on the cards: pinned, else now. */
  protected moment = computed(() => this.svc.pinnedInstant() ?? this.svc.currentTime().getTime());

  protected chips = computed(() => {
    const ref = this.svc.timezoneRows()[0];
    const avail = this.svc.availability();
    if (!ref) return [];
    return ref.hourBlocks.map((b, i) => ({
      index: i,
      hour: b.hourLabel,
      period: b.periodLabel,
      level: avail[i]?.level ?? 'none',
      now: b.isCurrentHour,
      title: avail[i] ? `${avail[i].workCount} of ${avail[i].total} in working hours` : '',
    }));
  });

  protected cards = computed(() => {
    const at = new Date(this.moment());
    const hour12 = this.svc.hour12();
    const explanations = this.svc.explanations();
    const localKey = this.svc.localRowKey();
    return this.svc.timezoneRows().map((row, i) => ({
      row,
      isReference: i === 0,
      isLocal: row.key === localKey,
      time: this.timeCalc.formatTime(at, row.entry.id, hour12),
      date: this.timeCalc.formatDate(at, row.entry.id),
      dayRelation: row.key === localKey ? '' : this.svc.dayRelationToLocal(row.entry.id, at.getTime()),
      status: this.svc.statusAt(row.entry.id, at.getTime()),
      explanation: explanations[row.key],
    }));
  });

  protected referenceName = computed(() => this.svc.timezoneRows()[0]?.entry.name ?? '');

  protected pinnedLabel = computed(() => {
    const pinned = this.svc.pinnedInstant();
    const ref = this.svc.timezoneRows()[0];
    if (pinned === null || !ref) return null;
    return `${this.timeCalc.formatTime(new Date(pinned), ref.entry.id, this.svc.hour12())} ${ref.entry.name}`;
  });

  constructor() {
    // Keep the active hour centred in the scrubber as it changes.
    effect(() => {
      const col = this.activeColumn();
      if (col === null) return;
      queueMicrotask(() => {
        const el = this.scrubber?.nativeElement.querySelector<HTMLElement>(`[data-col="${col}"]`);
        el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
      });
    });
  }

  protected pick(col: number): void {
    this.svc.togglePinnedColumn(col);
  }

  protected onDrop(event: CdkDragDrop<unknown>): void {
    this.svc.reorderTimezones(event.previousIndex, event.currentIndex);
    this.svc.syncState();
  }

  protected remove(key: string): void {
    this.svc.removeTimezone(key);
    this.svc.syncState();
  }

  protected makeReference(key: string): void {
    this.svc.setReference(key);
    this.svc.syncState();
  }

  protected startRename(key: string): void {
    this.renameError.set(null);
    this.editingKey.set(key);
    setTimeout(() => document.querySelector<HTMLInputElement>('.m-name-input')?.select());
  }

  protected commitRename(key: string, current: string, value: string): void {
    if (this.editingKey() !== key) return;
    this.editingKey.set(null);
    const label = value.trim();
    if (label === current) return;
    if (!this.svc.renameRow(key, label)) {
      this.renameError.set({ key, message: `"${label}" is already on the list.` });
      setTimeout(() => this.renameError.set(null), 2500);
    }
  }
}
