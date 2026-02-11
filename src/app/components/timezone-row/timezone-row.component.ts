import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimezoneRow } from '../../core/models/timezone.model';

@Component({
  selector: 'app-timezone-row',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './timezone-row.component.html',
  styleUrls: ['./timezone-row.component.scss'],
})
export class TimezoneRowComponent {
  @Input({ required: true }) row!: TimezoneRow;
  @Input() isFirstRow = false;
  @Input() isLastRow = false;
  @Input() hoveredColumn: number | null = null;
  @Input() activeColumn: number = 0;
  @Output() remove = new EventEmitter<string>();

  get displayedTime(): string {
    if (this.hoveredColumn !== null && this.row.hourBlocks[this.hoveredColumn]) {
      return this.row.hourBlocks[this.hoveredColumn].displayHour;
    }
    return this.row.currentTime;
  }

  protected onRemove(): void {
    this.remove.emit(this.row.entry.id);
  }
}
