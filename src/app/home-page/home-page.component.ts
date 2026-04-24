import { Component } from '@angular/core';

@Component({
  selector: 'vpg-home-page',
  standalone: true,
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.css',
})
export class HomePageComponent {
  protected selectedFileName = 'Nog geen PDF geselecteerd.';

  protected onPdfSelected(event: Event): void {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      this.selectedFileName = 'Nog geen PDF geselecteerd.';

      return;
    }

    this.selectedFileName = file.name;
  }
}
