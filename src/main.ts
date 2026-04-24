import { provideHttpClient, withFetch } from '@angular/common/http';
import { importProvidersFrom, isDevMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideStore } from '@ngrx/store';
import { StoreDevtoolsModule } from '@ngrx/store-devtools';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(withFetch()),
    provideStore(),
    importProvidersFrom(
      StoreDevtoolsModule.instrument({
        name: 'Vulploegplanning Generator',
        maxAge: 25,
        logOnly: !isDevMode(),
        serialize: true,
        connectInZone: true,
      }),
    ),
  ],
})
  .catch((err: unknown) => {
    console.error(err);
  });
