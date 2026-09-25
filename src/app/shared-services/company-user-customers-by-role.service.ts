import { GeneralSifrantService } from './general-sifrant.service';
import { ApiUserCustomer } from '../../api/model/apiUserCustomer';
import { Observable } from 'rxjs';
import { PagedSearchResults } from '../../interfaces/CodebookHelperService';
import { map } from 'rxjs/operators';
import { ApiPaginatedResponseApiUserCustomer } from '../../api/model/apiPaginatedResponseApiUserCustomer';
import { CompanyControllerService, GetUserCustomersForCompanyAndType } from '../../api/api/companyController.service';
import { farmerIdentityName } from './person-name';

export class CompanyUserCustomersByRoleService extends GeneralSifrantService<ApiUserCustomer> {

  constructor(
    private companyControllerService: CompanyControllerService,
    private companyId: number,
    private role: string
  ) {
    super();
  }

  requestParams = {
    limit: 1000,
    offset: 0,
  } as GetUserCustomersForCompanyAndType.PartialParamMap;

  identifier(el: ApiUserCustomer) {
    return el.id;
  }

  textRepresentation(el: ApiUserCustomer): string {
    return farmerIdentityName(el);
  }

  makeQuery(key: string, params?: any): Observable<PagedSearchResults<ApiUserCustomer>> {

    const limit = params && params.limit ? params.limit : this.limit();
    const reqParams: GetUserCustomersForCompanyAndType.PartialParamMap = {
      query: key,
      searchBy: 'BY_NAME_AND_SURNAME',
      companyId: this.companyId,
      type: this.role,
      ...this.requestParams
    };

    return this.companyControllerService.getUserCustomersForCompanyAndTypeByMap(reqParams)
      .pipe(
        map((res: ApiPaginatedResponseApiUserCustomer) => {
          return {
            results: res.data.items,
            offset: 0,
            limit,
            totalCount: res.data.count
          };
        })
      );
  }

  public placeholder(): string {
    return $localize`:@@activeUserCustomersByOrganizationAndRole.input.placehoder:Select ...`;
  }

}
