import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import type { OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PlanningModalComponent } from '../planning/planning-modal.component';
import type { DayKey, PlanningDraft, PlanningPad } from '../planning/planning.models';

interface PlanningConflictAssignment {
  endMinutes: number
  medewerker: string
  medewerkerKey: string
  padIndex: number
  padName: string
  startMinutes: number
}

const API_BASE_URL = '/api';
const HOURS_PER_DAY = 24;
const COLON_CHARACTER = ':';
const DOT_CHARACTER = '.';
const INVALID_NEGATIVE_OFFSET = -2;
const MAX_HOUR = 23;
const MAX_MINUTE = 59;
const MINUTES_PER_HOUR = 60;
const PAD_START_LENGTH = 2;
const RAW_TIME_INPUT_MAX_LENGTH = 5;
const THREE_DIGIT_TIME_LENGTH = 3;
const EMPTY_FILE_LABEL = 'Nog geen PDF geselecteerd.';
const DEFAULT_EMPLOYEE_ENTRY = '';

@Component({
  selector: 'vpg-home-page',
  standalone: true,
  imports: [CommonModule, FormsModule, PlanningModalComponent],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.css',
})
export class HomePageComponent implements OnInit {
  protected readonly days: DayKey[] = [
    'maandag',
    'dinsdag',
    'woensdag',
    'donderdag',
    'vrijdag',
    'zaterdag',
    'zondag',
  ];

  protected readonly dayLabels: Record<DayKey, string> = {
    maandag: 'Maandag',
    dinsdag: 'Dinsdag',
    woensdag: 'Woensdag',
    donderdag: 'Donderdag',
    vrijdag: 'Vrijdag',
    zaterdag: 'Zaterdag',
    zondag: 'Zondag',
  };

  protected activeDay: DayKey = 'maandag';
  protected isPersoneelBeheerOpen = false;
  protected isAddingPerson = false;
  protected editingIndex: number | null = null;
  protected editingPersonName = '';
  protected newPersonName = '';
  protected selectedFileName = EMPTY_FILE_LABEL;
  protected loadingPersonnel = true;
  protected errorMessage = '';
  protected isPlanningModalOpen = false;
  protected isPlanningLoading = false;
  protected isPrintingPlanning = false;
  protected planningDraft: PlanningDraft | null = null;
  protected personeelPerDag: Record<DayKey, string[]> = {
    maandag: [],
    dinsdag: [],
    woensdag: [],
    donderdag: [],
    vrijdag: [],
    zaterdag: [],
    zondag: [],
  };

  public ngOnInit(): void {
    void this.loadPersonnel();
  }

  protected togglePersoneelBeheer(): void {
    this.isPersoneelBeheerOpen = !this.isPersoneelBeheerOpen;
  }

  protected selectDay(day: DayKey): void {
    this.activeDay = day;
    this.cancelNewPerson();
    this.cancelEdit();
  }

  protected startEdit(index: number): void {
    this.isAddingPerson = false;
    this.editingIndex = index;
    this.editingPersonName = this.personeelPerDag[this.activeDay][index] ?? '';
  }

  protected async saveEdit(): Promise<void> {
    if (this.editingIndex === null) {
      return;
    }

    const trimmedName = this.editingPersonName.trim();

    if (!trimmedName) {
      this.cancelEdit();

      return;
    }

    this.personeelPerDag[this.activeDay][this.editingIndex] = trimmedName;
    this.cancelEdit();
    await this.savePersoneelForDay(this.activeDay);
  }

  protected updateEditName(index: number, event: Event): void {
    if (this.editingIndex !== index) {
      return;
    }

    const input = event.target;

    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    this.editingPersonName = input.value;
  }

  protected cancelEdit(): void {
    this.editingIndex = null;
    this.editingPersonName = '';
  }

  protected openNewPersonForm(): void {
    this.isAddingPerson = true;
    this.cancelEdit();
    this.newPersonName = '';
  }

  protected cancelNewPerson(): void {
    this.isAddingPerson = false;
    this.newPersonName = '';
  }

  protected async addPersoneel(): Promise<void> {
    const trimmedName = this.newPersonName.trim();

    if (!trimmedName) {
      return;
    }

    this.personeelPerDag[this.activeDay].push(trimmedName);
    this.cancelNewPerson();
    await this.savePersoneelForDay(this.activeDay);
  }

