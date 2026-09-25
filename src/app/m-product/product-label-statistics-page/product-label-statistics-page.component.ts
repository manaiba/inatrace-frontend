import { Component, OnInit, OnDestroy } from '@angular/core';
import { ProductControllerService } from 'src/api/api/productController.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MapPin } from '../../shared/mapbox-pins/mapbox-pins.component';
import { FormGroup, FormControl } from '@angular/forms';
import { GlobalEventManagerService } from 'src/app/core/global-event-manager.service';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-product-label-statistics-page',
  templateUrl: './product-label-statistics-page.component.html',
  styleUrls: ['./product-label-statistics-page.component.scss']
})
export class ProductLabelStatisticsPageComponent implements OnInit, OnDestroy {

  defaultCenter = {
    lat: 37.0769238,
    lng: 24.2160421
  };
  defaultZoom = 2;

  // Markers of the location types currently ticked below the map
  visibleMarkers: Array<MapPin> = [];

  initialBoundsAuth: any = [];
  initialBoundsOrig: any = [];
  initialBoundsVisit: any = [];

  authMarkers: any = [];
  origMarkers: any = [];
  visitMarkers: any = [];

  subs: Subscription[] = [];
  statistics = {};

  goToLink: string = this.router.url.substr(0, this.router.url.lastIndexOf("/"));

  showAuth = true;
  showOrig = true;

  locationsForm = new FormGroup({
    visitLoc: new FormControl(true),
    authLoc: new FormControl(false),
    origLoc: new FormControl(false)
    });

  constructor(
    private globalEventsManager: GlobalEventManagerService,
    private productController: ProductControllerService,
    private route: ActivatedRoute,
    private router: Router
  ) { }


  id = +this.route.snapshot.paramMap.get('labelId');

  ngOnInit(): void {
    this.getStatistics();

    this.subs.push(this.locationsForm.valueChanges.subscribe(() => this.fitBounds()));
  }

  ngOnDestroy(): void {
    this.subs.forEach(sub => sub.unsubscribe());
  }

  getStatistics() {
    this.globalEventsManager.showLoading(true);

    let sub = this.productController.getProductLabel(this.id).
    subscribe(lab => {
      if(lab.status == "OK") {
        this.getStatistcsData(lab.data.uuid);
      }
    }, err => this.globalEventsManager.showLoading(true)
    )
    this.subs.push(sub);
  }

  getStatistcsData(uuid: string) {
    let sub = this.productController.getProductLabelAnalytics(uuid)
    .subscribe(stat => {
      if (stat.status == "OK") {
        this.statistics = stat.data;
        this.initializeMarkers(this.statistics);
      }
      this.globalEventsManager.showLoading(false);
    },
    err => this.globalEventsManager.showLoading(true)
    )
    this.subs.push(sub);
  }


  initializeMarkers(data): void {
    this.authMarkers = [];
    this.origMarkers = [];
    this.visitMarkers = [];
    if(data) {
      Object.entries(data.authLocations).forEach(
        ([key, value]) => {
          if(key != 'unknown') {
            let num = value;
            let pos = key.split(':');
            let tmp = {
              position: {
                lat: parseFloat(pos[0]),
                lng: parseFloat(pos[1])
              },
              // label: {
              //   text: String(num)
              // }
            }
            this.authMarkers.push(tmp);
            this.initialBoundsAuth.push(tmp.position)
          }
        }
      )
      Object.entries(data.originLocations).forEach(
        ([key, value]) => {
          if (key != 'unknown') {
            let num = value;
            let pos = key.split(':');
            let tmp = {
              position: {
                lat: parseFloat(pos[0]),
                lng: parseFloat(pos[1])
              },
              // label: {
              //   text: String(num)
              // }
            }
            this.origMarkers.push(tmp);
            this.initialBoundsOrig.push(tmp.position)
          }
        }
      )
      Object.entries(data.visitsLocations).forEach(
        ([key, value]) => {
          if (key != 'unknown') {
            let num = value;
            let pos = key.split(':');
            let tmp = {
              position: {
                lat: parseFloat(pos[0]),
                lng: parseFloat(pos[1])
              },
              // label: {
              //   text: String(num)
              // }
            }
            this.visitMarkers.push(tmp);
            this.initialBoundsVisit.push(tmp.position)
          }
        }
      )
    }
    this.fitBounds();
  }


  // Shows the ticked location types; the map re-fits itself when its markers change
  fitBounds() {
    this.visibleMarkers = [
      ...(this.locationsForm.get('visitLoc').value ? this.visitMarkers : []),
      ...(this.locationsForm.get('authLoc').value ? this.authMarkers : []),
      ...(this.locationsForm.get('origLoc').value ? this.origMarkers : [])
    ];
  }

}
