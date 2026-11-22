import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, CdkDropList, CdkDrag, CdkDragPlaceholder } from '@angular/cdk/drag-drop';
import { TimezoneService } from '../../core/services/timezone.service';
import { TimeCalculationService } from '../../core/services/time-calculation.service';
import { TimezoneRowComponent } from '../timezone-row/timezone-row.component';

@Component({
  selector: 'app-timezone-grid',
  standalone: true,
  imports: [CommonModule, CdkDropList, CdkDrag, CdkDragPlaceholder, TimezoneRowComponent],
  templateUrl: './timezone-grid.component.html',
  styleUrls: ['./timezone-grid.component.scss']
})
export class TimezoneGridComponent {
  protected timezoneService = inject(TimezoneService);
  private timeCalc = inject(TimeCalculationService);
  protected copied = signal(false);

  /** Column whose times are shown in the rows: hovered, else pinned, else none (live time). */
  protected inspectColumn = computed(() => this.timezoneService.hoveredColumn() ?? this.timezoneService.pinnedColumn());

  /** Column under the lens: hovered, else pinned, else the current hour. */
  protected activeColumn = computed(() => {
    const inspected = this.inspectColumn();
    if (inspected !== null) return inspected;
    const ids = this.timezoneService.selectedTimezoneIds();
    if (ids.length === 0) return 0;
    return this.timeCalc.getCurrentHour(this.timezoneService.currentTime(), ids[0]) % 24;
  });

  protected pinnedSummary = computed(() => {
    const col = this.timezoneService.pinnedColumn();
    const ref = this.timezoneService.timezoneRows()[0];
    if (col === null || !ref) return null;
    const at = new Date(ref.hourBlocks[col].instant);
    return {
      time: `${this.timeCalc.formatTime(at, ref.entry.id, this.timezoneService.hour12())}, ${this.timeCalc.formatDate(at, ref.entry.id)}`,
      city: ref.entry.name,
    };
  });

  protected onDrop(event: CdkDragDrop<unknown>): void {
    this.timezoneService.reorderTimezones(event.previousIndex, event.currentIndex);
    this.timezoneService.syncState();
  }

  protected onRemove(id: string): void {
    this.timezoneService.removeTimezone(id);
    this.timezoneService.syncState();
  }

  protected onMakeReference(id: string): void {
    this.timezoneService.setReference(id);
    this.timezoneService.syncState();
  }

  private columnAt(event: MouseEvent): number {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const col = Math.floor((event.clientX - rect.left) / (rect.width / 24));
    return Math.max(0, Math.min(23, col));
  }

  protected onGridMouseMove(event: MouseEvent): void {
    // Touch devices fire synthetic mousemove on tap; only track real hover.
    if (!window.matchMedia('(hover: hover)').matches) return;
    this.timezoneService.hoveredColumn.set(this.columnAt(event));
  }

  protected onGridMouseLeave(): void {
    this.timezoneService.hoveredColumn.set(null);
  }

  protected onGridClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('button')) return;
    // Only clicks on the hour strip pin a column, not clicks on the row header.
    if (!target.closest('.hour-blocks')) return;
    this.timezoneService.togglePinnedColumn(this.columnAt(event));
    this.copied.set(false);
  }

  protected clearPin(): void {
    this.timezoneService.pinnedColumn.set(null);
  }

  protected async copyPinned(): Promise<void> {
    const col = this.timezoneService.pinnedColumn();
    if (col === null) return;
    try {
      await navigator.clipboard.writeText(this.timezoneService.summarizeColumn(col));
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    } catch (err) {
      console.error('Failed to copy times:', err);
    }
  }
}
