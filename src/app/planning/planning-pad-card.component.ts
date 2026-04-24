import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';

import type { PlanningPad } from './planning.models';

@Component({
  selector: 'vpg-planning-pad-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './planning-pad-card.component.html',
  styleUrl: './planning-pad-card.component.css',
})
export class PlanningPadCardComponent {
  public readonly pad = input.required<PlanningPad>();
  public readonly padIndex = input.required<number>();
  public readonly hasConflict = input(false);
  public readonly endTime = input('--:--');
  public readonly durationLabel = input('');

  public readonly medewerkerChanged = output<{
    medewerkerIndex: number
    padIndex: number
    value: string
  }>();

  public readonly medewerkerRemoved = output<{
    medewerkerIndex: number
    padIndex: number
  }>();

  public readonly medewerkerAdded = output<number>();

  public readonly startTimeChanged = output<{
    padIndex: number
    value: string
  }>();

  public readonly startTimeBlurred = output<number>();

  protected onMedewerkerInput(medewerkerIndex: number, event: Event): void {
    const targetInput = event.target;

    if (!(targetInput instanceof HTMLInputElement)) {
      return;
    }

    this.medewerkerChanged.emit({
      medewerkerIndex,
      padIndex: this.padIndex(),
      value: targetInput.value,
    });
  }

  protected onRemoveMedewerker(medewerkerIndex: number): void {
    this.medewerkerRemoved.emit({
      medewerkerIndex,
      padIndex: this.padIndex(),
    });
  }

  protected onAddMedewerker(): void {
    this.medewerkerAdded.emit(this.padIndex());
  }

  protected onStartTimeInput(event: Event): void {
    const targetInput = event.target;

    if (!(targetInput instanceof HTMLInputElement)) {
      return;
    }

    this.startTimeChanged.emit({
      padIndex: this.padIndex(),
      value: targetInput.value,
    });
  }

  protected onStartTimeBlur(): void {
    this.startTimeBlurred.emit(this.padIndex());
  }
}
