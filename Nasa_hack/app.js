// WeatherInsight+ Application
class WeatherInsightApp {
    constructor() {
        this.map = null;
        this.routeMap = null;
        this.selectedLocation = null;
        this.drawnItems = null;
        this.drawControl = null;
        this.currentDrawnLayer = null;
        this.weatherData = null;
        this.charts = {};
        this.lastDataSource = 'UNKNOWN'; // POWER | FALLBACK
        this.lastSeries = null; // { dates: [], data: { tMax, tMin, prcp, wind, rh } }
        this.lastAggregates = null; // { tMaxAvg, tMinAvg, prcpTotal, windAvg, rhAvg }
        this.lastDaily = null; // { dates: [YYYYMMDD...], tMax, tMin, prcp, wind, rh }
        // Route state
        this.routeLayer = null;
        this.routeMarkers = [];
        
        this.init();
    }

    displayWeatherDetails() {
        if (!this.lastSeries || !this.lastAggregates) return;
        const resultsContent = document.getElementById('resultsContent');
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        const card = document.createElement('div');
        card.className = 'weather-card';
        card.style.borderLeftColor = '#667eea';
        const a = this.lastAggregates;

        const fmt = (n, d=1) => Number.isFinite(n) ? n.toFixed(d) : '—';
        card.innerHTML = `
            <h4><i class="fas fa-calendar-day"></i> Weather Details (From ${startDate} to ${endDate})</h4>
            <div class="details-grid">
                <div><strong>Avg Max Temp:</strong> ${fmt(a.tMaxAvg,1)} °C</div>
                <div><strong>Avg Min Temp:</strong> ${fmt(a.tMinAvg,1)} °C</div>
                <div><strong>Total Precipitation:</strong> ${fmt(a.prcpTotal,1)} mm</div>
                <div><strong>Avg Wind Speed:</strong> ${fmt(a.windAvg,1)} m/s</div>
                <div><strong>Avg Humidity:</strong> ${fmt(a.rhAvg,1)} %</div>
            </div>
        `;
        resultsContent.appendChild(card);
    }

    displayWeatherDailyBreakdown() {
        if (!this.lastDaily) return;
        const resultsContent = document.getElementById('resultsContent');
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        const wrap = document.createElement('div');
        wrap.className = 'weather-card';
        wrap.style.borderLeftColor = '#118ab2';
        wrap.innerHTML = `
            <h4><i class="fas fa-list"></i> Daily Weather (From ${startDate} to ${endDate})</h4>
            <div class="daily-table" style="overflow:auto; max-height: 260px; border-top:1px solid #eee; margin-top:8px;">
                <table style="width:100%; border-collapse:collapse; font-size: 0.9rem;">
                    <thead>
                        <tr style="text-align:left;">
                            <th style="padding:8px; border-bottom:1px solid #eee;">Date</th>
                            <th style="padding:8px; border-bottom:1px solid #eee;">Max (°C)</th>
                            <th style="padding:8px; border-bottom:1px solid #eee;">Min (°C)</th>
                            <th style="padding:8px; border-bottom:1px solid #eee;">Precip (mm)</th>
                            <th style="padding:8px; border-bottom:1px solid #eee;">Wind (m/s)</th>
                            <th style="padding:8px; border-bottom:1px solid #eee;">Humidity (%)</th>
                        </tr>
                    </thead>
                    <tbody id="dailyRows"></tbody>
                </table>
            </div>
        `;
        resultsContent.appendChild(wrap);

        const rowsEl = wrap.querySelector('#dailyRows');
        const d = this.lastDaily;
        const toNum = (v) => {
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
        };
        d.dates.forEach(k => {
            const dateFmt = k && k.length === 8 ? `${k.slice(0,4)}-${k.slice(4,6)}-${k.slice(6,8)}` : k;
            const row = document.createElement('tr');
            const td = (val) => `<td style="padding:8px; border-bottom:1px solid #f4f4f4;">${val ?? '—'}</td>`;
            row.innerHTML = `
                ${td(dateFmt)}
                ${td(toNum(d.tMax[k])?.toFixed(1))}
                ${td(toNum(d.tMin[k])?.toFixed(1))}
                ${td(toNum(d.prcp[k])?.toFixed(1))}
                ${td(toNum(d.wind[k])?.toFixed(1))}
                ${td(toNum(d.rh[k])?.toFixed(1))}
            `;
            rowsEl.appendChild(row);
        });
    }

    // Try multiple candidate variations to geocode a place more robustly
    async geocodeWithCandidates(query) {
        const candidates = this.buildGeocodeCandidates(query);
        for (const q of candidates) {
            const loc = await this.geocodePlace(q);
            if (loc) return loc;
        }
        return null;
    }

    buildGeocodeCandidates(query) {
        const raw = (query || '').trim();
        const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
        const withoutParen = raw.replace(/\(.*?\)/g, '').trim();
        const tokens = [raw, withoutParen, parts[0] || raw];
        // De-duplicate while keeping order
        const seen = new Set();
        return tokens.filter(t => { if (!t || seen.has(t)) return false; seen.add(t); return true; });
    }

    init() {
        this.setupEventListeners();
        this.initializeMap();
        this.setDefaultDates();
        this.loadSampleData();
    }

