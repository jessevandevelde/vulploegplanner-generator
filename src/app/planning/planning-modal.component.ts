import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';

import type { PlanningDraft } from './planning.models';
import { PlanningPadCardComponent } from './planning-pad-card.component';

@Component({
  selector: 'vpg-planning-modal',
  standalone: true,
  imports: [CommonModule, PlanningPadCardComponent],
  templateUrl: './planning-modal.component.html',
  styleUrl: './planning-modal.component.css',
})
export class PlanningModalComponent {
  public readonly planningDraft = input.required<PlanningDraft>();
  public readonly errorMessage = input('');
  public readonly isPrintingPlanning = input(false);
  public readonly conflictSummary = input<string[]>([]);
  public readonly padConflictStates = input<boolean[]>([]);
  public readonly personeelOpties = input<string[]>([]);
  public readonly endTimes = input<string[]>([]);
  public readonly durationLabels = input<string[]>([]);

  public readonly closed = output();
  public readonly printRequested = output();
  public readonly medewerkerAdded = output<number>();
  public readonly medewerkerRemoved = output<{
    medewerkerIndex: number
    padIndex: number
  }>();

  public readonly medewerkerChanged = output<{
    medewerkerIndex: number
    padIndex: number
    value: string
  }>();

  public readonly startTimeChanged = output<{
    padIndex: number
    value: string
  }>();

  public readonly startTimeBlurred = output<number>();

  protected close(): void {
    this.closed.emit();
  }

  protected print(): void {
    this.printRequested.emit();
  }
}
