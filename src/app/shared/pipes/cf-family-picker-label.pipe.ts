import { Pipe, PipeTransform } from '@angular/core';
import { FamilyPickerFields, formatFamilyPickerLabel } from '@shared/utils/family-display.util';

@Pipe({
  name: 'cfFamilyPickerLabel',
  standalone: true,
})
export class CfFamilyPickerLabelPipe implements PipeTransform {
  transform(family: FamilyPickerFields | null | undefined): string {
    return formatFamilyPickerLabel(family);
  }
}