    setMapView(lat, lng, zoom = 12) {
        try {
            if (this.map) {
                this.map.setCenter({ lat, lng });
                this.map.setZoom(zoom);
            }
        } catch (_) {}
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Location search
        document.getElementById('locationSearch').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchLocation();
        });

        const searchBtn = document.getElementById('searchLocationBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.searchLocation());
        }

        document.getElementById('useCurrentLocation').addEventListener('click', () => {
            this.getCurrentLocation();
        });

        // Date controls
        document.querySelectorAll('.btn-quick').forEach(btn => {
            btn.addEventListener('click', (e) => this.setQuickDate(e.target.dataset.range));
        });

        // Weather analysis
        document.getElementById('analyzeWeather').addEventListener('click', () => {
            this.analyzeWeather();
        });

        // Map controls
        document.getElementById('drawBoundary').addEventListener('click', () => {
            this.toggleDrawMode();
        });

        document.getElementById('clearMap').addEventListener('click', () => {
            this.clearMap();
        });

        // Export functions
        document.getElementById('exportCSV').addEventListener('click', () => {
            this.exportData('csv');
        });

        document.getElementById('exportJSON').addEventListener('click', () => {
            this.exportData('json');
        });

        // Route analysis
        document.getElementById('analyzeRoute').addEventListener('click', () => {
            this.analyzeRoute();
        });
        const startInp = document.getElementById('routeStart');
        const endInp = document.getElementById('routeEnd');
        if (startInp) startInp.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.analyzeRoute(); });
        if (endInp) endInp.addEventListener('keypress', (e) => { if (e.key === 'Enter') this.analyzeRoute(); });

        // Chat functionality
        document.getElementById('sendMessage').addEventListener('click', () => {
            this.sendChatMessage();
        });

        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChatMessage();
        });

        // Modal close
        document.querySelector('.close').addEventListener('click', () => {
            this.closeModal();
        });
    }

    switchTab(tabName) {
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tabName).classList.add('active');

        // Initialize route map if routes tab is selected
        if (tabName === 'routes' && !this.routeMap) {
            setTimeout(() => this.initializeRouteMap(), 100);
        }
    }

    initializeMap() {
        // Google Maps initialization
        this.map = new google.maps.Map(document.getElementById('map'), {
            center: { lat: 40.7128, lng: -74.0060 },
            zoom: 10,
            mapTypeId: 'roadmap',
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true
        });

        // Click to select location
        this.map.addListener('click', (e) => {
            this.selectLocation(e.latLng.lat(), e.latLng.lng());
            this.analyzeWeather();
        });

        // Drawing Manager for polygon/rectangle
        this.drawingManager = new google.maps.drawing.DrawingManager({
            drawingMode: null,
            drawingControl: false,
            polygonOptions: { editable: false, draggable: false, strokeColor: '#667eea', fillColor: '#667eea', fillOpacity: 0.15 },
            rectangleOptions: { editable: false, draggable: false, strokeColor: '#667eea', fillColor: '#667eea', fillOpacity: 0.15 }
        });
        this.drawingManager.setMap(this.map);

        // Handle new shapes
        google.maps.event.addListener(this.drawingManager, 'overlaycomplete', (e) => {
            // Clear previous
            if (this.currentDrawnLayer) this.currentDrawnLayer.setMap(null);
            this.currentDrawnLayer = e.overlay; // google.maps.Polygon or google.maps.Rectangle
            this.drawingManager.setDrawingMode(null);
            this.analyzeDrawnArea();
        });
    }

    initializeRouteMap() {
        this.routeMap = new google.maps.Map(document.getElementById('routeMap'), {
            center: { lat: 40.7128, lng: -74.0060 },
            zoom: 10,
            mapTypeId: 'roadmap',
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true
        });
    }

    selectLocation(lat, lng) {
        this.selectedLocation = { lat, lng };

        // Manage single marker
        if (this.pointMarker) {
            this.pointMarker.setMap(null);
        }
        this.pointMarker = new google.maps.Marker({ position: { lat, lng }, map: this.map });

        // Clear drawn shape
        if (this.currentDrawnLayer) {
            try { this.currentDrawnLayer.setMap(null); } catch (_) {}
            this.currentDrawnLayer = null;
        }

        // Update coordinates display
        document.getElementById('selectedCoords').textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

        // Reverse geocode to get location name
        this.reverseGeocode(lat, lng);
    }

    async reverseGeocode(lat, lng) {
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
            );
            const data = await response.json();
            
            if (data.display_name) {
                document.getElementById('locationSearch').value = data.display_name;
            }
        } catch (error) {
            console.error('Reverse geocoding failed:', error);
        }
    }

    async searchLocation() {
        const query = document.getElementById('locationSearch').value;
        if (!query) return;

        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`
            );
            const data = await response.json();
            
            if (data.length > 0) {
                const location = data[0];
                const lat = parseFloat(location.lat);
                const lng = parseFloat(location.lon);
                
                this.selectLocation(lat, lng);
                this.setMapView(lat, lng, 12);
                // Automatically analyze weather for the searched location
                this.analyzeWeather();
            } else {
                this.showAlert('Location not found', 'Please try a different search term.');
            }
        } catch (error) {
            console.error('Location search failed:', error);
            this.showAlert('Search Error', 'Unable to search for location. Please try again.');
        }
    }

    getCurrentLocation() {
        if (!navigator.geolocation) {
            this.showAlert('Geolocation Error', 'Geolocation is not supported by this browser.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                this.selectLocation(lat, lng);
                this.setMapView(lat, lng, 12);
                this.analyzeWeather();
            },
            (error) => {
                console.error('Geolocation error:', error);
                this.showAlert('Location Error', 'Unable to get your current location.');
            }
        );
    }

    setDefaultDates() {
        const today = new Date();
        const end = new Date(today);
        const start = new Date(today);
        start.setDate(today.getDate() - 30); // default to last 30 days

        document.getElementById('startDate').value = start.toISOString().split('T')[0];
        document.getElementById('endDate').value = end.toISOString().split('T')[0];
    }

    setQuickDate(days) {
        const today = new Date();
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + parseInt(days));

        document.getElementById('startDate').value = today.toISOString().split('T')[0];
        document.getElementById('endDate').value = endDate.toISOString().split('T')[0];
    }

    async analyzeWeather() {
        // If an area is drawn, prioritize area-based analysis
        if (this.currentDrawnLayer) {
            return this.analyzeDrawnArea();
        }

        if (!this.selectedLocation) {
            this.showAlert('No Location Selected', 'Please select a location on the map or search for one.');
            return;
        }

        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;

        if (!startDate || !endDate) {
            this.showAlert('Invalid Dates', 'Please select both start and end dates.');
            return;
        }

        this.showLoading(true);

        try {
            // Fetch real data from NASA POWER API and compute probabilities
            await this.fetchPowerData(this.selectedLocation.lat, this.selectedLocation.lng, startDate, endDate);
            this.displayWeatherResults();
            // Update Alerts UI for this point
            const alerts = this.buildAlertsFromAnalysis(this.weatherData);
            this.updateAlertsUI(alerts, `${this.selectedLocation.lat.toFixed(4)}, ${this.selectedLocation.lng.toFixed(4)}`);
        } catch (error) {
            console.error('Weather analysis failed:', error);
            // Do not show popup; attempt to render any available results silently
            try { this.displayWeatherResults(); } catch (_) {}
        } finally {
            this.showLoading(false);
        }
    }

    async fetchWeatherData() {
        // Legacy fallback to simulated data if POWER is unavailable
        return new Promise((resolve) => {
            setTimeout(() => {
                this.weatherData = this.generateSampleWeatherData();
                resolve(this.weatherData);
            }, 1500);
        });
    }

    // NASA POWER integration
    buildPowerUrl(lat, lon, startDate, endDate) {
        const params = new URLSearchParams({
            parameters: [
                CONFIG.POWER_PARAMS.TEMPERATURE_MAX,
                CONFIG.POWER_PARAMS.TEMPERATURE_MIN,
                CONFIG.POWER_PARAMS.PRECIPITATION,
                CONFIG.POWER_PARAMS.WIND,
                CONFIG.POWER_PARAMS.HUMIDITY
            ].join(','),
            community: CONFIG.NASA_APIS.POWER_COMMUNITY || 'RE',
            latitude: String(lat),
            longitude: String(lon),
            start: this.formatYmd(startDate),
            end: this.formatYmd(endDate),
            format: 'JSON',
            cb: Date.now().toString()
        });
        return `${CONFIG.NASA_APIS.POWER_BASE}?${params.toString()}`;
    }

    formatYmd(dateStr) {
        // Accepts 'YYYY-MM-DD' or Date, returns 'YYYYMMDD'
        if (!dateStr) return '';
        if (typeof dateStr === 'string') return dateStr.replaceAll('-', '');
        const d = dateStr;
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const da = String(d.getDate()).padStart(2, '0');
        return `${y}${m}${da}`;
    }

    async fetchPowerData(lat, lon, startDate, endDate, setGlobal = true) {
        const url = this.buildPowerUrl(lat, lon, startDate, endDate);
        try {
            const res = await fetch(url, { headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }, cache: 'no-store' });
            if (!res.ok) throw new Error(`POWER API error ${res.status}`);
            const json = await res.json();

            // Extract daily series
            const parameters = json?.properties?.parameter || {};
            const tMax = parameters[CONFIG.POWER_PARAMS.TEMPERATURE_MAX] || {};
            const tMin = parameters[CONFIG.POWER_PARAMS.TEMPERATURE_MIN] || {};
            const prcp = parameters[CONFIG.POWER_PARAMS.PRECIPITATION] || {};
            const wind = parameters[CONFIG.POWER_PARAMS.WIND] || {};
            const rh = parameters[CONFIG.POWER_PARAMS.HUMIDITY] || {};

            // Build a unified sorted list of date keys for From-To daily details
            const union = new Set([
                ...Object.keys(tMax),
                ...Object.keys(tMin),
                ...Object.keys(prcp),
                ...Object.keys(wind),
                ...Object.keys(rh)
            ]);
            const dateKeys = Array.from(union).sort();

            const series = (obj) => Object.values(obj).map(v => Number(v)).filter(v => Number.isFinite(v));

            const dataSeries = {
                tMax: series(tMax),
                tMin: series(tMin),
                prcp: series(prcp),
                wind: series(wind),
                rh: series(rh)
            };

            // Compute aggregates for From-To details
            const avg = arr => (arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length) : 0);
            const sum = arr => (arr.length ? arr.reduce((a,b)=>a+b,0) : 0);
            this.lastAggregates = {
                tMaxAvg: avg(dataSeries.tMax),
                tMinAvg: avg(dataSeries.tMin),
                prcpTotal: sum(dataSeries.prcp),
                windAvg: avg(dataSeries.wind),
                rhAvg: avg(dataSeries.rh)
            };
            this.lastSeries = { dates: dateKeys, data: dataSeries };
            this.lastDaily = { dates: dateKeys, tMax, tMin, prcp, wind, rh };

            // Fetch localized air quality from OpenAQ (best-effort)
            const air = await this.fetchAirQuality(lat, lon);

            // Compute probabilities against thresholds
            const computed = this.computeProbabilitiesFromPower(dataSeries, air);
            if (setGlobal) this.weatherData = computed;
            this.lastDataSource = 'POWER';
            return computed;
        } catch (e) {
            console.error('POWER fetch failed, falling back to sample data:', e);
            const fallback = this.generateSampleWeatherData();
            if (setGlobal) this.weatherData = fallback;
            this.lastDataSource = 'FALLBACK';
            return fallback;
        }
    }

    computeProbabilitiesFromPower(ds, airQualityData = null) {
        const out = {};

        // Temperature extremes: very hot by T2M_MAX, very cold by T2M_MIN
        if (document.getElementById('temperature')?.checked) {
            const hotProb = NASA_API.calculateProbability(ds.tMax, CONFIG.DATA_PARAMS.TEMPERATURE_EXTREMES.VERY_HOT, 'above');
            const coldProb = NASA_API.calculateProbability(ds.tMin, CONFIG.DATA_PARAMS.TEMPERATURE_EXTREMES.VERY_COLD, 'below');
            const prob = Math.max(hotProb, coldProb);
            out.temperature = {
                probability: prob,
                risk: this.calculateRiskLevel(prob),
                trend: this.generateTrendData(),
                recommendations: this.getRecommendations('temperature')
            };
        }

        // Precipitation: heavy precip days
        if (document.getElementById('precipitation')?.checked) {
            const prob = NASA_API.calculateProbability(ds.prcp, CONFIG.DATA_PARAMS.PRECIPITATION_LEVELS.HEAVY, 'above');
            out.precipitation = {
                probability: prob,
                risk: this.calculateRiskLevel(prob),
                trend: this.generateTrendData(),
                recommendations: this.getRecommendations('precipitation')
            };
        }

        // Wind: strong winds
        if (document.getElementById('wind')?.checked) {
            const prob = NASA_API.calculateProbability(ds.wind, CONFIG.DATA_PARAMS.WIND_LEVELS.STRONG, 'above');
            out.wind = {
                probability: prob,
                risk: this.calculateRiskLevel(prob),
                trend: this.generateTrendData(),
                recommendations: this.getRecommendations('wind')
            };
        }

        // Humidity: very high humidity
        if (document.getElementById('humidity')?.checked) {
            const prob = NASA_API.calculateProbability(ds.rh, CONFIG.DATA_PARAMS.HUMIDITY_LEVELS.VERY_HIGH, 'above');
            out.humidity = {
                probability: prob,
                risk: this.calculateRiskLevel(prob),
                trend: this.generateTrendData(),
                recommendations: this.getRecommendations('humidity')
            };
        }

        // Air Quality via OpenAQ (best-effort approximation)
        if (document.getElementById('airQuality')?.checked) {
            const aqProb = this.computeAirQualityProbability(airQualityData);
            out.airQuality = {
                probability: aqProb,
                risk: this.calculateRiskLevel(aqProb),
                trend: this.generateTrendData(),
                recommendations: this.getRecommendations('airQuality')
            };
        }

        return out;
    }

    async analyzeDrawnArea() {
        if (!this.currentDrawnLayer) return;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        this.showLoading(true);
        this.updateRouteSummary('');
        // Clear point-specific details when analyzing an area
        this.lastSeries = null;
        this.lastAggregates = null;
        this.lastDaily = null;
        try {
            const samplePts = this.getSamplePointsFromLayer(this.currentDrawnLayer, 3);
            const results = await Promise.all(samplePts.map(pt => this.fetchPowerData(pt.lat, pt.lng, startDate, endDate, false)));
            const keys = ['temperature', 'precipitation', 'wind', 'humidity', 'airQuality'];
            const aggregated = {};
            keys.forEach(k => {
                const vals = results.map(r => r[k]?.probability).filter(v => typeof v === 'number' && !Number.isNaN(v));
                if (vals.length) {
                    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
                    aggregated[k] = { probability: avg, risk: this.calculateRiskLevel(avg), trend: this.generateTrendData(), recommendations: this.getRecommendations(k) };
                }
            });
            this.weatherData = aggregated;
            this.displayWeatherResults();
            const alerts = this.buildAlertsFromAnalysis(this.weatherData);
            this.updateAlertsUI(alerts, 'Selected Area');
        } catch (err) {
            console.error('Area analysis failed:', err);
            try { this.displayWeatherResults(); } catch (_) {}
        } finally {
            this.showLoading(false);
        }
    }

    getSamplePointsFromLayer(layer, gridSize = 3) {
        const points = [];
        if (layer instanceof google.maps.Rectangle) {
            const b = layer.getBounds();
            const south = b.getSouthWest().lat();
            const west = b.getSouthWest().lng();
            const north = b.getNorthEast().lat();
            const east = b.getNorthEast().lng();
            const latStep = (north - south) / (gridSize + 1);
            const lngStep = (east - west) / (gridSize + 1);
            for (let i = 1; i <= gridSize; i++) {
                for (let j = 1; j <= gridSize; j++) {
                    points.push({ lat: south + latStep * i, lng: west + lngStep * j });
                }
            }
            return points;
        }
        if (layer instanceof google.maps.Polygon) {
            const path = layer.getPath();
            const bounds = new google.maps.LatLngBounds();
            for (let i = 0; i < path.getLength(); i++) bounds.extend(path.getAt(i));
            const south = bounds.getSouthWest().lat();
            const west = bounds.getSouthWest().lng();
            const north = bounds.getNorthEast().lat();
            const east = bounds.getNorthEast().lng();
            const latStep = (north - south) / (gridSize + 1);
            const lngStep = (east - west) / (gridSize + 1);
            for (let i = 1; i <= gridSize; i++) {
                for (let j = 1; j <= gridSize; j++) {
                    const lat = south + latStep * i;
                    const lng = west + lngStep * j;
                    try {
                        if (google.maps.geometry && google.maps.geometry.poly && google.maps.geometry.poly.containsLocation) {
                            const inside = google.maps.geometry.poly.containsLocation(new google.maps.LatLng(lat, lng), layer);
                            if (inside) points.push({ lat, lng });
                        } else {
                            points.push({ lat, lng });
                        }
                    } catch (_) {
                        points.push({ lat, lng });
                    }
                }
            }
            return points;
        }
        return points;
    }

    async fetchAirQuality(lat, lon) {
        try {
            const url = `https://api.openaq.org/v2/latest?coordinates=${lat},${lon}&radius=25000&limit=1&parameter=pm25,pm10,o3,no2&order_by=distance&cb=${Date.now()}`;
            const res = await fetch(url, { headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }, cache: 'no-store' });
            if (!res.ok) throw new Error('OpenAQ error');
            const json = await res.json();
            const m = json?.results?.[0]?.measurements || [];
            const pm25 = m.find(x => x.parameter === 'pm25');
            const pm10 = m.find(x => x.parameter === 'pm10');
            const o3 = m.find(x => x.parameter === 'o3');
            const no2 = m.find(x => x.parameter === 'no2');
            return { pm25: pm25?.value, pm10: pm10?.value, o3: o3?.value, no2: no2?.value };
        } catch (e) {
            console.warn('Air quality fetch failed', e);
            return null;
        }
    }

    computeAirQualityProbability(aq) {
        if (!aq) return 0;
        // Simple heuristic based on PM2.5 concentration
        const pm25 = aq.pm25;
        if (typeof pm25 !== 'number') return 0;
        // Map PM2.5 ug/m3 to a 0-100 probability (heuristic)
        // 0 ug/m3 -> 0%, 100 ug/m3 -> 100%
        return Math.max(0, Math.min(100, (pm25 / 100) * 100));
    }

    generateSampleWeatherData() {
        const conditions = ['temperature', 'precipitation', 'wind', 'humidity', 'airQuality'];
        const data = {};

        conditions.forEach(condition => {
            if (document.getElementById(condition).checked) {
                data[condition] = {
                    probability: Math.random() * 100,
                    risk: this.calculateRiskLevel(Math.random() * 100),
                    trend: this.generateTrendData(),
                    recommendations: this.getRecommendations(condition)
                };
            }
        });

        return data;
    }

    calculateRiskLevel(probability) {
        if (probability < 30) return 'low';
        if (probability < 70) return 'medium';
        return 'high';
    }

    generateTrendData() {
        const data = [];
        for (let i = 0; i < 30; i++) {
            data.push({
                date: new Date(Date.now() + i * 24 * 60 * 60 * 1000),
                value: Math.random() * 100
            });
        }
        return data;
    }

    getRecommendations(condition) {
        const recommendations = {
            temperature: ['Bring sunscreen', 'Stay hydrated', 'Wear light clothing'],
            precipitation: ['Carry an umbrella', 'Wear waterproof clothing', 'Plan indoor alternatives'],
            wind: ['Secure loose items', 'Avoid high structures', 'Check wind warnings'],
            humidity: ['Stay in air-conditioned areas', 'Drink plenty of water', 'Take breaks'],
            airQuality: ['Wear a mask if sensitive', 'Limit outdoor activities', 'Check air quality index']
        };
        
        return recommendations[condition] || [];
    }

    displayWeatherResults() {
        const resultsContent = document.getElementById('resultsContent');
        resultsContent.innerHTML = '';

        // Add context header: show location/date and data source
        const meta = document.createElement('div');
        meta.className = 'analysis-meta';
        const loc = this.selectedLocation ? `${this.selectedLocation.lat.toFixed(4)}, ${this.selectedLocation.lng.toFixed(4)}` : (this.currentDrawnLayer ? 'Selected Area' : 'N/A');
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        meta.innerHTML = `
            <div style="margin-bottom: 0.75rem; color: #666; font-size: 0.9rem;">
                <strong>Analyzed:</strong> ${loc} &nbsp;|&nbsp; <strong>Dates:</strong> ${startDate} to ${endDate} &nbsp;|&nbsp; <strong>Source:</strong> ${this.lastDataSource}
            </div>
        `;
        resultsContent.appendChild(meta);

        if (!this.weatherData || Object.keys(this.weatherData).length === 0) {
            resultsContent.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>No data available for the selected conditions</p>
                </div>
            `;
            return;
        }

        Object.entries(this.weatherData).forEach(([condition, data]) => {
            const card = this.createWeatherCard(condition, data);
            resultsContent.appendChild(card);
        });

        // Create summary chart
        this.createSummaryChart();

        // Append From-To weather details (point analysis only)
        try { this.displayWeatherDetails(); } catch (_) {}

        // Append per-day breakdown between From and To (point analysis only)
        try { this.displayWeatherDailyBreakdown(); } catch (_) {}

        // Show a visible warning if fallback data was used
        if (this.lastDataSource === 'FALLBACK') {
            const warn = document.createElement('div');
            warn.className = 'weather-card';
            warn.style.borderLeftColor = '#dc3545';
            warn.innerHTML = `
                <h4><i class="fas fa-triangle-exclamation"></i> Using Sample Data</h4>
                <p>Live data could not be retrieved from NASA POWER / OpenAQ. Results are simulated and may look similar across locations. Please ensure you're running via a local server and have network access.</p>
            `;
            resultsContent.appendChild(warn);
        }
    }

    createWeatherCard(condition, data) {
        const card = document.createElement('div');
        card.className = 'weather-card';
        
        const conditionNames = {
            temperature: 'Temperature Extremes',
            precipitation: 'Precipitation',
            wind: 'Wind Speed',
            humidity: 'Humidity',
            airQuality: 'Air Quality'
        };

        const icons = {
            temperature: 'fas fa-thermometer-half',
            precipitation: 'fas fa-cloud-rain',
            wind: 'fas fa-wind',
            humidity: 'fas fa-tint',
            airQuality: 'fas fa-smog'
        };

        card.innerHTML = `
            <h4>
                <i class="${icons[condition]}"></i>
                ${conditionNames[condition]}
                <span class="alert-badge alert-${data.risk}">${data.risk} risk</span>
            </h4>
            <div class="probability-display">
                <p>Probability of extreme conditions: <strong>${data.probability.toFixed(1)}%</strong></p>
                <div class="probability-bar">
                    <div class="probability-fill" style="width: ${data.probability}%"></div>
                </div>
            </div>
            <div class="recommendations">
                <h5>Recommendations:</h5>
                <ul>
                    ${data.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        `;

        return card;
    }

    createSummaryChart() {
        const ctx = document.createElement('canvas');
        ctx.id = 'summaryChart';
        ctx.style.marginTop = '2rem';
        
        const resultsContent = document.getElementById('resultsContent');
        resultsContent.appendChild(ctx);

        const labels = Object.keys(this.weatherData);
        const probabilities = Object.values(this.weatherData).map(data => data.probability);

        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.map(label => label.charAt(0).toUpperCase() + label.slice(1)),
                datasets: [{
                    label: 'Risk Probability (%)',
                    data: probabilities,
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(118, 75, 162, 0.8)',
                        'rgba(255, 193, 7, 0.8)',
                        'rgba(40, 167, 69, 0.8)',
                        'rgba(220, 53, 69, 0.8)'
                    ],
                    borderColor: [
                        'rgb(102, 126, 234)',
                        'rgb(118, 75, 162)',
                        'rgb(255, 193, 7)',
                        'rgb(40, 167, 69)',
                        'rgb(220, 53, 69)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    title: {
                        display: true,
                        text: 'Weather Risk Summary'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                }
            }
        });
    }

    toggleDrawMode() {
        if (!this.drawingManager) return;
        // Start rectangle drawing immediately (similar to previous UX)
        this.drawingManager.setDrawingMode(google.maps.drawing.OverlayType.RECTANGLE);
    }

    clearMap() {
        if (this.pointMarker) { try { this.pointMarker.setMap(null); } catch (_) {} this.pointMarker = null; }
        if (this.currentDrawnLayer) { try { this.currentDrawnLayer.setMap(null); } catch (_) {} this.currentDrawnLayer = null; }
        this.selectedLocation = null;
        document.getElementById('selectedCoords').textContent = 'No location selected';
        document.getElementById('locationSearch').value = '';
    }

    exportData(format) {
        if (!this.weatherData) {
            this.showAlert('No Data', 'Please analyze weather data first.');
            return;
        }

        const exportData = {
            location: this.selectedLocation,
            timestamp: new Date().toISOString(),
            analysis: this.weatherData
        };

        if (format === 'csv') {
            this.downloadCSV(exportData);
        } else if (format === 'json') {
            this.downloadJSON(exportData);
        }
    }

    downloadCSV(data) {
        const csv = this.convertToCSV(data);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `weather-analysis-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    downloadJSON(data) {
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `weather-analysis-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    convertToCSV(data) {
        const headers = ['Condition', 'Probability', 'Risk Level', 'Recommendations'];
        const rows = [headers.join(',')];

        Object.entries(data.analysis).forEach(([condition, info]) => {
            const row = [
                condition,
                info.probability.toFixed(1),
                info.risk,
                `"${info.recommendations.join('; ')}"`
            ];
            rows.push(row.join(','));
        });

        return rows.join('\n');
    }

    async analyzeRoute() {
        const startText = document.getElementById('routeStart').value.trim();
        const endText = document.getElementById('routeEnd').value.trim();

        if (!startText || !endText) {
            this.showAlert('Missing Route Information', 'Please enter both starting point and destination.');
            return;
        }

        // Ensure route map exists (Routes tab)
        if (!this.routeMap) {
            this.initializeRouteMap();
        }

        this.showLoading(true);
        try {
            const [start, end] = await Promise.all([
                this.geocodeWithCandidates(startText),
                this.geocodeWithCandidates(endText)
            ]);

            if (!start || !end) {
                // Try swapping common artifacts (auto-correct)
                const startAlt = await this.geocodeWithCandidates(startText.replace(/\(.*?\)/g, '').split(',')[0]);
                const endAlt = await this.geocodeWithCandidates(endText.replace(/\(.*?\)/g, '').split(',')[0]);
                if (!startAlt || !endAlt) {
                    this.showAlert('Geocoding Error', 'Could not find one or both locations. Please refine your input.');
                    return;
                }
                if (!start) start = startAlt;
                if (!end) end = endAlt;
            }

            // Fetch route from OSRM (with steps for richer analysis). If it fails, fall back to Google Directions API
            let routeGeoJSON;
            try {
                routeGeoJSON = await this.fetchRouteGeoJSON(start, end);
            } catch (osrmErr) {
                console.warn('OSRM failed, trying Google Directions fallback...', osrmErr);
                routeGeoJSON = await this.fetchRouteViaGoogle(start, end);
            }

            // Clear previous route
            this.clearRoute();

            // Add route polyline
            const path = routeGeoJSON.geometry.coordinates.map(([lng, lat]) => ({ lat, lng }));
            this.routeLayer = new google.maps.Polyline({ path, strokeColor: '#1e88e5', strokeOpacity: 0.9, strokeWeight: 5 });
            this.routeLayer.setMap(this.routeMap);

            // Add start/end markers
            const startMarker = new google.maps.Marker({ position: { lat: start.lat, lng: start.lon }, map: this.routeMap, title: 'Start' });
            const endMarker = new google.maps.Marker({ position: { lat: end.lat, lng: end.lon }, map: this.routeMap, title: 'Destination' });
            this.routeMarkers.push(startMarker, endMarker);

            // Fit map to route
            const bounds = new google.maps.LatLngBounds();
            path.forEach(p => bounds.extend(p));
            bounds.extend({ lat: start.lat, lng: start.lon });
            bounds.extend({ lat: end.lat, lng: end.lon });
            this.routeMap.fitBounds(bounds,  { padding: 30 });

            // Show distance and duration summary with date range
            const dist = routeGeoJSON.properties?.distance || 0; // meters
            const dur = routeGeoJSON.properties?.duration || 0; // seconds
            const rs = document.getElementById('startDate')?.value || '';
            const re = document.getElementById('endDate')?.value || '';
            const rangeLine = (rs && re) ? ` <span style="color:#666; font-size:0.9rem;">(From ${rs} to ${re})</span>` : '';
            this.updateRouteSummary(`Distance: <strong>${this.formatDistance(dist)}</strong> · Time: <strong>${this.formatDuration(dur)}</strong>${rangeLine}`);

            // Analyze weather along the route and render step-by-step summary
            const stepsHtml = await this.analyzeRouteWeather(routeGeoJSON);
            if (stepsHtml) {
                const rs2 = document.getElementById('startDate')?.value || '';
                const re2 = document.getElementById('endDate')?.value || '';
                const rangeLine2 = (rs2 && re2) ? ` <span style=\"color:#666; font-size:0.9rem;\">(From ${rs2} to ${re2})</span>` : '';
                this.updateRouteSummary(`Distance: <strong>${this.formatDistance(dist)}</strong> · Time: <strong>${this.formatDuration(dur)}</strong>${rangeLine2}<div style="margin-top:10px;">${stepsHtml}</div>`);
            }

            // Optional: also show the same route on the main map when dashboard tab is active
            // (Commented out to adhere to single-map in the Routes tab)
            // if (this.map) {
            //     // You could mirror the route on the main map here if desired
            // }
        } catch (err) {
            console.error('Route analysis failed:', err);
            this.showAlert('Route Error', 'Unable to fetch and display the route. Please try again.');
            this.updateRouteSummary('<span style="color:#dc3545">Failed to fetch route. Please try different inputs or try again.</span>');
        } finally {
            this.showLoading(false);
        }
    }

    async geocodePlace(query) {
        const text = (query || '').trim();
        // 1) Accept raw coordinates like "12.34, 56.78" or "12.34 56.78"
        const coord = this.tryParseCoordinates(text);
        if (coord) return coord;

        // 2) Try OpenStreetMap Nominatim (up to 3 candidates)
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(text)}&limit=3&addressdetails=0&accept-language=en&cb=${Date.now()}`;
            const res = await fetch(url, { headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }, cache: 'no-store' });
            if (res.ok) {
                const arr = await res.json();
                if (Array.isArray(arr) && arr.length) {
                    // Prefer results with higher importance if available
                    const best = arr.sort((a,b) => (b.importance||0) - (a.importance||0))[0];
                    return { lat: parseFloat(best.lat), lon: parseFloat(best.lon) };
                }
            }
        } catch (e) {
            console.warn('Nominatim geocode error:', e);
        }

        // 3) Try Photon (Komoot) as a fallback provider
        try {
            const url2 = `https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&limit=1&lang=en&cb=${Date.now()}`;
            const res2 = await fetch(url2, { headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }, cache: 'no-store' });
            if (res2.ok) {
                const json = await res2.json();
                const feat = json && json.features && json.features[0];
                if (feat && feat.geometry && Array.isArray(feat.geometry.coordinates)) {
                    const [lon, lat] = feat.geometry.coordinates;
                    return { lat: parseFloat(lat), lon: parseFloat(lon) };
                }
            }
        } catch (e) {
            console.warn('Photon geocode error:', e);
        }

        return null;
    }

    tryParseCoordinates(text) {
        // Matches: "lat, lon" or "lat lon" (decimal degrees)
        const m = text.match(/^\s*([+-]?\d+(?:\.\d+)?)\s*[ ,]\s*([+-]?\d+(?:\.\d+)?)\s*$/);
        if (!m) return null;
        const lat = parseFloat(m[1]);
        const lon = parseFloat(m[2]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
        return { lat, lon };
    }

    async fetchRouteGeoJSON(start, end) {
        const base = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson&alternatives=false&steps=true&annotations=false`;
        const url = `${base}&cb=${Date.now()}`;

        // Retry logic to reduce transient failures
        const maxAttempts = 3;
        let lastError = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const res = await fetch(url, { headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }, cache: 'no-store' });
                if (!res.ok) throw new Error(`OSRM error ${res.status}`);
                const json = await res.json();
                if (!json || !json.routes || !json.routes.length) throw new Error('No route found');
                const r = json.routes[0];
                return {
                    type: 'Feature',
                    geometry: r.geometry,
                    properties: { distance: r.distance, duration: r.duration, steps: (r.legs && r.legs[0] && r.legs[0].steps) ? r.legs[0].steps : [] }
                };
            } catch (e) {
                lastError = e;
                await new Promise(r => setTimeout(r, 300 * attempt));
            }
        }
        throw lastError || new Error('Route fetch failed');
    }

    async fetchRouteViaGoogle(start, end) {
        // Use Google Maps DirectionsService as a fallback and convert to our GeoJSON-like structure
        return new Promise((resolve, reject) => {
            try {
                const svc = new google.maps.DirectionsService();
                svc.route({
                    origin: { lat: start.lat, lng: start.lon },
                    destination: { lat: end.lat, lng: end.lon },
                    travelMode: google.maps.TravelMode.DRIVING,
                    provideRouteAlternatives: false,
                }, (result, status) => {
                    if (status !== google.maps.DirectionsStatus.OK || !result || !result.routes || !result.routes.length) {
                        reject(new Error('Google Directions failed'));
                        return;
                    }
                    const r = result.routes[0];
                    const overview = r.overview_path || [];
                    const coords = overview.map(ll => [ll.lng(), ll.lat()]);
                    // Sum distance/duration across legs
                    let distance = 0, duration = 0;
                    (r.legs || []).forEach(leg => {
                        distance += (leg.distance && leg.distance.value) ? leg.distance.value : 0;
                        duration += (leg.duration && leg.duration.value) ? leg.duration.value : 0;
                    });
                    // Build simple steps from first leg
                    const steps = [];
                    if (r.legs && r.legs[0] && Array.isArray(r.legs[0].steps)) {
                        r.legs[0].steps.forEach(st => {
                            const path = st.path || [];
                            const sCoords = path.map(ll => [ll.lng(), ll.lat()]);
                            steps.push({ geometry: { coordinates: sCoords } });
                        });
                    }
                    resolve({
                        type: 'Feature',
                        geometry: { type: 'LineString', coordinates: coords },
                        properties: { distance, duration, steps }
                    });
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    updateRouteSummary(html) {
        const el = document.getElementById('routeSummary');
        if (el) {
            el.innerHTML = html || '';
            // Attach chips inside route summary as well
            this.attachAltChipHandlers(el);
        }
    }

    attachAltChipHandlers(rootEl = document) {
        rootEl.querySelectorAll('.alt-chip').forEach(chip => {
            if (chip.__wi_bound) return; // avoid duplicate binding
            chip.__wi_bound = true;
            chip.addEventListener('click', async () => {
                const lat = parseFloat(chip.getAttribute('data-lat'));
                const lng = parseFloat(chip.getAttribute('data-lng'));
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                this.addChatMessage(`Jumping to ${lat.toFixed(3)}, ${lng.toFixed(3)} and re-analyzing...`, 'bot');
                this.selectLocation(lat, lng);
                this.setMapView(lat, lng, 12);
                await this.analyzeWeather();
            });
        });
    }

    async analyzeRouteWeather(routeFeature) {
        try {
            const steps = Array.isArray(routeFeature?.properties?.steps) ? routeFeature.properties.steps : [];
            const coords = Array.isArray(routeFeature?.geometry?.coordinates) ? routeFeature.geometry.coordinates : [];
            // Build sample points: prefer step geometry midpoints; fallback to evenly spaced along full path
            const samples = [];
            if (steps.length) {
                steps.forEach((st) => {
                    const g = st?.geometry?.coordinates;
                    if (Array.isArray(g) && g.length) {
                        const mid = g[Math.floor(g.length / 2)];
                        samples.push({ lat: mid[1], lng: mid[0] });
                    }
                });
            }
            if (!samples.length && coords.length) {
                const n = Math.min(8, Math.max(3, Math.floor(coords.length / 10)));
                for (let i = 1; i <= n; i++) {
                    const idx = Math.floor((i / (n + 1)) * (coords.length - 1));
                    const c = coords[idx];
                    samples.push({ lat: c[1], lng: c[0] });
                }
            }
            if (!samples.length) return '';

            // For each sample, compute weather probabilities and suggest one safer alternative nearby
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;

            const analyses = await Promise.all(samples.map(async (p) => {
                const data = await this.fetchPowerData(p.lat, p.lng, startDate, endDate, false);
                const name = await this.reverseGeocodeName(p.lat, p.lng);
                // Find one safer alternative near this point
                const altOffsets = [ { dlat: 0.1, dlng: 0 }, { dlat: -0.1, dlng: 0 }, { dlat: 0, dlng: 0.1 }, { dlat: 0, dlng: -0.1 } ];
                let bestAlt = null;
                for (const o of altOffsets) {
                    const altLat = p.lat + o.dlat, altLng = p.lng + o.dlng;
                    try {
                        const altData = await this.fetchPowerData(altLat, altLng, startDate, endDate, false);
                        const risk = this.computeOverallRisk(altData);
                        if (!bestAlt || risk < bestAlt.risk) {
                            const label = await this.reverseGeocodeName(altLat, altLng);
                            bestAlt = { lat: altLat, lng: altLng, label: label || `${altLat.toFixed(3)}, ${altLng.toFixed(3)}`, risk };
                        }
                    } catch (_) {}
                }
                return { p, name: name || `${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}`, data, alt: bestAlt };
            }));

            // Render HTML list
            const html = analyses.map((a, idx) => {
                const badges = this.buildInlineBadges(a.data);
                const spark = this.buildSparklineFromAnalysis(a.data);
                const altChip = a.alt ? `<button class="alt-chip" data-lat="${a.alt.lat}" data-lng="${a.alt.lng}" title="Jump to safer alternative" style="margin:4px 0; padding:4px 8px; border-radius:999px; border:1px solid #e0e0e0; background:#eef6ff; cursor:pointer; font-size:12px;">Safer nearby: ${a.alt.label} · ${a.alt.risk.toFixed(1)}%</button>` : '';
                return `
                    <div class="route-step-card" style="padding:10px; margin-bottom:8px; border-radius:8px; background:#fff; border:1px solid #eee; box-shadow:0 1px 2px rgba(0,0,0,0.03);">
                        <div style="font-weight:600; margin-bottom:4px;">Segment ${idx + 1}: ${a.name}</div>
                        <div>${badges}</div>
                        ${spark ? `<div style="margin-top:6px;">${spark}</div>` : ''}
                        ${altChip}
                    </div>
                `;
            }).join('');
            return `<div class="route-steps">${html}</div>`;
        } catch (e) {
            console.warn('Route weather analysis failed', e);
            return '';
        }
    }

    formatDistance(meters) {
        if (!meters || meters <= 0) return '0 m';
        if (meters < 1000) return `${Math.round(meters)} m`;
        const km = meters / 1000;
        return `${km.toFixed(km < 10 ? 1 : 0)} km`;
    }

    formatDuration(seconds) {
        if (!seconds || seconds <= 0) return '0 min';
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.round((seconds % 3600) / 60);
        if (hrs > 0) return `${hrs} hr ${mins} min`;
        return `${mins} min`;
    }

    clearRoute() {
        if (this.routeLayer) {
            try { this.routeLayer.setMap(null); } catch (_) {}
            this.routeLayer = null;
        }
        this.routeMarkers.forEach(m => {
            try { m.setMap(null); } catch (_) {}
        });
        this.routeMarkers = [];
    }

    sendChatMessage() {
        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message) return;

        this.addChatMessage(message, 'user');
        input.value = '';

        // Bot response (can trigger actions based on prompt)
        setTimeout(async () => {
            const response = await this.generateBotResponse(message);
            this.addChatMessage(response, 'bot');
        }, 500);
    }

    addChatMessage(message, sender) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        messageDiv.innerHTML = `
            <div class="message-content">
                <p>${message}</p>
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Attach chip handlers for alternative suggestions, scoped to this message only
        messageDiv.querySelectorAll('.alt-chip').forEach(chip => {
            chip.addEventListener('click', async (e) => {
                const lat = parseFloat(chip.getAttribute('data-lat'));
                const lng = parseFloat(chip.getAttribute('data-lng'));
                if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
                this.addChatMessage(`Jumping to ${lat.toFixed(3)}, ${lng.toFixed(3)} and re-analyzing...`, 'bot');
                this.selectLocation(lat, lng);
                this.setMapView(lat, lng, 12);
                await this.analyzeWeather();
            });
        });
    }

    async generateBotResponse(userMessage) {
        const text = userMessage.trim();
        const intent = this.parseIntent(text);

        // Analyze a requested place first if provided
        if (intent.place) {
            const loc = await this.geocodePlace(intent.place);
            if (loc) {
                this.selectLocation(loc.lat, loc.lon);
                this.setMapView(loc.lat, loc.lon, 12);
                await this.analyzeWeather();
            } else {
                return `I couldn’t find "${intent.place}". Please try a more specific place name (city, region, country) or coordinates like "48.8566, 2.3522".`;
            }
        } else if (!this.weatherData || !Object.keys(this.weatherData).length) {
            // If no analysis yet, try analyzing current selection
            if (this.selectedLocation) {
                await this.analyzeWeather();
            } else {
                return "Hello! I’m your Weather Assistant. Select a location on the map, use 'Use current location', or ask me to analyze a place (e.g., 'Analyze Paris').";
            }
        }

        // At this point, we should have analysis
        const analysis = this.weatherData || {};

        // Condition-specific Q&A
        if (intent.condition) {
            const key = intent.condition;
            const info = analysis[key];
            if (!info) {
                return `I don’t have ${this.formatConditionName(key)} enabled or available in the current analysis. Please make sure it’s selected and try analyzing again.`;
            }
            const line = `${this.formatConditionName(key)} probability is ${info.probability.toFixed(1)}% (${info.risk} risk).`;
            const recs = info.recommendations && info.recommendations.length ? ` Recommendations: ${info.recommendations.slice(0,3).join('; ')}.` : '';
            return `${line}${recs}`;
        }

        // Safer/better alternatives
        if (intent.askAlternatives) {
            const alts = await this.findSaferAlternatives();
            if (alts && alts.length) {
                const chips = alts.slice(0, 4).map(a => {
                    const name = a.label || a.coords;
                    return `<button class="alt-chip" data-lat="${a.lat}" data-lng="${a.lng}" title="${a.coords}" style="margin:4px; padding:6px 10px; border-radius:999px; border:1px solid #e0e0e0; background:#f8f9fa; cursor:pointer; font-size:12px;">${name} · ${a.riskScore.toFixed(1)}%</button>`;
                }).join('');
                const badges = this.buildInlineBadges(analysis);
                return `Here are nearby lower-risk alternatives based on overall probability:<br>${chips}<br><div style="margin-top:6px;">${badges}</div>`;
            }
            return 'I couldn’t find safer nearby alternatives at the moment.';
        }

        // Alerts overview
        if (intent.askAlerts) {
            const alerts = this.buildAlertsFromAnalysis(analysis);
            if (!alerts.length) return 'No Active Alerts.';
            const lines = alerts.slice(0, 5).map(a => `${a.title}: ${a.probability}% (${a.severity})`).join('\n');
            return `Active Alerts:\n${lines}`;
        }

        // Default: provide concise summary tailored to current selection
        const summary = this.buildAnalysisSummary(analysis);
        const badges = this.buildInlineBadges(analysis);
        const spark = this.buildSparklineFromAnalysis(analysis);
        return `Here’s a tailored summary for your current selection:<br><pre style="margin:6px 0;">${summary}</pre><div>${badges}</div>${spark ? `<div style=\"margin-top:6px;\">${spark}</div>` : ''}<div style="margin-top:6px; font-size:12px; color:#666;">Ask about a specific condition (e.g., "wind?", "precipitation?"), request safer alternatives, or analyze a place (e.g., "Analyze Tokyo").</div>`;
    }

    parseIntent(text) {
        const lower = text.toLowerCase();
        const out = { place: null, condition: null, askAlternatives: false, askAlerts: false };

        // Extract place phrases
        const placeRe = /(?:analyze|weather\s+in|forecast\s+for|analyser?|analyse)\s+(.+)/i;
        const m = lower.match(placeRe);
        if (m && m[1]) out.place = m[1].trim();

        // Detect condition questions
        const conditionMap = {
            temperature: /(temp|temperature|hot|cold|heat|freeze|freezing)/i,
            precipitation: /(rain|precip|precipitation|downpour|storm)/i,
            wind: /(wind|windy|gale|gust)/i,
            humidity: /(humidity|humid|moist)/i,
            airQuality: /(air\s*quality|aqi|pm2?\.5|smog)/i
        };
        for (const [key, re] of Object.entries(conditionMap)) {
            if (re.test(text)) { out.condition = key; break; }
        }

        // Alternatives / safer places
        out.askAlternatives = /(alternative|safer|better|nearby)/i.test(lower);

        // Alerts overview
        out.askAlerts = /(alert|alerts|warnings?)/i.test(lower);

        return out;
    }

    buildAnalysisSummary(analysis) {
        const entries = Object.entries(analysis).filter(([_, v]) => v && typeof v.probability === 'number');
        if (!entries.length) return 'No analysis data available yet.';
        // Sort by probability desc
        const sorted = entries.sort((a, b) => b[1].probability - a[1].probability);
        const top = sorted.slice(0, 3).map(([k, v]) => `- ${this.formatConditionName(k)}: ${v.probability.toFixed(1)}% (${v.risk} risk)`);
        const recs = Array.from(new Set(sorted.flatMap(([k, v]) => (v.recommendations || []).slice(0, 2)))).slice(0, 5);
        return `${top.join('\n')}\nRecommendations: ${recs.length ? recs.join('; ') : 'N/A'}`;
    }

    buildInlineBadges(analysis) {
        const color = (risk) => risk === 'high' ? '#dc3545' : (risk === 'medium' ? '#fd7e14' : '#28a745');
        const items = Object.entries(analysis).filter(([_, v]) => v && typeof v.probability === 'number');
        if (!items.length) return '';
        return items.slice(0, 5).map(([k, v]) => {
            const bg = color(v.risk);
            const name = this.formatConditionName(k);
            return `<span style="display:inline-block; margin:3px 4px 0 0; padding:2px 8px; border-radius:999px; font-size:12px; color:#fff; background:${bg};">${name}: ${v.probability.toFixed(0)}%</span>`;
        }).join('');
    }

    buildSparklineFromAnalysis(analysis) {
        // Use the trend of the highest-probability condition (if available)
        const entries = Object.entries(analysis).filter(([_, v]) => v && typeof v.probability === 'number' && Array.isArray(v.trend) && v.trend.length);
        if (!entries.length) return '';
        const [_, best] = entries.sort((a, b) => b[1].probability - a[1].probability)[0];
        const vals = best.trend.map(t => typeof t.value === 'number' ? t.value : 0);
        if (!vals.length) return '';
        // Normalize values 0-100
        const max = Math.max(...vals, 1), min = Math.min(...vals, 0);
        const w = 140, h = 30, pad = 2;
        const stepX = (w - pad * 2) / (vals.length - 1);
        const points = vals.map((v, i) => {
            const y = h - pad - ((v - min) / (max - min)) * (h - pad * 2);
            const x = pad + i * stepX;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        }).join(' ');
        const color = best.risk === 'high' ? '#dc3545' : (best.risk === 'medium' ? '#fd7e14' : '#28a745');
        return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline fill="none" stroke="${color}" stroke-width="2" points="${points}" /></svg>`;
    }

    formatConditionName(key) {
        const map = { temperature: 'Temperature Extremes', precipitation: 'Precipitation', wind: 'Wind Speed', humidity: 'Humidity', airQuality: 'Air Quality' };
        return map[key] || key;
    }

    computeOverallRisk(analysis) {
        const vals = Object.values(analysis).map(v => v && typeof v.probability === 'number' ? v.probability : null).filter(v => v !== null);
        if (!vals.length) return 0;
        return vals.reduce((a, b) => a + b, 0) / vals.length;
    }

    async findSaferAlternatives() {
        // Sample a few nearby points (≈ ~20-30 km offsets) and compute overall risk
        const base = this.selectedLocation;
        if (!base) return [];
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const offsets = [
            { dlat: 0.2, dlng: 0 },
            { dlat: -0.2, dlng: 0 },
            { dlat: 0, dlng: 0.2 },
            { dlat: 0, dlng: -0.2 }
        ];
        const pts = offsets.map(o => ({ lat: base.lat + o.dlat, lng: base.lng + o.dlng }));
        try {
            const results = await Promise.all(pts.map(async p => {
                const computed = await this.fetchPowerData(p.lat, p.lng, startDate, endDate, false);
                const label = await this.reverseGeocodeName(p.lat, p.lng);
                return { coords: `${p.lat.toFixed(3)}, ${p.lng.toFixed(3)}`, label: label || null, lat: p.lat, lng: p.lng, riskScore: this.computeOverallRisk(computed) };
            }));
            // Sort by ascending risk
            results.sort((a, b) => a.riskScore - b.riskScore);
            return results;
        } catch (_) {
            return [];
        }
    }

    async reverseGeocodeName(lat, lng) {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=0`, { headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' }, cache: 'no-store' });
            if (!res.ok) return '';
            const json = await res.json();
            return json && json.display_name ? json.display_name : '';
        } catch (_) {
            return '';
        }
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
    }

    showAlert(title, message) {
        const modal = document.getElementById('alertModal');
        const content = document.getElementById('alertContent');
        
        content.innerHTML = `
            <h3>${title}</h3>
            <p>${message}</p>
        `;
        
        modal.classList.add('active');
    }

    closeModal() {
        document.getElementById('alertModal').classList.remove('active');
    }

    loadSampleData() {
        // Set New York as default location
        setTimeout(() => {
            this.selectLocation(40.7128, -74.0060);
            document.getElementById('locationSearch').value = 'New York, NY, USA';
            try {
                this.map.setView([40.7128, -74.0060], 10);
            } catch (_) {}
            // Automatically run an initial analysis so users see data immediately
            setTimeout(() => this.analyzeWeather(), 300);
        }, 1000);
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WeatherInsightApp();
});

// Additional utility functions
function formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }).format(date);
}

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Service Worker registration for PWA functionality (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
