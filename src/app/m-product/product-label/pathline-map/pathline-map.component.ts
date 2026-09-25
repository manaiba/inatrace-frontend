import { Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MapPin, MapPoint } from '../../../shared/mapbox-pins/mapbox-pins.component';

@Component({
    selector: 'app-pathline-map',
    templateUrl: './pathline-map.component.html',
    styleUrls: ['./pathline-map.component.scss']
})
export class PathlineMapComponent implements OnChanges, OnDestroy {

    journeyVertices: MapPoint[] = [];
    markers: MapPin[] = [];

    private markersFormValueChangeSubs: Subscription;

    @Input()
    public markersForm: FormArray;

    ngOnChanges(changes: SimpleChanges) {
        if (changes.markersForm) {

            // Form instance is changed, we need to register new subscription (also update the journey points)
            this.markersFormValueChangeSubs?.unsubscribe();
            this.updateJourneyVertices();

            this.markersFormValueChangeSubs = this.markersForm?.valueChanges.subscribe(() => {
                this.updateJourneyVertices();
            });
        }
    }

    ngOnDestroy() {
        this.markersFormValueChangeSubs?.unsubscribe();
    }

    addJourneyMarker(position: MapPoint) {
        this.markersForm.push(new FormGroup({
            latitude: new FormControl(position.lat),
            longitude: new FormControl(position.lng),
        }));
        this.markersForm.markAsDirty();
    }

    removeJourneyMarker(i: number) {
        this.markersForm.removeAt(i);
        this.markersForm.markAsDirty();
    }

    private updateJourneyVertices(): void {
        this.journeyVertices = (this.markersForm?.controls ?? []).map(ctrl => {
            return {
                lat: ctrl.get('latitude').value,
                lng: ctrl.get('longitude').value,
            };
        });
        this.markers = this.journeyVertices.map(position => ({ position }));
    }

}
