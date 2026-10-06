import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
@Component({
  selector: 'lib-discard-changes-dialog',
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './discard-changes-dialog.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiscardChangesDialog {
  readonly ref = inject(MatDialogRef<DiscardChangesDialog>);
}
