import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { FormGroup, Validators } from '@angular/forms';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { Subscription } from 'rxjs';
import { CountryService } from 'src/app/shared-services/countries.service';
import { GlobalEventManagerService } from 'src/app/core/global-event-manager.service';
import { EnumSifrant } from 'src/app/shared-services/enum-sifrant';
import { ApiCountry } from "../../../api/model/apiCountry";

@Component({
  selector: 'location-form',
  templateUrl: './location-form.component.html',
  styleUrls: ['./location-form.component.scss']
})
export class LocationFormComponent implements OnInit, OnDestroy {

  faTimes = faTimes;

  @Input()
  form: FormGroup;

  @Input()
  submitted = false;

  subs: Subscription[] = [];

  constructor(
    public countryCodes: CountryService,
    public globalEventsManager: GlobalEventManagerService
  ) { }

  ngOnInit(): void {

    // The single-choice control works with 'true' / 'false' strings
    const tmpVis = this.form.get('publiclyVisible').value;
    if (tmpVis != null) { this.form.get('publiclyVisible').setValue(tmpVis.toString()); }

    this.subs.push(
        this.form.get('address.country').valueChanges
            .subscribe(() => {

              // Honduras specifics
              if (this.showHondurasFields()) {
                this.enableValidationHonduras();
              } else {
                this.disableValidationHonduras();
                this.clearValuesHonduras();
              }
              this.updateHonduras();

              // Rwanda specifics
              if (this.showRwandaFields()) {
                this.enableValidationRwanda();
              } else {
                this.disableValidationRwanda();
                this.clearValuesRwanda();
              }
              this.updateRwanda();

              if (this.showHondurasFields() || this.showRwandaFields()) {
                this.disableValidationOther();
                this.clearValuesOther();
              } else {
                this.enableValidationOther();
              }
              this.updateOther();
            })
    );

    // Trigger valueChanges to set validators accordingly
    this.form.get('address.country').updateValueAndValidity({ emitEvent: true });
  }

  ngOnDestroy(): void {
    this.subs.forEach(sub => { sub.unsubscribe(); });
  }

  showRwandaFields() {
    let country = this.form.get('address.country')?.value as ApiCountry;
    return country && country.code === 'RW';
  }

  showHondurasFields() {
    let country = this.form.get('address.country')?.value as ApiCountry;
    return country && country.code === 'HN';
  }

  enableValidationHonduras() {
    this.form.get('address.hondurasDepartment').setValidators([Validators.required]);
    this.form.get('address.hondurasFarm').setValidators(null);
    this.form.get('address.hondurasMunicipality').setValidators([Validators.required]);
    this.form.get('address.hondurasVillage').setValidators([Validators.required]);
  }

  disableValidationHonduras() {
    this.form.get('address.hondurasDepartment').setValidators(null);
    this.form.get('address.hondurasFarm').setValidators(null);
    this.form.get('address.hondurasMunicipality').setValidators(null);
    this.form.get('address.hondurasVillage').setValidators(null);
  }

  clearValuesHonduras() {
    this.form.get('address.hondurasDepartment').setValue(null);
    this.form.get('address.hondurasFarm').setValue(null);
    this.form.get('address.hondurasMunicipality').setValue(null);
    this.form.get('address.hondurasVillage').setValue(null);
  }

  updateHonduras() {
    this.form.get('address.hondurasDepartment').updateValueAndValidity();
    this.form.get('address.hondurasFarm').updateValueAndValidity();
    this.form.get('address.hondurasMunicipality').updateValueAndValidity();
    this.form.get('address.hondurasVillage').updateValueAndValidity();
  }

  enableValidationRwanda() {
    this.form.get('address.village').setValidators([Validators.required]);
    this.form.get('address.cell').setValidators([Validators.required]);
    this.form.get('address.sector').setValidators([Validators.required]);
  }

  disableValidationRwanda() {
    this.form.get('address.village').setValidators(null);
    this.form.get('address.cell').setValidators(null);
    this.form.get('address.sector').setValidators(null);
  }

  clearValuesRwanda() {
    this.form.get('address.village').setValue(null);
    this.form.get('address.cell').setValue(null);
    this.form.get('address.sector').setValue(null);
  }

  updateRwanda() {
    this.form.get('address.village').updateValueAndValidity();
    this.form.get('address.cell').updateValueAndValidity();
    this.form.get('address.sector').updateValueAndValidity();
  }

  enableValidationOther() {
    this.form.get('address.city').setValidators([Validators.required]);
    this.form.get('address.state').setValidators([Validators.required]);
  }

  disableValidationOther() {
    this.form.get('address.city').setValidators(null);
    this.form.get('address.state').setValidators(null);
  }

  clearValuesOther() {
    this.form.get('address.address').setValue(null);
    this.form.get('address.city').setValue(null);
    this.form.get('address.state').setValue(null);
    this.form.get('address.zip').setValue(null);
  }

  updateOther() {
    this.form.get('address.address').updateValueAndValidity();
    this.form.get('address.city').updateValueAndValidity();
    this.form.get('address.state').updateValueAndValidity();
    this.form.get('address.zip').updateValueAndValidity();
  }

  get publiclyVisible() {
    const obj = {};
    obj['true'] = $localize`:@@locationForm.publiclyVisible.yes:YES`;
    obj['false'] = $localize`:@@locationForm.publiclyVisible.no:NO`;
    return obj;
  }

  codebookStatus = EnumSifrant.fromObject(this.publiclyVisible);
}
