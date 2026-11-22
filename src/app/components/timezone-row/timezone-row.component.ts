import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { TimezoneRow } from '../../core/models/timezone.model';
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
  /** Column being inspected (hovered or pinned); null shows the live time. */
  @Input() inspectColumn: number | null = null;
  @Input() activeColumn = 0;
  @Input() explanation: ZoneExplanation | undefined;
  @Output() remove = new EventEmitter<string>();
  @Output() makeReference = new EventEmitter<string>();

  private inspectedInstant(): Date | null {
    if (this.inspectColumn === null) return null;
    const block = this.row.hourBlocks[this.inspectColumn];
    return block ? new Date(block.instant) : null;
  }

  get displayedTime(): string {
    const at = this.inspectedInstant();
    return at ? this.timeCalc.formatTime(at, this.row.entry.id, this.timezoneService.hour12()) : this.row.currentTime;
  }

  get displayedDate(): string {
    const at = this.inspectedInstant();
    return at ? this.timeCalc.formatDate(at, this.row.entry.id) : this.row.currentDate;
  }

  protected onRemove(): void {
    this.remove.emit(this.row.entry.id);
  }

  protected onMakeReference(): void {
    this.makeReference.emit(this.row.entry.id);
  }
}
