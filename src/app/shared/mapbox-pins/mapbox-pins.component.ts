import {
  AfterViewInit,
  Component,
  DoCheck,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnDestroy,
  Output,
  ViewChild
} from '@angular/core';
import * as mapboxgl from 'mapbox-gl';
import { environment } from 'src/environments/environment';

export interface MapPoint {
  lat: number;
  lng: number;
}

export interface MapPin {
  position: MapPoint;
  // Shown inside the pin (e.g. number of farmers); { text } is the former Google Maps label shape
  label?: string | { text: string };
  infoText?: string;
}

/**
 * Small Mapbox map showing pins and, optionally, a dashed path between points.
 * It replaces the former <google-map> usages: the parent keeps its own marker list and
 * reacts to the add / drag / remove events, exactly as it did with Google Maps.
 */
@Component({
  selector: 'app-mapbox-pins',
  templateUrl: './mapbox-pins.component.html',
  styleUrls: ['./mapbox-pins.component.scss']
})
export class MapboxPinsComponent implements AfterViewInit, DoCheck, OnDestroy {

  private static readonly LINE_ID = 'mapbox-pins-line';
  private static readonly BOUNDS_OFFSET = 0.02;

  @Input() markers: Array<MapPin> = [];

  // Dashed path drawn through these points, in order (e.g. a product journey)
  @Input() path: Array<MapPoint> = null;

  // Points to fit the view to; defaults to the marker positions
  @Input() fitPoints: Array<MapPoint> = null;

  @Input() height = '380px';

  @Input() draggable = false;

  // 'pin' = classic map pin (numbered when the marker has a label), 'circle' = small dot
  @Input() markerStyle: 'pin' | 'circle' = 'pin';

  @Input() circleColor = '#25265E';

  // Which map gesture emits mapAdd; null for a read-only map
  @Input() addOn: 'dblclick' | 'click' | null = null;

  @Input() defaultCenter: MapPoint = { lat: 5.274054, lng: 21.514503 };

  @Input() defaultZoom = 3;

  // Re-fit the view whenever the markers change (read-only maps); editable maps keep the view
  @Input() autoFit = false;

  @Output() mapAdd = new EventEmitter<MapPoint>();

  @Output() markerDragEnd = new EventEmitter<{ index: number, position: MapPoint }>();

  // Emitted on right click of a marker
  @Output() markerRemove = new EventEmitter<number>();

  @ViewChild('mapContainer', { static: true }) mapContainer: ElementRef<HTMLDivElement>;

  readonly tokenMissing = !environment.mapboxAccessToken;

  private map: any;
  private loaded = false;
  private renderedMarkers: Array<any> = [];
  private lastSignature: string = null;
  private resizeObserver: any;
  // Once the user pans or zooms, stop re-fitting the view on container resizes
  private userMoved = false;

  constructor(private zone: NgZone) { }

  ngAfterViewInit(): void {
    if (this.tokenMissing) {
      return;
    }
    this.zone.runOutsideAngular(() => this.createMap());
  }

