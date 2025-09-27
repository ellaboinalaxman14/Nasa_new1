// WeatherInsight+ Configuration
const CONFIG = {
    // NASA Earth Observation APIs
    NASA_APIS: {
        // NASA Earthdata API endpoints
        GIOVANNI: 'https://giovanni.gsfc.nasa.gov/giovanni/daac-bin/service_manager.pl',
        EARTHDATA: 'https://earthdata.nasa.gov/api/v1',
        MODIS: 'https://modis.gsfc.nasa.gov/data/dataprod',
        // NASA POWER (Primary for meteorology at a point)
        POWER_BASE: 'https://power.larc.nasa.gov/api/temporal/daily/point',
        POWER_COMMUNITY: 'RE',
        
        // Specific data endpoints
        TEMPERATURE: 'https://giovanni.gsfc.nasa.gov/giovanni/daac-bin/wms_ag4?',
        PRECIPITATION: 'https://gpm.nasa.gov/data-access/downloads/gpm',
        WIND: 'https://winds.jpl.nasa.gov/api/v1',
        HUMIDITY: 'https://airs.jpl.nasa.gov/data/get_data',
        AIR_QUALITY: 'https://so2.gsfc.nasa.gov/pix/daily'
    },
    // POWER parameter mapping used by frontend
    POWER_PARAMS: {
        TEMPERATURE_AVG: 'T2M',        // Air Temperature at 2 Meters (C)
        TEMPERATURE_MAX: 'T2M_MAX',    // Max Temperature at 2 Meters (C)
        TEMPERATURE_MIN: 'T2M_MIN',    // Min Temperature at 2 Meters (C)
        PRECIPITATION: 'PRECTOTCORR',  // Corrected Precipitation (mm/day)
        WIND: 'WS10M',                 // Wind Speed at 10 Meters (m/s)
        HUMIDITY: 'RH2M'               // Relative Humidity at 2 Meters (%)
    },

    // API Keys (Note: These should be stored securely in production)
    API_KEYS: {
        NASA_API_KEY: 'YOUR_NASA_API_KEY_HERE', // Get from https://api.nasa.gov/
        OPENWEATHER_API_KEY: 'YOUR_OPENWEATHER_API_KEY_HERE', // Backup weather data
        GOOGLE_MAPS_API_KEY: 'AIzaSyD_SewkJPZPIsBQ_1_Md-pKIx-3zR5SZAA' // Google Maps JavaScript API Key
    },

    // Data parameters
    DATA_PARAMS: {
        // Temperature thresholds (Celsius)
        TEMPERATURE_EXTREMES: {
            VERY_HOT: 35,
            HOT: 30,
            COLD: 5,
            VERY_COLD: -5
        },
        
        // Precipitation thresholds (mm/day)
        PRECIPITATION_LEVELS: {
            LIGHT: 2.5,
            MODERATE: 10,
            HEAVY: 50,
            EXTREME: 100
        },
        
        // Wind speed thresholds (m/s)
        WIND_LEVELS: {
            CALM: 2,
            LIGHT: 5,
            MODERATE: 10,
            STRONG: 15,
            VERY_STRONG: 25
        },
        
        // Humidity thresholds (%)
        HUMIDITY_LEVELS: {
            LOW: 30,
            COMFORTABLE: 60,
            HIGH: 80,
            VERY_HIGH: 90
        },
        
        // Air Quality Index thresholds
        AQI_LEVELS: {
            GOOD: 50,
            MODERATE: 100,
            UNHEALTHY_SENSITIVE: 150,
            UNHEALTHY: 200,
            VERY_UNHEALTHY: 300
        }
    },

    // Historical data parameters
    HISTORICAL_DATA: {
        // Years of historical data to analyze
        YEARS_BACK: 20,
        
        // Minimum data points required for reliable probability calculation
        MIN_DATA_POINTS: 100,
        
        // Confidence intervals
        CONFIDENCE_LEVELS: [0.68, 0.95, 0.99] // 1σ, 2σ, 3σ
    },

    // Map configuration
    MAP_CONFIG: {
        DEFAULT_CENTER: [40.7128, -74.0060], // New York City
        DEFAULT_ZOOM: 10,
        MAX_ZOOM: 18,
        MIN_ZOOM: 2,
        
        // Tile layers
        TILE_LAYERS: {
            OPENSTREETMAP: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            SATELLITE: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            TERRAIN: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png'
        }
    },

    // Chart configuration
    CHART_CONFIG: {
        COLORS: {
            PRIMARY: '#667eea',
            SECONDARY: '#764ba2',
            SUCCESS: '#28a745',
            WARNING: '#ffc107',
            DANGER: '#dc3545',
            INFO: '#17a2b8'
        },
        
        GRADIENTS: {
            TEMPERATURE: ['#3b82f6', '#ef4444'],
            PRECIPITATION: ['#06b6d4', '#1e40af'],
            WIND: ['#10b981', '#059669'],
            HUMIDITY: ['#8b5cf6', '#7c3aed'],
            AIR_QUALITY: ['#f59e0b', '#dc2626']
        }
    },

    // Alert thresholds
    ALERT_THRESHOLDS: {
        LOW_RISK: 30,
        MEDIUM_RISK: 60,
        HIGH_RISK: 80
    },

    // Export settings
    EXPORT_CONFIG: {
        CSV_DELIMITER: ',',
        DATE_FORMAT: 'YYYY-MM-DD',
        INCLUDE_METADATA: true,
        INCLUDE_SOURCE_LINKS: true
    },

    // Cache settings
    CACHE_CONFIG: {
        ENABLE_CACHE: true,
        CACHE_DURATION: 3600000, // 1 hour in milliseconds
        MAX_CACHE_SIZE: 100 // Maximum number of cached requests
    },

    // Rate limiting
    RATE_LIMITS: {
        NASA_API: {
            REQUESTS_PER_HOUR: 1000,
            REQUESTS_PER_DAY: 10000
        },
        GEOCODING: {
            REQUESTS_PER_MINUTE: 60
        }
    },

    // Error handling
    ERROR_CONFIG: {
        MAX_RETRIES: 3,
        RETRY_DELAY: 1000, // milliseconds
        TIMEOUT: 30000 // 30 seconds
    },

    // Feature flags
    FEATURES: {
        ENABLE_ROUTE_ANALYSIS: true,
        ENABLE_CHATBOT: true,
        ENABLE_PUSH_NOTIFICATIONS: false,
        ENABLE_OFFLINE_MODE: false,
        ENABLE_SOCIAL_SHARING: false
    },

    // Localization
    LOCALIZATION: {
        DEFAULT_LANGUAGE: 'en',
        SUPPORTED_LANGUAGES: ['en', 'es', 'fr', 'de', 'zh'],
        DATE_FORMATS: {
            'en': 'MM/DD/YYYY',
            'es': 'DD/MM/YYYY',
            'fr': 'DD/MM/YYYY',
            'de': 'DD.MM.YYYY',
            'zh': 'YYYY/MM/DD'
        }
    }
};

