import { Pipe, PipeTransform } from '@angular/core';
import { ApiUserCustomer } from '../../../api/model/apiUserCustomer';
import { farmerIdentityName, personName } from '../../shared-services/person-name';

/** Renders a person as "Surname Name"; see shared-services/person-name.ts. */
@Pipe({
    name: 'personName'
})
export class PersonNamePipe implements PipeTransform {

    transform(person: { name?: string, surname?: string }): string {
        return personName(person);
    }

}

/** Renders a farmer/collector as "Surname Name (ID, village)"; see shared-services/person-name.ts. */
@Pipe({
    name: 'farmerIdentity'
})
export class FarmerIdentityPipe implements PipeTransform {

    transform(farmer: ApiUserCustomer): string {
        return farmerIdentityName(farmer);
    }

}
