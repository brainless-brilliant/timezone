import { Component, inject, computed } from '@angular/core';
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

  activeColumn = computed(() => {
    const hovered = this.timezoneService.hoveredColumn();
    if (hovered !== null) return hovered;
    const ids = this.timezoneService.selectedTimezoneIds();
    if (ids.length === 0) return 0;
    const refTz = ids[0];
    const now = this.timezoneService.currentTime();
    return this.timeCalc.getCurrentHour(now, refTz) % 24;
  });

  protected onDrop(event: CdkDragDrop<any>): void {
    this.timezoneService.reorderTimezones(event.previousIndex, event.currentIndex);
    this.timezoneService.syncState();
  }

  protected onRemove(id: string): void {
    this.timezoneService.removeTimezone(id);
    this.timezoneService.syncState();
  }

  protected onGridMouseMove(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const cellWidth = rect.width / 24;
    const col = Math.floor(mouseX / cellWidth);
    this.timezoneService.hoveredColumn.set(Math.max(0, Math.min(23, col)));
  }

  protected onGridMouseLeave(): void {
    this.timezoneService.hoveredColumn.set(null);
  }
}
