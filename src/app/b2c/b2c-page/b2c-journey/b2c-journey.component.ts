import { Component, Inject, OnInit } from '@angular/core';
import { B2cPageComponent } from '../b2c-page.component';
import { ApiBusinessToCustomerSettings } from '../../../../api/model/apiBusinessToCustomerSettings';
import { Subscription } from 'rxjs';
import { MapPin, MapPoint } from '../../../shared/mapbox-pins/mapbox-pins.component';
import { ApiHistoryTimelineItem } from '../../../../api/model/apiHistoryTimelineItem';
import { HistoryTimelineItem } from './model';
import { GlobalEventManagerService } from '../../../core/global-event-manager.service';

@Component({
  selector: 'app-b2c-journey',
  templateUrl: './b2c-journey.component.html',
  styleUrls: ['./b2c-journey.component.scss']
})
export class B2cJourneyComponent implements OnInit {

  constructor(
      @Inject(B2cPageComponent) private b2cPage: B2cPageComponent,
      public globalEventManager: GlobalEventManagerService
  ) {
    this.productName = b2cPage.productName;
    this.b2cSettings = b2cPage.b2cSettings;
  }

  productName: string;

  b2cSettings: ApiBusinessToCustomerSettings;

  subs: Subscription[] = [];

  producerName = '';
  historyItems: HistoryTimelineItem[] = [];

  locations: MapPoint[] = [];

  markers: MapPin[] = [];

  defaultCenter = {
    lat: 5.274054,
    lng: 21.514503
  };
  defaultZoom = 2;

  ngOnInit(): void {
    this.initLabel();
    this.data().then();
  }

  styleForIconType(iconType: string) {
    switch (iconType) {
      case 'SHIP': return 'af-journey-dot-shape--ship';
      case 'LEAF': return 'af-journey-dot-shape--leaf';
      case 'WAREHOUSE': return 'af-journey-dot-shape--warehouse';
      case 'QRCODE': return 'af-journey-dot-shape--qr-code';
      case 'OTHER': return 'af-journey-dot-shape--other';
      default:
        return 'af-journey-dot-shape--leaf';
    }
  }

  addIconStyleForIconType(item: ApiHistoryTimelineItem): HistoryTimelineItem {

    let iconClass;
    if (!item.iconType) {
      if (item.type === 'TRANSFER') {
        iconClass = 'af-journey-dot-shape--ship';
      } else {
        iconClass = 'af-journey-dot-shape--leaf';
      }
    } else {
      iconClass = this.styleForIconType(item.iconType);
    }
    return {...item, iconClass};
  }

  initLabel() {

    const labelData = this.b2cPage.publicProductLabel;

    for (const item of labelData.fields) {
      if (item.name === 'name') {
        this.producerName = item.value;
      }
      if (item.name === 'journeyMarkers') {
        this.locations = item.value.map(marker => {
          return {
            lat: marker.latitude,
            lng: marker.longitude,
          };
        });
      }
    }
  }

  async data() {

    for (let i = 0; i < this.locations.length; i += 2) {
      this.markers.push({
        position: {
          lat: this.locations[i].lat,
          lng: this.locations[i].lng
        }
      });
    }

    if (this.b2cPage.qrTag !== 'EMPTY') {

      // Get the aggregated history for the QR code tag
      const qrData = this.b2cPage.qrProductLabel;
      if (qrData) {
        this.historyItems = qrData.historyTimeline.items.map(item => this.addIconStyleForIconType(item));
        this.producerName = qrData.producerName;

        qrData.historyTimeline.items.map(historyItem => {
          if (historyItem.longitude && historyItem.latitude) {
            this.markers.push({
              position: {
                lat: historyItem.latitude,
                lng: historyItem.longitude
              }
            });
          }
        });
      }
    }
  }

  formatDate(date) {
    if (date) {
      const split = date.split('-');
      return split[2] + '.' + split[1] + '.' + split[0];
    }
    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    return day + '.' + month + '.' + year;
  }

}
