import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CompanyControllerService } from '../../api/api/companyController.service';
import { Configuration } from '../../api/configuration';
import { ApiUserCustomer } from '../../api/model/apiUserCustomer';
import { LanguageCodeHelper } from '../language-code-helper';
import { LanguageInterceptor } from './language.interceptor';

describe('Generated company client runtime contract', () => {
  let service: CompanyControllerService;
  let http: HttpTestingController;

  beforeEach(() => {
    spyOn(LanguageCodeHelper, 'getCurrentLocale').and.returnValue('en');
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CompanyControllerService,
        { provide: Configuration, useValue: new Configuration({ basePath: '', withCredentials: true }) },
        { provide: HTTP_INTERCEPTORS, useClass: LanguageInterceptor, multi: true }]
    });
    service = TestBed.inject(CompanyControllerService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('preserves the existing farmer metadata order used by form creation', () => {
    expect(ApiUserCustomer.formMetadata().vars.slice(0, 4).map(field => field.name))
      .toEqual(['id', 'companyId', 'farmerCompanyInternalId', 'type']);
  });

  it('sends the language and credentials and preserves a JSON response', () => {
    let result: any;
    service.getUserCustomer(42).subscribe(value => result = value);
    const request = http.expectOne('/api/company/userCustomers/42');
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('language')).toBe('EN');
    request.flush({ status: 'OK', data: { id: 42, plots: [] } });
    expect(result.data.id).toBe(42);
    expect(result.data.plots).toEqual([]);
  });

  it('propagates a backend error instead of reporting success', () => {
    let status: number;
    service.getUserCustomer(42).subscribe(() => fail('request unexpectedly succeeded'), error => status = error.status);
    const request = http.expectOne('/api/company/userCustomers/42');
    request.flush({ status: 'UNAUTHORIZED' }, { status: 403, statusText: 'Forbidden' });
    expect(status).toBe(403);
  });

  it('requests the farmer export as a binary response with credentials', () => {
    let result: Blob;
    service.exportFarmerDataByCompany(7).subscribe(value => result = value);
    const request = http.expectOne('/api/company/userCustomers/7/exportFarmerData');
    expect(request.request.responseType).toBe('blob');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('language')).toBe('EN');
    const file = new Blob(['fixture'], { type: 'application/octet-stream' });
    request.flush(file);
    expect(result).toBe(file);
  });
});