  protected async removePersoneel(index: number): Promise<void> {
    this.personeelPerDag[this.activeDay].splice(index, 1);

    if (this.editingIndex === index) {
      this.cancelEdit();
    }

    await this.savePersoneelForDay(this.activeDay);
  }

  protected async onPdfSelected(event: Event): Promise<void> {
    const input = event.target;

    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const file = input.files?.[0];

    if (!file) {
      this.selectedFileName = EMPTY_FILE_LABEL;

      return;
    }

    this.selectedFileName = file.name;
    await this.parsePlanningPdf(file);
  }

  protected closePlanningModal(): void {
    this.isPlanningModalOpen = false;
  }

  protected addPlanningMedewerker(padIndex: number): void {
    const pad = this.planningDraft?.pads[padIndex];

    if (!pad) {
      return;
    }

    pad.medewerkers.push(DEFAULT_EMPLOYEE_ENTRY);
  }

  protected removePlanningMedewerker(padIndex: number, medewerkerIndex: number): void {
    const pad = this.planningDraft?.pads[padIndex];

    if (!pad) {
      return;
    }

    if (pad.medewerkers.length === 1) {
      pad.medewerkers[0] = DEFAULT_EMPLOYEE_ENTRY;

      return;
    }

    pad.medewerkers.splice(medewerkerIndex, 1);
  }

  protected normalizePlanningStartTime(padIndex: number): void {
    const pad = this.planningDraft?.pads[padIndex];

    if (!pad) {
      return;
    }

    pad.startTime = this.normalizeTimeValue(pad.startTime) ?? pad.startTime;
  }

  protected getPlanningEndTime(pad: PlanningPad): string {
    const startMinutes = this.parseTimeToMinutes(pad.startTime);

    if (startMinutes === null) {
      return '--:--';
    }

    return this.formatMinutesAsTime(startMinutes + this.getPlanningDurationMinutes(pad));
  }

  protected getPlanningDurationLabel(pad: PlanningPad): string {
    const durationMinutes = this.getPlanningDurationMinutes(pad);

    return `${durationMinutes} min`;
  }

  protected getPlanningWarningsForPad(padIndex: number): string[] {
    return this.getPlanningConflictMap().get(padIndex) ?? [];
  }

  protected hasPlanningWarnings(padIndex: number): boolean {
    return this.getPlanningWarningsForPad(padIndex).length > 0;
  }

  protected getPlanningConflictSummary(): string[] {
    const conflictMap = this.getPlanningConflictMap();

    return [...new Set([...conflictMap.values()].flat())];
  }

  protected getPlanningConflictStates(): boolean[] {
    return this.planningDraft?.pads.map((_, padIndex) => this.hasPlanningWarnings(padIndex)) ?? [];
  }

  protected getPlanningEndTimes(): string[] {
    return this.planningDraft?.pads.map(pad => this.getPlanningEndTime(pad)) ?? [];
  }

  protected getPlanningDurationLabels(): string[] {
    return this.planningDraft?.pads.map(pad => this.getPlanningDurationLabel(pad)) ?? [];
  }

  protected updatePlanningMedewerkerValue(padIndex: number, medewerkerIndex: number, value: string): void {
    const pad = this.planningDraft?.pads[padIndex];

    if (!pad) {
      return;
    }

    pad.medewerkers[medewerkerIndex] = value;
    this.applySuggestedStartTimeForMedewerker(padIndex, value);
  }

  protected updatePlanningStartTimeValue(padIndex: number, value: string): void {
    const pad = this.planningDraft?.pads[padIndex];

    if (!pad) {
      return;
    }

    pad.startTime = this.sanitizeTimeInput(value);
  }

  protected printPlanning(): void {
    if (!this.planningDraft) {
      return;
    }

    this.isPrintingPlanning = true;
    this.errorMessage = '';

    try {
      const planning = this.serializePlanningDraft();

      if (planning.pads.some(pad => !pad.startTime)) {
        throw new Error('Vul voor elk pad een begintijd in voordat je print.');
      }

      if (planning.pads.some(pad => pad.medewerkers.length === 0)) {
        throw new Error('Voeg voor elk pad minimaal een medewerker toe voordat je print.');
      }

      if (this.getPlanningConflictSummary().length > 0) {
        throw new Error('Los eerst de overlap in medewerkers op voordat je print.');
      }

      const printWindow = window.open('', '_blank', 'width=1200,height=900');

      if (!printWindow) {
        throw new Error('Kon geen printvenster openen.');
      }

      this.renderPrintablePlanning(printWindow, planning);
      printWindow.focus();
      printWindow.print();
    }
    catch (error: unknown) {
      this.errorMessage = error instanceof Error ? error.message : 'Onbekende fout bij printen van planning.';
    }
    finally {
      this.isPrintingPlanning = false;
    }
  }