// NASA API helper functions
const NASA_API = {
    // Build API URL with parameters
    buildURL: (endpoint, params) => {
        const url = new URL(endpoint);
        Object.keys(params).forEach(key => {
            url.searchParams.append(key, params[key]);
        });
        return url.toString();
    },

    // Common parameters for NASA API requests
    getCommonParams: (lat, lon, startDate, endDate) => {
        return {
            lat: lat,
            lon: lon,
            start: startDate,
            end: endDate,
            api_key: CONFIG.API_KEYS.NASA_API_KEY
        };
    },

    // Format date for NASA API
    formatDate: (date) => {
        return date.toISOString().split('T')[0];
    },

    // Calculate probability based on historical data
    calculateProbability: (historicalData, threshold, condition = 'above') => {
        if (!historicalData || historicalData.length === 0) return 0;
        
        let count = 0;
        historicalData.forEach(value => {
            if (condition === 'above' && value > threshold) count++;
            else if (condition === 'below' && value < threshold) count++;
            else if (condition === 'between' && value >= threshold.min && value <= threshold.max) count++;
        });
        
        return (count / historicalData.length) * 100;
    }
};

// Weather condition analysis functions
const WEATHER_ANALYSIS = {
    // Analyze temperature extremes
    analyzeTemperature: (data) => {
        const extremeHot = NASA_API.calculateProbability(
            data, 
            CONFIG.DATA_PARAMS.TEMPERATURE_EXTREMES.VERY_HOT, 
            'above'
        );
        
        const extremeCold = NASA_API.calculateProbability(
            data, 
            CONFIG.DATA_PARAMS.TEMPERATURE_EXTREMES.VERY_COLD, 
            'below'
        );
        
        return Math.max(extremeHot, extremeCold);
    },

    // Analyze precipitation probability
    analyzePrecipitation: (data) => {
        return NASA_API.calculateProbability(
            data, 
            CONFIG.DATA_PARAMS.PRECIPITATION_LEVELS.HEAVY, 
            'above'
        );
    },

    // Analyze wind conditions
    analyzeWind: (data) => {
        return NASA_API.calculateProbability(
            data, 
            CONFIG.DATA_PARAMS.WIND_LEVELS.STRONG, 
            'above'
        );
    },

    // Analyze humidity levels
    analyzeHumidity: (data) => {
        return NASA_API.calculateProbability(
            data, 
            CONFIG.DATA_PARAMS.HUMIDITY_LEVELS.VERY_HIGH, 
            'above'
        );
    },

    // Analyze air quality
    analyzeAirQuality: (data) => {
        return NASA_API.calculateProbability(
            data, 
            CONFIG.DATA_PARAMS.AQI_LEVELS.UNHEALTHY_SENSITIVE, 
            'above'
        );
    }
};

// Export configuration for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, NASA_API, WEATHER_ANALYSIS };
}