  ngDoCheck(): void {
    // Parents mutate their marker arrays in place, so compare content rather than references
    if (!this.loaded) {
      return;
    }
    const signature = this.signature();
    if (signature !== this.lastSignature) {
      this.lastSignature = signature;
      this.zone.runOutsideAngular(() => {
        this.render();
        if (this.autoFit) {
          this.fitBounds();
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.renderedMarkers.forEach(m => m.remove());
    this.removeMapWhenSettled();
  }

  // Removing a map while tiles are still loading makes mapbox-gl throw asynchronously
  // ("Cannot read properties of undefined (reading 'send')"), so wait until it is idle
  private removeMapWhenSettled(): void {
    const map = this.map;
    if (!map) {
      return;
    }
    let removed = false;
    const remove = () => {
      if (removed) {
        return;
      }
      removed = true;
      try {
        map.remove();
      } catch (e) {
        // the map is being discarded anyway
      }
    };
    if (map.loaded()) {
      remove();
    } else {
      map.once('idle', remove);
      setTimeout(remove, 10000);
    }
  }

  /** Fits the view to the given points (or fitPoints / the markers) with a minimum extent. */
  fitBounds(points?: Array<MapPoint>): void {
    if (!this.map) {
      return;
    }
    const pts = (points ?? this.fitPoints ?? this.markers.map(m => m.position))
      .filter(p => p && p.lat != null && p.lng != null);

    if (pts.length === 0) {
      this.map.jumpTo({ center: [this.defaultCenter.lng, this.defaultCenter.lat], zoom: this.defaultZoom });
      return;
    }

    const bounds = new mapboxgl.LngLatBounds();
    pts.forEach(p => bounds.extend([p.lng, p.lat]));
    const center = bounds.getCenter();
    const offset = MapboxPinsComponent.BOUNDS_OFFSET;
    bounds.extend([center.lng - offset, center.lat - offset]);
    bounds.extend([center.lng + offset, center.lat + offset]);
    this.map.fitBounds(bounds, { padding: 30, animate: false });
  }

  private createMap(): void {
    this.map = new mapboxgl.Map({
      accessToken: environment.mapboxAccessToken,
      container: this.mapContainer.nativeElement,
      style: 'mapbox://styles/mapbox/streets-v12',
      // streets-v12 defaults to the globe projection, where fitBounds ignores the padding and
      // puts the outermost points on the edge; these small maps read better flat anyway
      projection: 'mercator',
      center: [this.defaultCenter.lng, this.defaultCenter.lat],
      zoom: this.defaultZoom,
      doubleClickZoom: this.addOn !== 'dblclick'
    });
    this.map.dragRotate.disable();
    this.map.touchZoomRotate.disableRotation();
    this.map.addControl(new mapboxgl.NavigationControl({ showCompass: false }));

    if (this.addOn) {
      this.map.on(this.addOn, (e: any) => {
        // Markers sit inside the map container, so a click on a marker also reaches the map
        const target = e.originalEvent?.target as HTMLElement;
        if (target?.closest && target.closest('.mapboxgl-marker')) {
          return;
        }
        this.zone.run(() => this.mapAdd.emit({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
      });
    }

    this.map.on('movestart', (e: any) => {
      if (e.originalEvent) {
        this.userMoved = true;
      }
    });

    this.map.on('load', () => {
      this.loaded = true;
      this.map.resize();
      this.lastSignature = this.signature();
      this.render();
      this.fitBounds();
    });

    // The map is often created inside collapsed or hidden sections; keep the canvas sized
    const ResizeObserverImpl = (window as any).ResizeObserver;
    if (ResizeObserverImpl) {
      this.resizeObserver = new ResizeObserverImpl(() => {
        if (!this.map) {
          return;
        }
        this.map.resize();
        if (this.loaded && !this.userMoved) {
          this.fitBounds();
        }
      });
      this.resizeObserver.observe(this.mapContainer.nativeElement);
    }
  }

  private signature(): string {
    return JSON.stringify([
      (this.markers ?? []).map(m => [m.position?.lat, m.position?.lng, m.label, m.infoText?.trim()]),
      (this.path ?? []).map(p => [p.lat, p.lng]),
      this.draggable,
      this.markerStyle
    ]);
  }

  private render(): void {
    this.renderMarkers();
    this.renderPath();
  }

  private renderMarkers(): void {
    this.renderedMarkers.forEach(m => m.remove());
    this.renderedMarkers = [];

    (this.markers ?? []).forEach((pin, index) => {
      if (!pin?.position || pin.position.lat == null || pin.position.lng == null) {
        return;
      }
      const options: any = { draggable: this.draggable };
      const element = this.markerElement(pin);
      if (element) {
        options.element = element;
        options.anchor = this.markerStyle === 'circle' ? 'center' : 'bottom';
      }
      const marker = new mapboxgl.Marker(options)
        .setLngLat([pin.position.lng, pin.position.lat])
        .addTo(this.map);

      if (pin.infoText?.trim()) {
        // setText, not setHTML: pin names are user input
        marker.setPopup(new mapboxgl.Popup({ offset: 25, closeButton: false }).setText(pin.infoText));
      }

      marker.getElement().addEventListener('contextmenu', (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        this.zone.run(() => this.markerRemove.emit(index));
      });

      if (this.draggable) {
        marker.on('dragend', () => {
          const lngLat = marker.getLngLat();
          this.zone.run(() => this.markerDragEnd.emit({ index, position: { lat: lngLat.lat, lng: lngLat.lng } }));
        });
      }

      this.renderedMarkers.push(marker);
    });
  }

  private markerElement(pin: MapPin): HTMLElement {
    if (this.markerStyle === 'circle') {
      const dot = document.createElement('div');
      dot.className = 'mapbox-pins-circle';
      dot.style.backgroundColor = this.circleColor;
      return dot;
    }
    const labelText = (typeof pin.label === 'object' ? pin.label?.text : pin.label)?.toString().trim();
    if (labelText) {
      const el = document.createElement('div');
      el.className = 'mapbox-pins-labelled';
      const span = document.createElement('span');
      const b = document.createElement('b');
      b.textContent = labelText;
      span.appendChild(b);
      el.appendChild(span);
      return el;
    }
    // Default Mapbox pin
    return null;
  }

  private renderPath(): void {
    const coordinates = (this.path ?? [])
      .filter(p => p && p.lat != null && p.lng != null)
      .map(p => [p.lng, p.lat]);
    const data: any = {
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates }
    };
    const source = this.map.getSource(MapboxPinsComponent.LINE_ID);

    if (coordinates.length < 2) {
      if (this.map.getLayer(MapboxPinsComponent.LINE_ID)) {
        this.map.removeLayer(MapboxPinsComponent.LINE_ID);
      }
      if (source) {
        this.map.removeSource(MapboxPinsComponent.LINE_ID);
      }
      return;
    }

    if (source) {
      source.setData(data);
      return;
    }
    this.map.addSource(MapboxPinsComponent.LINE_ID, { type: 'geojson', data });
    this.map.addLayer({
      id: MapboxPinsComponent.LINE_ID,
      type: 'line',
      source: MapboxPinsComponent.LINE_ID,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': this.circleColor, 'line-width': 2, 'line-dasharray': [2, 3] }
    });
  }

}
