import { ApiUserCustomer } from '../../api/model/apiUserCustomer';
import ValidationStatusEnum = ApiUserCustomer.ValidationStatusEnum;

/** Supervisor review state of a farmer: translated label and badge CSS class. */
export function farmerValidationStatusLabel(status: ValidationStatusEnum | string): string {
  switch (status) {
    case ValidationStatusEnum.PENDING:
      return $localize`:@@farmerValidation.status.pending:Pending validation`;
    case ValidationStatusEnum.REJECTED:
      return $localize`:@@farmerValidation.status.rejected:Not validated`;
    default:
      return $localize`:@@farmerValidation.status.validated:Validated`;
  }
}

export function farmerValidationStatusClass(status: ValidationStatusEnum | string): string {
  switch (status) {
    case ValidationStatusEnum.PENDING:
      return 'farmer-status farmer-status--pending';
    case ValidationStatusEnum.REJECTED:
      return 'farmer-status farmer-status--rejected';
    default:
      return 'farmer-status farmer-status--validated';
  }
}
