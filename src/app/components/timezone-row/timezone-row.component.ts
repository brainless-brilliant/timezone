import { Component, Input, Output, EventEmitter, inject, signal, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { RowStatus, TimezoneRow } from '../../core/models/timezone.model';
import { TimeCalculationService } from '../../core/services/time-calculation.service';
import { TimezoneService, ZoneExplanation } from '../../core/services/timezone.service';

@Component({
  selector: 'app-timezone-row',
  standalone: true,
  imports: [CommonModule, CdkDragHandle],
  templateUrl: './timezone-row.component.html',
  styleUrls: ['./timezone-row.component.scss'],
})
export class TimezoneRowComponent {
  private timeCalc = inject(TimeCalculationService);
  private timezoneService = inject(TimezoneService);

  @Input({ required: true }) row!: TimezoneRow;
  @Input() isFirstRow = false;
  @Input() isLocal = false;
  /** Moment being inspected (hovered or pinned); null shows the live time. */
  @Input() inspectInstant: number | null = null;
  @Input() activeColumn: number | null = null;
  @Input() explanation: ZoneExplanation | undefined;
  @Output() remove = new EventEmitter<string>();
  @Output() makeReference = new EventEmitter<string>();
  @Output() rename = new EventEmitter<{ key: string; label: string }>();

  @ViewChild('nameInput') private nameInput?: ElementRef<HTMLInputElement>;
  protected editing = signal(false);
  protected renameError = signal('');

  private get moment(): number {
    return this.inspectInstant ?? this.timezoneService.currentTime().getTime();
  }

  get displayedTime(): string {
    return this.inspectInstant === null
      ? this.row.currentTime
      : this.timeCalc.formatTime(new Date(this.inspectInstant), this.row.entry.id, this.timezoneService.hour12());
  }

  get displayedDate(): string {
    return this.inspectInstant === null
      ? this.row.currentDate
      : this.timeCalc.formatDate(new Date(this.inspectInstant), this.row.entry.id);
  }

  /** "Tomorrow" / "Yesterday" compared with the visitor's own date at the same moment. */
  get dayRelation(): string {
    return this.isLocal ? '' : this.timezoneService.dayRelationToLocal(this.row.entry.id, this.moment);
  }

  get status(): RowStatus {
    return this.timezoneService.statusAt(this.row.entry.id, this.moment);
  }

  protected startRename(): void {
    this.renameError.set('');
    this.editing.set(true);
    setTimeout(() => this.nameInput?.nativeElement.select());
  }

  protected commitRename(value: string): void {
    if (!this.editing()) return;
    this.editing.set(false);
    const label = value.trim();
    if (label === this.row.entry.name) return;
    const ok = this.timezoneService.renameRow(this.row.key, label);
    if (!ok) {
      this.renameError.set(`"${label}" is already on the list.`);
      setTimeout(() => this.renameError.set(''), 2500);
    }
  }

  protected onRemove(): void {
    this.remove.emit(this.row.key);
  }

  protected onMakeReference(): void {
    this.makeReference.emit(this.row.key);
  }
}
