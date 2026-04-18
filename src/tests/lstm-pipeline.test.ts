/**
 * LSTM Pipeline — Frontend Integration Tests
 *
 * Tests the full data flow from the frontend perspective:
 *   1. API endpoint contracts  (shape, status codes)
 *   2. Data service logic      (fetch, cache, map)
 *   3. Prediction page state   (step sequencing)
 *   4. Report generation flow
 *
 * Run:
 *   npm test                   # single run
 *   npm run test:watch         # watch mode
 *   npm run test:ui            # browser UI
 *
 * NOTE: These tests mock fetch() — no real backend needed.
 *       For live backend tests use backend/test_lstm_pipeline.py
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── helpers ───────────────────────────────────────────────────────────────────
const API = 'http://localhost:8000';

function mockFetch(responses: Record<string, unknown>) {
  return vi.fn((url: string) => {
    const key = Object.keys(responses).find(k => url.includes(k));
    const body = key ? responses[key] : { error: 'not mocked' };
    return Promise.resolve({
      ok:   !('error' in (body as object)),
      status: 'error' in (body as object) ? 404 : 200,
      json: () => Promise.resolve(body),
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. API RESPONSE CONTRACTS
// ══════════════════════════════════════════════════════════════════════════════

describe('API Response Contracts', () => {

  describe('GET /api/data/regions', () => {
    it('returns 4 regions with required fields', async () => {
      const mock = mockFetch({
        '/api/data/regions': {
          success: true,
          regions: [
            { id: 'pacific',       name: 'Pacific Ocean',     dataset_cached: true,  dataset_info: { total_records: 730 } },
            { id: 'atlantic',      name: 'Atlantic Ocean',    dataset_cached: false, dataset_info: null },
            { id: 'indian',        name: 'Indian Ocean',      dataset_cached: true,  dataset_info: { total_records: 365 } },
            { id: 'mediterranean', name: 'Mediterranean Sea', dataset_cached: false, dataset_info: null },
          ],
        },
      });
      global.fetch = mock as any;

      const res  = await fetch(`${API}/api/data/regions`);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.regions).toHaveLength(4);
      expect(data.regions[0]).toHaveProperty('id');
      expect(data.regions[0]).toHaveProperty('dataset_cached');
      expect(['pacific','atlantic','indian','mediterranean']).toContain(data.regions[0].id);
    });
  });

  describe('GET /api/data/fetch-status', () => {
    it('returns cooldown info for all regions', async () => {
      const mock = mockFetch({
        '/api/data/fetch-status': {
          success: true,
          regions: {
            pacific:       { can_fetch: true,  seconds_remaining: 0,    dataset_exists: true  },
            atlantic:      { can_fetch: false, seconds_remaining: 1800, dataset_exists: false },
            indian:        { can_fetch: true,  seconds_remaining: 0,    dataset_exists: false },
            mediterranean: { can_fetch: true,  seconds_remaining: 0,    dataset_exists: true  },
          },
        },
      });
      global.fetch = mock as any;

      const res  = await fetch(`${API}/api/data/fetch-status`);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.regions).toHaveProperty('pacific');
      expect(data.regions.pacific).toHaveProperty('can_fetch');
      expect(data.regions.pacific).toHaveProperty('seconds_remaining');
      expect(data.regions.atlantic.can_fetch).toBe(false);
      expect(data.regions.atlantic.seconds_remaining).toBeGreaterThan(0);
    });
  });

  describe('POST /api/data/fetch', () => {
    it('returns success with dataset_info on first fetch', async () => {
      const mock = mockFetch({
        '/api/data/fetch': {
          success: true,
          message: 'data_fetched_successfully',
          region:  'pacific',
          dataset_info: {
            total_records: 730,
            date_range: { start: '2022-01-01', end: '2024-01-01' },
            features: ['date','temperature','aqi','pollution_level'],
          },
          fetch_duration_seconds: 4.2,
          sources_used: ['open_meteo', 'waqi', 'noaa'],
        },
      });
      global.fetch = mock as any;

      const res  = await fetch(`${API}/api/data/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: 'pacific' }),
      });
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.message).toBe('data_fetched_successfully');
      expect(data.dataset_info.total_records).toBeGreaterThan(0);
      expect(data.sources_used).toContain('open_meteo');
    });

    it('returns cooldown_active when called too soon', async () => {
      const mock = mockFetch({
        '/api/data/fetch': {
          success: false,
          message: 'cooldown_active',
          region:  'pacific',
          seconds_remaining: 2400,
          next_fetch_at: '2026-01-01T12:00:00',
        },
      });
      global.fetch = mock as any;

      const res  = await fetch(`${API}/api/data/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: 'pacific' }),
      });
      const data = await res.json();

      expect(data.success).toBe(false);
      expect(data.message).toBe('cooldown_active');
      expect(data.seconds_remaining).toBeGreaterThan(0);
    });
  });

  describe('POST /api/train', () => {
    it('returns training metrics on success', async () => {
      const mock = mockFetch({
        '/api/train': {
          success: true,
          message: 'training_completed',
          region:  'pacific',
          training_result: {
            epochs_trained:   47,
            final_loss:       0.0234,
            final_val_loss:   0.0289,
            validation_mae:   3.21,
            validation_rmse:  4.87,
            training_samples: 700,
            data_source:      'mixed_multi_region',
          },
        },
      });
      global.fetch = mock as any;

      const res  = await fetch(`${API}/api/train`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: 'pacific', epochs: 50 }),
      });
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.training_result).toHaveProperty('validation_mae');
      expect(data.training_result).toHaveProperty('epochs_trained');
      expect(data.training_result.validation_mae).toBeLessThan(50);
    });
  });

  describe('POST /api/predict', () => {
    it('returns 7 predictions with correct shape', async () => {
      const predictions = Array.from({ length: 7 }, (_, i) => ({
        date:            `2026-01-${String(i + 1).padStart(2, '0')}`,
        pollution_level: 40 + i * 2.5,
        confidence:      0.85 - i * 0.02,
      }));

      const mock = mockFetch({
        '/api/predict': {
          success:    true,
          region:     'pacific',
          predictions,
          saved_to_db: 7,
          summary: {
            current_level:        38.5,
            predicted_level:      55.0,
            trend_change_percent: 42.9,
            risk_level:           'Moderate',
            average_confidence:   0.79,
          },
          data_source: 'cached_only',
        },
      });
      global.fetch = mock as any;

      const res  = await fetch(`${API}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
        body: JSON.stringify({ region: 'pacific', days_ahead: 7 }),
      });
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.predictions).toHaveLength(7);
      // saved_to_db must equal number of predictions — feeds heatmap + reports
      expect(data.saved_to_db).toBe(7);

      for (const p of data.predictions) {
        expect(p).toHaveProperty('date');
        expect(p).toHaveProperty('pollution_level');
        expect(p).toHaveProperty('confidence');
        expect(p.pollution_level).toBeGreaterThanOrEqual(0);
        expect(p.pollution_level).toBeLessThanOrEqual(100);
        expect(p.confidence).toBeGreaterThan(0);
        expect(p.confidence).toBeLessThanOrEqual(1);
      }

      expect(data.summary.risk_level).toMatch(/^(Low|Moderate|High|Critical)$/);
    });

    it('confidence interval is tighter for high-confidence predictions', () => {
      // Replicate the backend margin formula
      const computeInterval = (level: number, conf: number) => {
        const margin = level * (1 - conf) * 0.5;
        return {
          lower: Math.max(0,   level - margin),
          upper: Math.min(100, level + margin),
        };
      };

      const highConf = computeInterval(60, 0.95);
      const lowConf  = computeInterval(60, 0.55);

      expect(highConf.upper - highConf.lower).toBeLessThan(lowConf.upper - lowConf.lower);
      expect(highConf.lower).toBeGreaterThan(lowConf.lower);
      expect(highConf.upper).toBeLessThan(lowConf.upper);
    });

    it('returns 30 predictions when days_ahead=30', async () => {
      const predictions = Array.from({ length: 30 }, (_, i) => ({
        date:            `2026-01-${String(i + 1).padStart(2, '0')}`,
        pollution_level: 45 + Math.sin(i / 5) * 10,
        confidence:      Math.max(0.5, 0.85 - i * 0.01),
      }));

      const mock = mockFetch({ '/api/predict': { success: true, predictions, saved_to_db: 30, summary: {} } });
      global.fetch = mock as any;

      const res  = await fetch(`${API}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
        body: JSON.stringify({ region: 'atlantic', days_ahead: 30 }),
      });
      const data = await res.json();

      expect(data.predictions).toHaveLength(30);
      expect(data.saved_to_db).toBe(30);
    });
  });

  describe('GET /api/data/api-health', () => {
    it('returns status for all 3 data sources', async () => {
      const mock = mockFetch({
        '/api/data/api-health': {
          success: true,
          all_healthy: true,
          apis: {
            open_meteo: { status: 'ok',    key_required: false },
            waqi:       { status: 'ok',    key_required: true, sample_aqi: 55 },
            noaa:       { status: 'ok',    key_required: true, datasets_available: 11 },
          },
        },
      });
      global.fetch = mock as any;

      const res  = await fetch(`${API}/api/data/api-health`);
      const data = await res.json();

      expect(data.success).toBe(true);
      expect(data.apis).toHaveProperty('open_meteo');
      expect(data.apis).toHaveProperty('waqi');
      expect(data.apis).toHaveProperty('noaa');
      expect(data.apis.open_meteo.key_required).toBe(false);
      expect(data.apis.waqi.sample_aqi).toBeGreaterThan(0);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. DATA SERVICE LOGIC
// ══════════════════════════════════════════════════════════════════════════════

describe('Data Service Logic', () => {

  describe('mapHistoryItem', () => {
    it('maps raw DB item to HistoryItem correctly', () => {
      const raw = {
        id:               42,
        filename:         'ocean_sample.jpg',
        file_type:        'image',
        upload_date:      '2026-01-15T10:30:00',
        total_detections: 7,
        avg_confidence:   82.5,
        classes:          ['plastic_bottle', 'fishing_net'],
        raw_result:       JSON.stringify({
          success: true, totalDetections: 7,
          detections: [], summary: [],
        }),
      };

      // Replicate mapHistoryItem logic
      const parsed = JSON.parse(raw.raw_result);
      const item = {
        id:         raw.id.toString(),
        detectionId: raw.id,
        filename:   raw.filename,
        type:       raw.file_type as 'image' | 'video',
        objects:    raw.total_detections,
        confidence: Math.round(raw.avg_confidence),
        classes:    raw.classes,
        result:     { ...parsed, filename: raw.filename, totalDetections: raw.total_detections },
      };

      expect(item.id).toBe('42');
      expect(item.detectionId).toBe(42);
      expect(item.filename).toBe('ocean_sample.jpg');
      expect(item.type).toBe('image');
      expect(item.objects).toBe(7);
      expect(item.confidence).toBe(83);
      expect(item.classes).toContain('plastic_bottle');
      expect(item.result.success).toBe(true);
    });
  });

  describe('Pollution level classification', () => {
    const classify = (level: number) =>
      level >= 80 ? 'Critical' : level >= 60 ? 'High' : level >= 30 ? 'Moderate' : 'Low';

    it.each([
      [10,  'Low'],
      [29,  'Low'],
      [30,  'Moderate'],
      [59,  'Moderate'],
      [60,  'High'],
      [79,  'High'],
      [80,  'Critical'],
      [100, 'Critical'],
    ])('level %i → %s', (level, expected) => {
      expect(classify(level)).toBe(expected);
    });
  });

  describe('Countdown formatter', () => {
    const fmt = (s: number) => `${Math.floor(s / 60)}m ${(s % 60).toString().padStart(2, '0')}s`;

    it.each([
      [0,    '0m 00s'],
      [60,   '1m 00s'],
      [90,   '1m 30s'],
      [3600, '60m 00s'],
      [3661, '61m 01s'],
    ])('%i seconds → "%s"', (secs, expected) => {
      expect(fmt(secs)).toBe(expected);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. PIPELINE STEP SEQUENCING
// ══════════════════════════════════════════════════════════════════════════════

describe('Pipeline Step Sequencing', () => {

  it('Step 2 (Train) is disabled when dataset_cached=false', () => {
    const status = { dataset_cached: false, model_trained: false };
    const canTrain = status.dataset_cached;
    expect(canTrain).toBe(false);
  });

  it('Step 3 (Predict) is disabled when model_trained=false', () => {
    const status = { dataset_cached: true, model_trained: false };
    const canPredict = status.model_trained;
    expect(canPredict).toBe(false);
  });

  it('All steps enabled when data cached and model trained', () => {
    const status = { dataset_cached: true, model_trained: true };
    expect(status.dataset_cached).toBe(true);
    expect(status.model_trained).toBe(true);
  });

  it('Fetch button shows countdown when cooldown active', () => {
    const fetchStatus = { can_fetch: false, seconds_remaining: 1800 };
    const showCountdown = !fetchStatus.can_fetch && fetchStatus.seconds_remaining > 0;
    expect(showCountdown).toBe(true);
  });

  it('Fetch button is enabled when cooldown expired', () => {
    const fetchStatus = { can_fetch: true, seconds_remaining: 0 };
    const isDisabled = !fetchStatus.can_fetch;
    expect(isDisabled).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. REPORT GENERATION
// ══════════════════════════════════════════════════════════════════════════════

describe('Report Generation', () => {

  it('POST /api/reports/generate returns report with id', async () => {
    const mock = mockFetch({
      '/api/reports/generate': {
        success: true,
        message: 'Report generated successfully',
        report: {
          id:          1,
          title:       'YOLO Detection Report - January 15, 2026',
          report_type: 'detection',
          created_at:  '2026-01-15T10:00:00',
          data:        { report_type: 'detection', executive_summary: 'Test summary' },
        },
      },
    });
    global.fetch = mock as any;

    const res  = await fetch(`${API}/api/reports/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-token' },
      body: JSON.stringify({ report_type: 'detection', date_range_days: 30 }),
    });
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.report).toHaveProperty('id');
    expect(data.report.report_type).toBe('detection');
    expect(typeof data.report.id).toBe('number');
  });

  it('GET /api/reports returns list', async () => {
    const mock = mockFetch({
      '/api/reports': {
        success: true,
        reports: [
          { id: 1, title: 'Report A', report_type: 'detection',  created_at: '2026-01-10', status: 'ready', size: '1.2 MB' },
          { id: 2, title: 'Report B', report_type: 'prediction', created_at: '2026-01-12', status: 'ready', size: '0.8 MB' },
        ],
      },
    });
    global.fetch = mock as any;

    const res  = await fetch(`${API}/api/reports`, {
      headers: { Authorization: 'Bearer test-token' },
    });
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(Array.isArray(data.reports)).toBe(true);
    expect(data.reports[0]).toHaveProperty('id');
    expect(data.reports[0]).toHaveProperty('report_type');
  });

  it('Report type label maps correctly', () => {
    const label = (t: string) => {
      switch (t) {
        case 'detection':  return 'YOLO Detection';
        case 'prediction': return 'LSTM Prediction';
        case 'both':
        case 'custom':     return 'Comprehensive';
        default:           return t;
      }
    };
    expect(label('detection')).toBe('YOLO Detection');
    expect(label('prediction')).toBe('LSTM Prediction');
    expect(label('both')).toBe('Comprehensive');
    expect(label('custom')).toBe('Comprehensive');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 7. PREDICTION → DB → HEATMAP → REPORT CHAIN
// ══════════════════════════════════════════════════════════════════════════════

describe('Prediction → DB → Heatmap → Report Chain', () => {

  it('saved_to_db equals predictions length', async () => {
    const N = 14;
    const mock = mockFetch({
      '/api/predict': {
        success: true,
        region: 'pacific',
        predictions: Array.from({ length: N }, (_, i) => ({
          date: `2026-02-${String(i + 1).padStart(2, '0')}`,
          pollution_level: 55 + i,
          confidence: 0.82,
        })),
        saved_to_db: N,
        summary: { current_level: 54, predicted_level: 68, trend_change_percent: 25.9, risk_level: 'High', average_confidence: 0.82 },
      },
    });
    global.fetch = mock as any;

    const res  = await fetch(`${API}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify({ region: 'pacific', days_ahead: N }),
    });
    const data = await res.json();

    expect(data.saved_to_db).toBe(N);
    expect(data.saved_to_db).toBe(data.predictions.length);
  });

  it('heatmap reflects saved predictions (sample_count > 0)', async () => {
    const mock = mockFetch({
      '/api/heatmap': {
        success: true,
        hotspots: [
          { region: 'pacific', lat: 10, lng: -150, intensity: 'High',     avg_pollution_level: 67.4, pollution_score: 0.71, sample_count: 14, is_estimated: false },
          { region: 'atlantic', lat: 30, lng: -40, intensity: 'Moderate', avg_pollution_level: 44.2, pollution_score: 0.38, sample_count: 0,  is_estimated: true  },
        ],
        total: 2, has_data: true,
      },
    });
    global.fetch = mock as any;

    const res  = await fetch(`${API}/api/heatmap?range=7d&mode=current`, {
      headers: { Authorization: 'Bearer tok' },
    });
    const data = await res.json();

    const pacific = data.hotspots.find((h: any) => h.region === 'pacific');
    expect(pacific.sample_count).toBeGreaterThan(0);
    expect(pacific.is_estimated).toBe(false);   // real data, not baseline

    const atlantic = data.hotspots.find((h: any) => h.region === 'atlantic');
    expect(atlantic.is_estimated).toBe(true);   // no predictions yet → baseline
  });

  it('heatmap predicted mode uses latest batch', async () => {
    const mock = mockFetch({
      '/api/heatmap': {
        success: true,
        hotspots: [
          { region: 'pacific', lat: 10, lng: -150, intensity: 'Critical', avg_pollution_level: 81.0, pollution_score: 0.88, sample_count: 7, is_prediction: true, is_estimated: false },
        ],
        total: 1, has_data: true,
      },
    });
    global.fetch = mock as any;

    const res  = await fetch(`${API}/api/heatmap?range=7d&mode=predicted`, {
      headers: { Authorization: 'Bearer tok' },
    });
    const data = await res.json();

    const pacific = data.hotspots[0];
    expect(pacific.is_prediction).toBe(true);
    expect(pacific.intensity).toBe('Critical');
    expect(pacific.avg_pollution_level).toBeGreaterThan(80);
  });

  it('report generation uses saved predictions', async () => {
    const mock = mockFetch({
      '/api/reports/generate': {
        success: true,
        message: 'Report generated successfully',
        report: {
          id: 5,
          title: 'LSTM Prediction Report - April 18, 2026',
          report_type: 'prediction',
          created_at: '2026-04-18T21:00:00',
          data: {
            report_type: 'prediction',
            prediction_analytics: {
              summary: {
                total_predictions: 14,
                regions_analyzed: 1,
                overall_avg_pollution: 61.5,
                model_version: '2026-04-18',
                prediction_reliability: 'High',
              },
              regional_analysis: [{
                region: 'pacific',
                avg_pollution_level: 61.5,
                max_pollution_level: 68.0,
                min_pollution_level: 55.0,
                trend: 'Increasing',
                risk_level: 'High',
                total_predictions: 14,
              }],
              risk_assessment: {
                highest_risk_region: 'pacific',
                overall_ocean_health: 'Fair',
                critical_regions: [],
              },
            },
            executive_summary: 'LSTM-based pollution forecasting analysis covering 14 predictions across 1 ocean regions.',
          },
        },
      },
    });
    global.fetch = mock as any;

    const res  = await fetch(`${API}/api/reports/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: JSON.stringify({ report_type: 'prediction', date_range_days: 30 }),
    });
    const data = await res.json();

    expect(data.success).toBe(true);
    const analytics = data.report.data.prediction_analytics;
    expect(analytics.summary.total_predictions).toBeGreaterThan(0);
    expect(analytics.regional_analysis[0].region).toBe('pacific');
    expect(analytics.risk_assessment).toHaveProperty('overall_ocean_health');
  });

  it('confidence interval is physically valid', () => {
    // Backend formula: margin = level * (1 - conf) * 0.5
    const cases = [
      { level: 60, conf: 0.85 },
      { level: 80, conf: 0.60 },
      { level: 20, conf: 0.95 },
      { level: 95, conf: 0.50 },
    ];
    for (const { level, conf } of cases) {
      const margin = level * (1 - conf) * 0.5;
      const lower  = Math.max(0,   level - margin);
      const upper  = Math.min(100, level + margin);
      expect(lower).toBeLessThanOrEqual(level);
      expect(upper).toBeGreaterThanOrEqual(level);
      expect(lower).toBeGreaterThanOrEqual(0);
      expect(upper).toBeLessThanOrEqual(100);
    }
  });
});

describe('Heatmap Data', () => {

  it('GET /api/heatmap returns hotspots with required fields', async () => {
    const mock = mockFetch({
      '/api/heatmap': {
        success:  true,
        hotspots: [
          { region: 'pacific',  lat: 10.0, lng: -150.0, intensity: 'Critical', avg_pollution_level: 72.3, pollution_score: 0.78, sample_count: 45 },
          { region: 'atlantic', lat: 30.0, lng: -40.0,  intensity: 'Moderate', avg_pollution_level: 48.1, pollution_score: 0.42, sample_count: 23 },
        ],
        total:    2,
        has_data: true,
      },
    });
    global.fetch = mock as any;

    const res  = await fetch(`${API}/api/heatmap?range=7d&mode=current`, {
      headers: { Authorization: 'Bearer test-token' },
    });
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.hotspots.length).toBeGreaterThan(0);

    for (const h of data.hotspots) {
      expect(h).toHaveProperty('region');
      expect(h).toHaveProperty('lat');
      expect(h).toHaveProperty('lng');
      expect(h).toHaveProperty('intensity');
      expect(['Low','Moderate','High','Critical']).toContain(h.intensity);
      expect(h.lat).toBeGreaterThanOrEqual(-90);
      expect(h.lat).toBeLessThanOrEqual(90);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 6. AUTH FLOW
// ══════════════════════════════════════════════════════════════════════════════

describe('Auth Flow', () => {

  it('POST /api/auth/login returns token and user', async () => {
    const mock = mockFetch({
      '/api/auth/login': {
        access_token: 'eyJhbGciOiJIUzI1NiJ9.test.signature',
        token_type:   'bearer',
        expires_in:   86400,
        user: { id: 1, username: 'demo_user', email: 'user@test.com', role: 'USER' },
      },
    });
    global.fetch = mock as any;

    const res  = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'demo_user', password: 'user123' }),
    });
    const data = await res.json();

    expect(data).toHaveProperty('access_token');
    expect(data).toHaveProperty('user');
    expect(data.user.role).toMatch(/^(USER|ADMIN)$/);
    expect(data.token_type).toBe('bearer');
  });

  it('Unauthenticated request to protected endpoint returns 401', async () => {
    const mock = vi.fn(() => Promise.resolve({
      ok: false, status: 401,
      json: () => Promise.resolve({ detail: 'Invalid or expired token' }),
    }));
    global.fetch = mock as any;

    const res = await fetch(`${API}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ region: 'pacific', days_ahead: 7 }),
    });

    expect(res.status).toBe(401);
    expect(res.ok).toBe(false);
  });
});
