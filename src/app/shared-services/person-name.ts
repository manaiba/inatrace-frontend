import { ApiUserCustomer } from '../../api/model/apiUserCustomer';

/**
 * How people are named across the app: family name first ("NOM Prénom"), as users identify
 * farmers by family name. Missing parts are skipped rather than printed as "undefined".
 */
export function personName(person: { name?: string, surname?: string }): string {
  if (!person) {
    return '';
  }
  return [person.surname, person.name].filter(part => !!part && part.trim()).join(' ');
}

/**
 * A farmer's or collector's name plus what tells same-named people apart: their company-internal
 * ID (or database ID) and where they live. Rwanda and Honduras keep their established formats.
 */
export function farmerIdentityName(farmer: ApiUserCustomer): string {
  if (!farmer) {
    return '';
  }

  const address = farmer.location?.address;
  const id = farmer.farmerCompanyInternalId || (farmer.id != null ? String(farmer.id) : '');
  let place = '';

  if (address?.country?.code === 'RW') {
    const cell = address.cell ? address.cell.substring(0, 2).toLocaleUpperCase() : '--';
    const village = address.village ? address.village.substring(0, 2).toLocaleUpperCase() : '--';
    place = village + '-' + cell;
  } else if (address?.country?.code === 'HN') {
    place = (address.hondurasMunicipality || '--') + '-' + (address.hondurasVillage || '--');
  } else if (address) {
    place = address.village || address.city || '';
  }

  const details = [id, place].filter(part => !!part).join(', ');
  return details ? `${personName(farmer)} (${details})` : personName(farmer);
}