  private async parsePlanningPdf(file: File): Promise<void> {
    this.isPlanningLoading = true;
    this.errorMessage = '';

    try {
      const headers = new Headers();

      headers.set('Content-Type', 'application/json');

      const response = await fetch(`${API_BASE_URL}/planning/parse`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fileName: file.name,
          fileContentBase64: await this.readFileAsBase64(file),
        }),
      });

      const data: unknown = await response.json();

      if (!response.ok) {
        throw new Error(this.readApiMessage(data, `Kon planning niet uitlezen (${response.status}).`));
      }

      if (!this.isPlanningDraft(data)) {
        throw new Error('Onverwacht planningformaat ontvangen.');
      }

      this.planningDraft = {
        ...data,
        pads: data.pads.map(pad => ({
          ...pad,
          medewerkers: pad.medewerkers.length > 0 ? pad.medewerkers : [DEFAULT_EMPLOYEE_ENTRY],
          startTime: '',
        })),
      };
      this.activeDay = data.dayKey;
      this.isPlanningModalOpen = true;
    }
    catch (error: unknown) {
      this.errorMessage = error instanceof Error ? error.message : 'Onbekende fout bij verwerken van de PDF.';
    }
    finally {
      this.isPlanningLoading = false;
    }
  }

  private serializePlanningDraft(): PlanningDraft {
    if (!this.planningDraft) {
      throw new Error('Geen planning beschikbaar om te exporteren.');
    }

    return {
      ...this.planningDraft,
      pads: this.planningDraft.pads.map(pad => ({
        ...pad,
        medewerkers: pad.medewerkers
          .map(medewerker => medewerker.trim())
          .filter(Boolean),
        startTime: pad.startTime.trim(),
      })),
    };
  }

  private getPlanningDurationMinutes(pad: PlanningPad): number {
    const medewerkerCount = pad.medewerkers
      .map(medewerker => medewerker.trim())
      .filter(Boolean)
      .length;

    const effectiveMedewerkerCount = Math.max(1, medewerkerCount);

    return Math.ceil(pad.totalColli / effectiveMedewerkerCount);
  }

  private applySuggestedStartTimeForMedewerker(padIndex: number, medewerkerName: string): void {
    const pad = this.planningDraft?.pads[padIndex];
    const suggestedStartMinutes = this.getLatestEndTimeForMedewerker(padIndex, medewerkerName);

    if (!pad || suggestedStartMinutes === null) {
      return;
    }

    const currentStartMinutes = this.parseTimeToMinutes(pad.startTime);

    if (currentStartMinutes !== null && currentStartMinutes >= suggestedStartMinutes) {
      return;
    }

    pad.startTime = this.formatMinutesAsTime(suggestedStartMinutes);
  }

  private getLatestEndTimeForMedewerker(padIndex: number, medewerkerName: string): number | null {
    if (!this.planningDraft) {
      return null;
    }

    const medewerkerKey = medewerkerName.trim().toLocaleLowerCase();

    if (!medewerkerKey) {
      return null;
    }

    let latestEndMinutes: number | null = null;

    for (const [otherPadIndex, otherPad] of this.planningDraft.pads.entries()) {
      if (otherPadIndex === padIndex) {
        continue;
      }

      const hasMatchingMedewerker = otherPad.medewerkers.some(
        medewerker => medewerker.trim().toLocaleLowerCase() === medewerkerKey,
      );

      if (!hasMatchingMedewerker) {
        continue;
      }

      const otherStartMinutes = this.parseTimeToMinutes(otherPad.startTime);

      if (otherStartMinutes === null) {
        continue;
      }

      const otherEndMinutes = otherStartMinutes + this.getPlanningDurationMinutes(otherPad);

      if (latestEndMinutes === null || otherEndMinutes > latestEndMinutes) {
        latestEndMinutes = otherEndMinutes;
      }
    }

    return latestEndMinutes;
  }

  private getPlanningConflictMap(): Map<number, string[]> {
    if (!this.planningDraft) {
      return new Map();
    }

    const assignments = this.planningDraft.pads.flatMap((pad, padIndex) => {
      const startMinutes = this.parseTimeToMinutes(pad.startTime);

      if (startMinutes === null) {
        return [];
      }

      const endMinutes = startMinutes + this.getPlanningDurationMinutes(pad);

      return pad.medewerkers
        .map(medewerker => medewerker.trim())
        .filter(Boolean)
        .map(medewerker => ({
          endMinutes,
          medewerker,
          medewerkerKey: medewerker.toLocaleLowerCase(),
          padIndex,
          padName: pad.padName,
          startMinutes,
        }));
    });

    const conflicts = new Map<number, Set<string>>();

    for (let index = 0; index < assignments.length; index += 1) {
      const currentAssignment = assignments[index];

      for (let otherIndex = index + 1; otherIndex < assignments.length; otherIndex += 1) {
        const otherAssignment = assignments[otherIndex];

        if (currentAssignment.medewerkerKey !== otherAssignment.medewerkerKey) {
          continue;
        }

        if (!this.doPlanningTimesOverlap(currentAssignment, otherAssignment)) {
          continue;
        }

        const currentMessage = this.buildConflictMessage(currentAssignment, otherAssignment);
        const otherMessage = this.buildConflictMessage(otherAssignment, currentAssignment);

        this.addConflictMessage(conflicts, currentAssignment.padIndex, currentMessage);
        this.addConflictMessage(conflicts, otherAssignment.padIndex, otherMessage);
      }
    }

    return new Map(
      [...conflicts.entries()].map(([padIndex, messages]) => [padIndex, [...messages]]),
    );
  }

  private doPlanningTimesOverlap(
    firstAssignment: PlanningConflictAssignment,
    secondAssignment: PlanningConflictAssignment,
  ): boolean {
    return firstAssignment.startMinutes < secondAssignment.endMinutes
      && secondAssignment.startMinutes < firstAssignment.endMinutes;
  }

  private buildConflictMessage(
    currentAssignment: PlanningConflictAssignment,
    otherAssignment: PlanningConflictAssignment,
  ): string {
    const currentRange = `${this.formatMinutesAsTime(currentAssignment.startMinutes)}-${this.formatMinutesAsTime(currentAssignment.endMinutes)}`;
    const otherRange = `${this.formatMinutesAsTime(otherAssignment.startMinutes)}-${this.formatMinutesAsTime(otherAssignment.endMinutes)}`;

    if (currentAssignment.padIndex === otherAssignment.padIndex) {
      return `${currentAssignment.medewerker} staat dubbel op ${currentAssignment.padName} (${currentRange}).`;
    }

    return `${currentAssignment.medewerker} overlap met ${otherAssignment.padName} (${otherRange}).`;
  }

  private addConflictMessage(conflicts: Map<number, Set<string>>, padIndex: number, message: string): void {
    const existingMessages = conflicts.get(padIndex);

    if (existingMessages) {
      existingMessages.add(message);

      return;
    }

    conflicts.set(padIndex, new Set([message]));
  }

  private parseTimeToMinutes(value: string): number | null {
    const normalizedValue = this.normalizeTimeValue(value);

    if (!normalizedValue) {
      return null;
    }

    const timePattern = /^(\d{2}):(\d{2})$/;
    const match = timePattern.exec(normalizedValue);

    if (!match) {
      return null;
    }

    const [, hourString, minuteString] = match;
    const hours = Number(hourString);
    const minutes = Number(minuteString);

    if (hours > MAX_HOUR || minutes > MAX_MINUTE) {
      return null;
    }

    return (hours * MINUTES_PER_HOUR) + minutes;
  }

  private sanitizeTimeInput(value: string): string {
    return value
      .replaceAll(DOT_CHARACTER, COLON_CHARACTER)
      .replaceAll(/[^0-9:]/g, '')
      .slice(0, RAW_TIME_INPUT_MAX_LENGTH);
  }

  private normalizeTimeValue(value: string): string | null {
    const sanitizedValue = this.sanitizeTimeInput(value).trim();

    if (!sanitizedValue) {
      return null;
    }

    const compactDigits = sanitizedValue.replaceAll(COLON_CHARACTER, '');
    let hours: number | null = null;
    let minutes: number | null = null;

    if (/^\d{1,2}:\d{2}$/.test(sanitizedValue)) {
      const [hourString, minuteString] = sanitizedValue.split(COLON_CHARACTER);

      hours = Number(hourString);
      minutes = Number(minuteString);
    }
    else if (/^\d{3,4}$/.test(compactDigits)) {
      const hourDigits = compactDigits.length === THREE_DIGIT_TIME_LENGTH
        ? compactDigits.slice(0, 1)
        : compactDigits.slice(0, PAD_START_LENGTH);

      const minuteDigits = compactDigits.slice(INVALID_NEGATIVE_OFFSET);

      hours = Number(hourDigits);
      minutes = Number(minuteDigits);
    }

    if (hours === null || minutes === null || hours > MAX_HOUR || minutes > MAX_MINUTE) {
      return null;
    }

    return `${String(hours).padStart(PAD_START_LENGTH, '0')}:${String(minutes).padStart(PAD_START_LENGTH, '0')}`;
  }

  private formatMinutesAsTime(totalMinutes: number): string {
    const minutesInDay = HOURS_PER_DAY * MINUTES_PER_HOUR;
    const normalizedMinutes = ((totalMinutes % minutesInDay) + minutesInDay) % minutesInDay;
    const hours = Math.floor(normalizedMinutes / MINUTES_PER_HOUR);
    const minutes = normalizedMinutes % MINUTES_PER_HOUR;

    return `${String(hours).padStart(PAD_START_LENGTH, '0')}:${String(minutes).padStart(PAD_START_LENGTH, '0')}`;
  }

  private renderPrintablePlanning(printWindow: Window, planning: PlanningDraft): void {
    const printDocument = printWindow.document;
    const titleElement = printDocument.createElement('title');
    const styleElement = printDocument.createElement('style');
    const bodyElement = printDocument.body;

    printDocument.head.innerHTML = '';

    titleElement.textContent = `Planning ${planning.dayLabel}`;
    printDocument.head.append(titleElement);
    styleElement.textContent = `
      @page {
        size: A4 landscape;
        margin: 8mm;
      }

      body {
        margin: 0;
        color: #18314f;
        font-family: "Segoe UI", sans-serif;
        font-size: 10px;
      }

      h1 {
        margin: 0;
        font-size: 18px;
        line-height: 1.1;
      }

      .print-header {
        display: grid;
        gap: 4px;
      }

      .print-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 10px;
        color: #5f7188;
        font-size: 9px;
        line-height: 1.25;
      }

      .print-meta span {
        white-space: nowrap;
      }

      table {
        width: 100%;
        margin-top: 8px;
        border-collapse: collapse;
        table-layout: fixed;
      }

      th,
      td {
        padding: 4px 6px;
        border: 1px solid #c9d9ea;
        text-align: left;
        vertical-align: top;
        font-size: 9px;
        line-height: 1.2;
        word-break: break-word;
      }

      th {
        background-color: #14609e;
        color: #fff;
        font-size: 9px;
      }

      th:nth-child(1),
      td:nth-child(1) {
        width: 12%;
      }

      th:nth-child(2),
      td:nth-child(2) {
        width: 6%;
      }

      th:nth-child(3),
      td:nth-child(3),
      th:nth-child(4),
      td:nth-child(4) {
        width: 7%;
      }

      th:nth-child(5),
      td:nth-child(5) {
        width: 6%;
      }

      th:nth-child(6),
      td:nth-child(6) {
        width: 20%;
      }

      th:nth-child(7),
      td:nth-child(7) {
        width: 42%;
      }

      @media print {
        body {
          margin: 0;
        }
      }
    `;
    printDocument.head.append(styleElement);
    bodyElement.innerHTML = this.buildPrintablePlanningMarkup(planning);
  }

  private buildPrintablePlanningMarkup(planning: PlanningDraft): string {
    const rows = planning.pads
      .map((pad) => {
        const medewerkers = pad.medewerkers.join(', ');

        const artikelgroepen = pad.groups
          .map(group => `${group.description} (${group.colli})`)
          .join(', ');

        return `
          <tr>
            <td>${this.escapeHtml(pad.padName)}</td>
            <td>${pad.totalColli}</td>
            <td>${this.escapeHtml(pad.startTime)}</td>
            <td>${this.escapeHtml(this.getPlanningEndTime(pad))}</td>
            <td>${this.escapeHtml(this.getPlanningDurationLabel(pad))}</td>
            <td>${this.escapeHtml(medewerkers)}</td>
            <td>${this.escapeHtml(artikelgroepen)}</td>
          </tr>
        `;
      })
      .join('');

    return `
  <header class="print-header">
    <h1>Vulploegplanning ${this.escapeHtml(planning.dayLabel)}</h1>
    <div class="print-meta">
      <span>Datum: ${this.escapeHtml(planning.documentDateLabel || planning.dayLabel)}</span>
      <span>Bron: ${this.escapeHtml(planning.sourceFileName)}</span>
      <span>Vulsnelheid: 1 colli/min/medewerker</span>
    </div>
  </header>
  <table>
    <thead>
      <tr>
        <th>Pad</th>
        <th>Colli</th>
        <th>Start</th>
        <th>Eind</th>
        <th>Duur</th>
        <th>Medewerkers</th>
        <th>Groepen</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
`;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll('\'', '&#39;');
  }

  private readApiMessage(value: unknown, fallbackMessage: string): string {
    if (!value || typeof value !== 'object' || !('message' in value)) {
      return fallbackMessage;
    }

    const { message } = value;

    return typeof message === 'string' && message.trim() ? message : fallbackMessage;
  }

  private async readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();

      fileReader.onload = (): void => {
        if (typeof fileReader.result !== 'string') {
          reject(new Error('Kon PDF niet lezen.'));

          return;
        }

        const [, encodedValue = ''] = fileReader.result.split(',');

        resolve(encodedValue);
      };

      fileReader.onerror = (): void => {
        reject(new Error('Kon PDF niet lezen.'));
      };

      fileReader.readAsDataURL(file);
    });
  }

  private isPlanningDraft(value: unknown): value is PlanningDraft {
    if (!value || typeof value !== 'object') {
      return false;
    }

    if (!('dayKey' in value) || !('dayLabel' in value) || !('sourceFileName' in value) || !('pads' in value)) {
      return false;
    }

    const { dayKey, dayLabel, sourceFileName, pads } = value;

    return typeof dayKey === 'string'
      && typeof dayLabel === 'string'
      && typeof sourceFileName === 'string'
      && Array.isArray(pads);
  }

  private async loadPersonnel(): Promise<void> {
    this.loadingPersonnel = true;
    this.errorMessage = '';

    try {
      const response = await fetch(`${API_BASE_URL}/personnel`);

      if (!response.ok) {
        throw new Error(`Kon personeel niet laden (${response.status}).`);
      }

      const data: unknown = await response.json();

      if (!this.isPersonnelRecord(data)) {
        throw new Error('Ongeldig personeel-dataformaat ontvangen.');
      }

      this.personeelPerDag = this.normalizePersonnelRecord(data);
    }
    catch (error: unknown) {
      this.errorMessage = error instanceof Error ? error.message : 'Onbekende fout bij laden van personeel.';
    }
    finally {
      this.loadingPersonnel = false;
    }
  }

  private async savePersoneelForDay(day: DayKey): Promise<void> {
    this.errorMessage = '';

    try {
      const headers = new Headers();

      headers.set('Content-Type', 'application/json');

      const response = await fetch(`${API_BASE_URL}/personnel/${day}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(this.personeelPerDag[day]),
      });

      if (!response.ok) {
        throw new Error(`Kon ${this.dayLabels[day]} niet opslaan (${response.status}).`);
      }
    }
    catch (error: unknown) {
      this.errorMessage = error instanceof Error ? error.message : 'Onbekende fout bij opslaan van personeel.';
    }
  }

  private normalizePersonnelRecord(value: Record<string, unknown>): Record<DayKey, string[]> {
    const normalized: Record<DayKey, string[]> = {
      maandag: [],
      dinsdag: [],
      woensdag: [],
      donderdag: [],
      vrijdag: [],
      zaterdag: [],
      zondag: [],
    };

    for (const day of this.days) {
      const entries = value[day];

      if (Array.isArray(entries)) {
        normalized[day] = entries
          .filter((entry): entry is string => typeof entry === 'string')
          .map(name => name.trim())
          .filter(name => name.length > 0);
      }
    }

    return normalized;
  }

  private isPersonnelRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object';
  }
}
