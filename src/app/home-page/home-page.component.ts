import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import type { OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

type DayKey = 'maandag'
  | 'dinsdag'
  | 'woensdag'
  | 'donderdag'
  | 'vrijdag'
  | 'zaterdag'
  | 'zondag';

interface PlanningGroup {
  code: number
  colli: number
  description: string
}

interface PlanningPad {
  groups: PlanningGroup[]
  medewerkers: string[]
  padName: string
  startTime: string
  totalColli: number
}

interface PlanningDraft {
  dayKey: DayKey
  dayLabel: string
  documentDate: string | null
  documentDateLabel: string
  pads: PlanningPad[]
  sourceFileName: string
}

const API_BASE_URL = '/api';
const HOURS_PER_DAY = 24;
const MAX_HOUR = 23;
const MAX_MINUTE = 59;
const MINUTES_PER_HOUR = 60;
const PAD_START_LENGTH = 2;
const EMPTY_FILE_LABEL = 'Nog geen PDF geselecteerd.';
const DEFAULT_EMPLOYEE_ENTRY = '';

@Component({
  selector: 'vpg-home-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  protected updatePlanningMedewerker(padIndex: number, medewerkerIndex: number, event: Event): void {
    const pad = this.planningDraft?.pads[padIndex];
    const input = event.target;

    if (!pad || !(input instanceof HTMLInputElement)) {
      return;
    }

    pad.medewerkers[medewerkerIndex] = input.value;
  }

  protected updatePlanningStartTime(padIndex: number, event: Event): void {
    const pad = this.planningDraft?.pads[padIndex];
    const input = event.target;

    if (!pad || !(input instanceof HTMLInputElement)) {
      return;
    }

    pad.startTime = input.value;
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

  private parseTimeToMinutes(value: string): number | null {
    const timePattern = /^(\d{2}):(\d{2})$/;
    const match = timePattern.exec(value);

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
      body {
        margin: 24px;
        color: #18314f;
        font-family: "Segoe UI", sans-serif;
      }

      h1 {
        margin: 0 0 8px;
        font-size: 30px;
      }

      p {
        margin: 0 0 6px;
        color: #5f7188;
      }

      table {
        width: 100%;
        margin-top: 24px;
        border-collapse: collapse;
      }

      th,
      td {
        padding: 10px 12px;
        border: 1px solid #c9d9ea;
        text-align: left;
        vertical-align: top;
        font-size: 13px;
      }

      th {
        background-color: #14609e;
        color: #fff;
      }

      @media print {
        body {
          margin: 12mm;
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
          .map(group => `${group.code} ${group.description} (${group.colli})`)
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
  <h1>Vulploegplanning ${this.escapeHtml(planning.dayLabel)}</h1>
  <p>Bronbestand: ${this.escapeHtml(planning.sourceFileName)}</p>
  <p>Datum: ${this.escapeHtml(planning.documentDateLabel || planning.dayLabel)}</p>
  <p>Standaard vulsnelheid: 1 colli per minuut per medewerker</p>
  <table>
    <thead>
      <tr>
        <th>Pad</th>
        <th>Colli</th>
        <th>Begintijd</th>
        <th>Eindtijd</th>
        <th>Duur</th>
        <th>Medewerkers</th>
        <th>Artikelgroepen</th>
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
