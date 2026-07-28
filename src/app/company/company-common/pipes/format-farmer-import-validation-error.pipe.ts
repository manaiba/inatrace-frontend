import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatFarmerImportValidationError',
})
export class FormatFarmerImportValidationErrorPipe implements PipeTransform {

  transform(value: string): any {
    switch (value) {
      case 'INCORRECT_TYPE':
        return $localize`:@@companyDetail.farmers.import.validationErrors.cellError.type.INCORRECT_TYPE:The value in the cell is of wrong type`;
      case 'REQUIRED':
        return $localize`:@@companyDetail.farmers.import.validationErrors.cellError.type.REQUIRED:The cell cannot be empty`;
      case 'INVALID_VALUE':
        return $localize`:@@companyDetail.farmers.import.validationErrors.cellError.type.INVALID_VALUE:The provided value in the cell is invalid`;
      case 'INVALID_GEODATA':
        return $localize`:@@companyDetail.farmers.import.validationErrors.cellError.type.INVALID_GEODATA:The geo data is not valid. Expected format: POLYGON((lat1 lon1, lat2 lon2, ...)) with at least 3 points, or POINT(lat lon), with valid latitude (-90 to 90) and longitude (-180 to 180) values`;
      default:
        return '/';
    }
  }
}
