import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { CountryService } from '../../shared-services/countries.service';
import { GlobalEventManagerService } from '../../core/global-event-manager.service';
import { FormGroup, Validators } from '@angular/forms';
import _ from 'lodash-es';
import { EnumSifrant } from '../../shared-services/enum-sifrant';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MapPin, MapPoint } from '../mapbox-pins/mapbox-pins.component';

@Component({
  selector: 'app-location-form-new',
  templateUrl: './location-form-new.component.html',
  styleUrls: ['./location-form-new.component.scss']
})
export class LocationFormNewComponent implements OnInit, OnDestroy {

  @Input()
  form: FormGroup;

  @Input()
  submitted = false;

  // Pin shown on the map; lat/lng live in the form, this only mirrors them
  markers: Array<MapPin> = [];

  private destroy$ = new Subject<void>();

  codebookStatus = EnumSifrant.fromObject(this.publiclyVisible);

  constructor(
      public countryCodes: CountryService,
      public globalEventsManager: GlobalEventManagerService
  ) { }

  ngOnInit(): void {
    this.updateCoordinateValidators(this.publiclyVisibleControl.value);
    this.publiclyVisibleControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(value => this.updateCoordinateValidators(value));

    this.syncMarkerFromForm();
    // Keep the pin in step with coordinates typed into the inputs
    this.latitudeControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.syncMarkerFromForm());
    this.longitudeControl.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.syncMarkerFromForm());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get isMapPinRequired(): boolean {
    return this.isPubliclyVisible(this.publiclyVisibleControl.value);
  }

  get hasInvalidMapPin(): boolean {
    return this.isMapPinRequired && (this.latitudeControl.invalid || this.longitudeControl.invalid);
  }

  syncMarkerFromForm() {
    const lat = this.toNumber(this.latitudeControl.value);
    const lng = this.toNumber(this.longitudeControl.value);
    this.markers = (lat == null || lng == null) ? [] : [{ position: { lat, lng } }];
  }

  doShowVillage(): boolean {
    return this.form.get('facilityLocation.address.country').invalid
        || _.isEqual(this.form.get('facilityLocation.address.country').value, {id: 184, code: 'RW', name: 'Rwanda'});
  }

  get publiclyVisible() {
    const obj = {};
    obj['true'] = $localize`:@@locationForm.publiclyVisible.yes:YES`;
    obj['false'] = $localize`:@@locationForm.publiclyVisible.no:NO`;
    return obj;
  }

  placeMarker(position: MapPoint) {
    this.setLatLng(position);
  }

  removeMarker() {
    this.setLatLng(null);
  }

  private setLatLng(position: MapPoint) {
    this.latitudeControl.setValue(position ? position.lat : null);
    this.longitudeControl.setValue(position ? position.lng : null);
    this.latitudeControl.markAsDirty();
    this.longitudeControl.markAsDirty();
  }

  private toNumber(value): number {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const n = Number(value);
    return isNaN(n) ? null : n;
  }

  private get publiclyVisibleControl() {
    return this.form.get('facilityLocation.publiclyVisible');
  }

  private get latitudeControl() {
    return this.form.get('facilityLocation.latitude');
  }

  private get longitudeControl() {
    return this.form.get('facilityLocation.longitude');
  }

  private updateCoordinateValidators(publiclyVisible: string | boolean): void {
    const validators = this.isPubliclyVisible(publiclyVisible) ? [Validators.required] : [];

    [this.latitudeControl, this.longitudeControl].forEach(control => {
      control.setValidators(validators);
      control.updateValueAndValidity();
    });
  }

  private isPubliclyVisible(value: string | boolean): boolean {
    return value === true || value === 'true';
  }

}
