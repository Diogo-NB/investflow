import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthSession } from './auth/auth-session.service';

@Component({
  imports: [MatButtonModule, RouterLink, RouterOutlet],
  selector: 'app-root',
  templateUrl: './app.html',
  host: { class: 'flex min-h-screen flex-col' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  readonly auth = inject(AuthSession);
  private readonly mainContent =
    viewChild<ElementRef<HTMLElement>>('mainContent');

  focusMain(): void {
    queueMicrotask(() =>
      this.mainContent()?.nativeElement.focus({ preventScroll: true }),
    );
  }

  logout(): void {
    void this.auth.logout();
  }
}
