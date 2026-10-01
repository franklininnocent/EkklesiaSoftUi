import { Pipe, PipeTransform } from '@angular/core';
import { FamilyPickerFields, formatFamilyHeadCell } from '@shared/utils/family-display.util';

@Pipe({
  name: 'cfFamilyHeadName',
  standalone: true,
})
export class CfFamilyHeadNamePipe implements PipeTransform {
  transform(family: FamilyPickerFields | null | undefined): string {
    return formatFamilyHeadCell(family);
  }
}
