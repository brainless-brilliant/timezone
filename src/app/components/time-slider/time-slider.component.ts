import { Component, Input, OnInit, OnDestroy, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TimezoneService } from '../../core/services/timezone.service';
import { TimeCalculationService } from '../../core/services/time-calculation.service';

@Component({
  selector: 'app-time-slider',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './time-slider.component.html',
  styleUrls: ['./time-slider.component.scss']
})
export class TimeSliderComponent implements OnInit, OnDestroy {
  @Input({ required: true }) gridElement!: HTMLElement;

  private timezoneService = inject(TimezoneService);
  private timeCalculationService = inject(TimeCalculationService);

  protected sliderPosition = signal(0);
  private isDragging = false;

  private onMouseMove = (event: MouseEvent) => this.handleMove(event.clientX);
  private onTouchMove = (event: TouchEvent) => this.handleMove(event.touches[0].clientX);
  private onMouseUp = () => this.stopDrag();
  private onTouchEnd = () => this.stopDrag();

  constructor() {
    effect(() => {
      const offset = this.timezoneService.sliderOffset();
      this.updateSliderPosition(offset);
    });
  }

  ngOnInit(): void {
    this.updateSliderPosition(0);
  }

  ngOnDestroy(): void {
    this.stopDrag();
  }

  protected startDrag(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    this.isDragging = true;

    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('touchmove', this.onTouchMove);
    document.addEventListener('touchend', this.onTouchEnd);
  }

  private stopDrag(): void {
    this.isDragging = false;

    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
    document.removeEventListener('touchmove', this.onTouchMove);
    document.removeEventListener('touchend', this.onTouchEnd);
  }

  private getReferenceTimezoneId(): string {
    const ids = this.timezoneService.selectedTimezoneIds();
    return ids.length > 0 ? ids[0] : Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  private handleMove(clientX: number): void {
    if (!this.isDragging || !this.gridElement) return;

    const hourBlocksEl = this.gridElement.querySelector('.hour-blocks');
    if (!hourBlocksEl) return;

    const blocksRect = hourBlocksEl.getBoundingClientRect();
    const cellWidth = blocksRect.width / 24;

    const mouseX = clientX - blocksRect.left;
    const refTz = this.getReferenceTimezoneId();
    const currentHour = this.timeCalculationService.getCurrentHour(this.timezoneService.currentTime(), refTz);

    const clickedHour = Math.round(mouseX / cellWidth);
    const newOffset = clickedHour - currentHour;
    const clampedOffset = Math.max(-currentHour, Math.min(newOffset, 23 - currentHour));

    this.timezoneService.setSliderOffset(clampedOffset);
  }

  private updateSliderPosition(offset: number): void {
    if (!this.gridElement) return;

    const hourBlocksEl = this.gridElement.querySelector('.hour-blocks');
    if (!hourBlocksEl) return;

    const blocksRect = hourBlocksEl.getBoundingClientRect();
    const gridRect = this.gridElement.getBoundingClientRect();
    const cellWidth = blocksRect.width / 24;

    const refTz = this.getReferenceTimezoneId();
    const currentHour = this.timeCalculationService.getCurrentHour(this.timezoneService.currentTime(), refTz);
    const sliderLeft = (blocksRect.left - gridRect.left) + (currentHour + offset + 0.5) * cellWidth;

    this.sliderPosition.set(sliderLeft);
  }
}
