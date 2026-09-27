import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthSession } from './auth/auth-session.service';

@Component({
  imports: [MatButtonModule, RouterLink, RouterOutlet],
  selector: 'app-root',
  templateUrl: './app.html',
  host: { class: 'block min-h-screen' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  readonly auth = inject(AuthSession);

  logout(): void {
    void this.auth.logout();
  }
}
