import { Directive, ElementRef, EventEmitter, HostListener, Output, inject } from '@angular/core';

@Directive({
  selector: '[appClickOutside]',
  standalone: true
})
export class ClickOutsideDirective {
  @Output() appClickOutside = new EventEmitter<void>();
  private elementRef = inject(ElementRef);

  @HostListener('document:click', ['$event.target'])
  onClick(target: HTMLElement): void {
    if (!this.elementRef.nativeElement.contains(target)) {
      this.appClickOutside.emit();
    }
  }
}
