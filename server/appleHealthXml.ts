import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import AdmZip from 'adm-zip';
import type { PoolClient } from 'pg';
import type { DailySummary, VitalityScore } from '../src/types/health.ts';
import { archiveZip, registerArchive, type ArchiveFile } from './archive.ts';
import { config } from './config.ts';
import { pool } from './db.ts';
import {
  completeImportBatch,
  contentHash,
  createImportBatch,
  failImportBatch,
  persistRawAndSampleRows,
  type HealthSampleRow,
  type RawRecordRow,
} from './rawLibrary.ts';
import { dateInTimeZone } from './time.ts';

export interface AppleHealthZipResult {
  ok: true;
  importedDays: number;
  earliestDate: string;
  latestDate: string;
  totalWorkouts: number;
  rawRecordCount: number;
  normalizedRecordCount: number;
  archivePath: string;
  archiveSizeBytes: number;
}

function parseDateStr(str?: string): string {
  if (!str) return '';
  const match = str.match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function parseHourMinute(str?: string): string {
  if (!str) return '--:--';
  const match = str.match(/\s(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : '--:--';
}

const numberOrNull = (value: string | number | null): number | null => {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const APPLE_HEALTH_OBJECT_TAGS = new Set([
  'Record',
  'Workout',
  'ActivitySummary',
  'Correlation',
  'ClinicalRecord',
  'Audiogram',
  'VisionPrescription',
]);

const decodeXml = (value: string): string =>
  value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) =>
      String.fromCodePoint(parseInt(code, 16))
    );

const parseXmlAttributes = (xml: string): Record<string, string> => {
  const attributes: Record<string, string> = {};
  const startTag = xml.match(/^\s*<([A-Za-z0-9_:-]+)\b[^>]*>/)?.[0] || '';
  const attributeRegex = /([A-Za-z0-9_:.-]+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = attributeRegex.exec(startTag)) !== null) {
    attributes[match[1]] = decodeXml(match[2]);
  }
  return attributes;
};

const parseMetadataEntries = (xml: string): Record<string, string> => {
  const metadata: Record<string, string> = {};
  const regex = /<MetadataEntry\b[^>]*\bkey="([^"]*)"[^>]*\bvalue="([^"]*)"[^>]*\/>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    metadata[decodeXml(match[1])] = decodeXml(match[2]);
  }
  return metadata;
};

const parseAppleTimestamp = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const numericValue = (value?: string | null): number | null => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const distanceToKm = (value?: string | null, unit?: string | null): number | null => {
  const quantity = numericValue(value);
  if (quantity === null) return null;
  const normalizedUnit = unit?.trim().toLowerCase() || '';
  if (normalizedUnit === 'km' || normalizedUnit.includes('kilometer')) return quantity;
  if (normalizedUnit === 'mi' || normalizedUnit.includes('mile')) {
    return quantity * 1.609344;
  }
  return quantity / 1000;
};

const durationToSeconds = (
  value?: string | null,
  unit?: string | null
): number | null => {
  const quantity = numericValue(value);
  if (quantity === null) return null;
  const normalizedUnit = unit?.trim().toLowerCase() || 'min';
  if (normalizedUnit.startsWith('sec') || normalizedUnit === 's') {
    return Math.round(quantity);
  }
  if (normalizedUnit.startsWith('hour') || normalizedUnit === 'h') {
    return Math.round(quantity * 3600);
  }
  return Math.round(quantity * 60);
};

const recordNaturalKey = (
  type: string,
  attributes: Record<string, string>
): string =>
  [
    type,
    attributes.startDate || '',
    attributes.endDate || '',
    attributes.sourceName || '',
    attributes.creationDate || '',
  ].join('|');

function getDayInfo(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00+08:00');
  const dayIndex = d.getDay();
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const shortDays = ['日', '一', '二', '三', '四', '五', '六'];
  return {
    dayName: dayNames[dayIndex] || '未知',
    shortDay: shortDays[dayIndex] || '-',
  };
}

function parseGpxDirectory(routesDir: string): Map<string, { points: { lat: number; lon: number }[] }> {
  const routes = new Map<string, { points: { lat: number; lon: number }[] }>();
  if (!fs.existsSync(routesDir)) return routes;
  const files = fs.readdirSync(routesDir).filter((f) => f.endsWith('.gpx'));
  for (const file of files) {
    const filePath = path.join(routesDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const points: { lat: number; lon: number }[] = [];
    const regex = /<trkpt\s+lon="([^"]+)"\s+lat="([^"]+)"|<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (match[1] !== undefined) {
        points.push({ lon: parseFloat(match[1]), lat: parseFloat(match[2]) });
      } else {
        points.push({ lat: parseFloat(match[3]), lon: parseFloat(match[4]) });
      }
    }

    const dMatch = file.match(/route_(\d{4}-\d{2}-\d{2})/);
    if (dMatch && points.length > 0) {
      const step = Math.max(1, Math.floor(points.length / 300));
      const sampled: { lat: number; lon: number }[] = [];
      for (let i = 0; i < points.length; i += step) {
        sampled.push(points[i]);
      }
      routes.set(dMatch[1], { points: sampled });
    }
  }
  return routes;
}

export async function importAppleHealthZip(
  zipBuffer: Buffer,
  originalFilename?: string
): Promise<AppleHealthZipResult> {
  const archive: ArchiveFile = await archiveZip(
    'hae',
    'apple-health-export',
    zipBuffer,
    originalFilename
  );

  const tempDir = path.join(config.dataDir, 'temp_unzip', randomUUID());
  await fsp.mkdir(tempDir, { recursive: true });
  let libraryClient: PoolClient | null = null;
  let libraryBatchId: string | null = null;

  try {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    const xmlEntry = entries.find(
      (e) =>
        (e.entryName.endsWith('导出.xml') ||
          e.entryName.endsWith('export.xml') ||
          e.entryName.endsWith('.xml')) &&
        !e.entryName.includes('export_cda')
    );

    if (!xmlEntry) {
      throw new Error('未在 ZIP 包中找到有效的 Apple Health 导出 XML 文件。');
    }

    // Extract GPX routes
    const gpxEntries = entries.filter((e) => e.entryName.endsWith('.gpx'));
    const routesDir = path.join(tempDir, 'routes');
    if (gpxEntries.length > 0) {
      await fsp.mkdir(routesDir, { recursive: true });
      for (const gpx of gpxEntries) {
        zip.extractEntryTo(gpx, routesDir, false, true);
      }
    }

    // Extract XML
    zip.extractEntryTo(xmlEntry, tempDir, false, true);
    const extractedXmlPath = path.join(tempDir, path.basename(xmlEntry.entryName));

    const gpxRoutes = parseGpxDirectory(routesDir);

    libraryClient = await pool.connect();
    const client = libraryClient;
    let batchId: string | null = null;
    let archiveId: string | null = null;
    let haeImportId: string | null = null;
    try {
      await client.query('BEGIN');
      archiveId = await registerArchive(
        client,
        archive,
        'hae',
        'apple-health-export',
        0,
        {
          source: 'Apple Health Export Zip',
          filename: originalFilename || 'export.zip',
          importMode: 'raw-library',
        }
      );
      batchId = await createImportBatch(client, {
        sourceId: 'hae',
        importKind: 'apple-health-export',
        fileName: originalFilename || 'export.zip',
        archiveId,
        archivePath: archive.relativePath,
        sha256: archive.sha256,
        sizeBytes: archive.sizeBytes,
        metadata: { source: 'Apple Health Export Zip' },
      });
      libraryBatchId = batchId;
      const haeImport = await client.query<{ id: string }>(
        `INSERT INTO hae_imports
          (payload_size_bytes, source_ip, date_from, date_to, metric_count,
           workout_count, daily_summary_count, raw_payload, batch_id)
         VALUES ($1, NULL, NULL, NULL, 0, 0, 0, $2::jsonb, $3)
         RETURNING id`,
        [
          archive.sizeBytes,
          JSON.stringify({
            source: 'apple-health-export',
            archivePath: archive.relativePath,
            batchId,
          }),
          batchId,
        ]
      );
      haeImportId = haeImport.rows[0].id;
      await client.query('COMMIT');
      await client.query('BEGIN');
    } catch (error) {
      await client.query('ROLLBACK');
      client.release();
      throw error;
    }

    // Stream parse the extracted XML
    const fileStream = fs.createReadStream(extractedXmlPath, { encoding: 'utf8' });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    const activitySummaries = new Map<
      string,
      {
        move: number;
        moveGoal: number;
        exercise: number;
        exerciseGoal: number;
        stand: number;
        standGoal: number;
      }
    >();

    const dailyMetrics = new Map<
      string,
      {
        steps: number;
        walkingDistanceKm: number;
        cyclingDistanceKm: number;
        flights: number;
        basalEnergy: number;
        restingHr: number[];
        hrv: number[];
        spo2: number[];
        wristTemp: number[];
        vo2Max: number[];
        walkingSpeed: number[];
        stepLength: number[];
        doubleSupport: number[];
        asymmetry: number[];
        envAudio: number[];
        headphoneAudio: number[];
        daylightMins: number;
        mindfulMins: number;
      }
    >();

    const dailyWorkouts = new Map<string, any[]>();
    const dailyHrPoints = new Map<string, { time: string; hr: number; minuteOfDay: number }[]>();
    const dailySleepStages = new Map<
      string,
      { deep: number; core: number; rem: number; awake: number; bedTime: string; wakeTime: string }
    >();

    function getDailyBucket(dateStr: string) {
      if (!dailyMetrics.has(dateStr)) {
        dailyMetrics.set(dateStr, {
          steps: 0,
          walkingDistanceKm: 0,
          cyclingDistanceKm: 0,
          flights: 0,
          basalEnergy: 0,
          restingHr: [],
          hrv: [],
          spo2: [],
          wristTemp: [],
          vo2Max: [],
          walkingSpeed: [],
          stepLength: [],
          doubleSupport: [],
          asymmetry: [],
          envAudio: [],
          headphoneAudio: [],
          daylightMins: 0,
          mindfulMins: 0,
        });
      }
      return dailyMetrics.get(dateStr)!;
    }

    let pendingRawRows: RawRecordRow[] = [];
    let pendingSampleRows: HealthSampleRow[] = [];
    let rawObjectCount = 0;
    let normalizedObjectCount = 0;
    let skippedObjectCount = 0;
    const rawOccurrenceByHash = new Map<string, number>();
    const normalizedWorkouts: Array<{
      name: string;
      startedAt: string | null;
      endedAt: string | null;
      durationSec: number | null;
      activeEnergyKcal: number | null;
      distanceKm: number | null;
      avgHeartRate: number | null;
      maxHeartRate: number | null;
      elevationGainM: number | null;
      sourceName: string | null;
      deviceName: string | null;
      sourceUpdatedAt: string | null;
      naturalKey: string;
      rawContentHash: string;
      rawWorkout: Record<string, unknown>;
    }> = [];

    const flushPending = async () => {
      if (!batchId || (pendingRawRows.length === 0 && pendingSampleRows.length === 0)) return;
      await persistRawAndSampleRows(client, batchId, pendingRawRows, pendingSampleRows);
      pendingRawRows = [];
      pendingSampleRows = [];
    };

    const queueRawObject = async (
      tag: string,
      xml: string,
      attributes: Record<string, string>,
      metadata: Record<string, string> = {}
    ): Promise<string> => {
      const payload = { tag, attributes, metadata };
      const hash = contentHash(payload);
      const occurrenceIndex = (rawOccurrenceByHash.get(hash) || 0) + 1;
      rawOccurrenceByHash.set(hash, occurrenceIndex);
      const start = parseAppleTimestamp(attributes.startDate);
      const end = parseAppleTimestamp(attributes.endDate);
      const sourceUpdated = parseAppleTimestamp(attributes.creationDate);
      const localDate = start ? dateInTimeZone(start, config.timezone) : null;
      rawObjectCount += 1;
      pendingRawRows.push({
        sourceId: 'hae',
        objectType: tag,
        contentHash: hash,
        occurrenceIndex,
        metricType: attributes.type || null,
        startAt: start?.toISOString() || null,
        endAt: end?.toISOString() || null,
        localDate,
        valueText: attributes.value ?? null,
        valueNum: numericValue(attributes.value),
        unit: attributes.unit || null,
        sourceName: attributes.sourceName || null,
        deviceName: attributes.device || null,
        sourceUpdatedAt: sourceUpdated?.toISOString() || null,
        metadata,
        rawAttributes: attributes,
        rawPayload: payload,
        rawXml: xml,
      });
      if (pendingRawRows.length >= 2500) await flushPending();
      return hash;
    };

    const processRecord = async (xml: string) => {
      const attributes = parseXmlAttributes(xml);
      const metadata = parseMetadataEntries(xml);
      const type = attributes.type;
      const start = parseAppleTimestamp(attributes.startDate);
      const end = parseAppleTimestamp(attributes.endDate);
      const dateStr = parseDateStr(attributes.startDate);
      if (!type || !start || !dateStr) {
        skippedObjectCount += 1;
        await queueRawObject('Record', xml, attributes, metadata);
        return;
      }

      const rawHash = await queueRawObject('Record', xml, attributes, metadata);
      const value = numericValue(attributes.value);
      pendingSampleRows.push({
        sourceId: 'hae',
        rawContentHash: rawHash,
        naturalKey: recordNaturalKey(type, attributes),
        metricName: type,
        startAt: start.toISOString(),
        endAt: end?.toISOString() || null,
        localDate: dateInTimeZone(start, config.timezone),
        valueNum: value,
        valueText: attributes.value ?? null,
        unit: attributes.unit || null,
        sourceName: attributes.sourceName || null,
        deviceName: attributes.device || null,
        sourceUpdatedAt: parseAppleTimestamp(attributes.creationDate)?.toISOString() || null,
        metadata: { ...attributes, ...metadata },
        rawPayload: { tag: 'Record', attributes, metadata },
      });
      normalizedObjectCount += 1;

      const numVal = value ?? Number.NaN;
      const bucket = getDailyBucket(dateStr);

      switch (type) {
        case 'HKQuantityTypeIdentifierStepCount':
          if (!isNaN(numVal)) bucket.steps += numVal;
          break;
        case 'HKQuantityTypeIdentifierDistanceWalkingRunning':
          if (!isNaN(numVal)) bucket.walkingDistanceKm += numVal;
          break;
        case 'HKQuantityTypeIdentifierDistanceCycling':
          if (!isNaN(numVal)) bucket.cyclingDistanceKm += numVal;
          break;
        case 'HKQuantityTypeIdentifierFlightsClimbed':
          if (!isNaN(numVal)) bucket.flights += numVal;
          break;
        case 'HKQuantityTypeIdentifierBasalEnergyBurned':
          if (!isNaN(numVal)) bucket.basalEnergy += numVal;
          break;
        case 'HKQuantityTypeIdentifierRestingHeartRate':
          if (!isNaN(numVal)) bucket.restingHr.push(numVal);
          break;
        case 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN':
          if (!isNaN(numVal)) bucket.hrv.push(numVal);
          break;
        case 'HKQuantityTypeIdentifierOxygenSaturation':
          if (!isNaN(numVal)) bucket.spo2.push(numVal > 1 ? numVal : numVal * 100);
          break;
        case 'HKQuantityTypeIdentifierAppleSleepingWristTemperature':
          if (!isNaN(numVal)) bucket.wristTemp.push(numVal);
          break;
        case 'HKQuantityTypeIdentifierVO2Max':
          if (!isNaN(numVal)) bucket.vo2Max.push(numVal);
          break;
        case 'HKQuantityTypeIdentifierWalkingSpeed':
          if (!isNaN(numVal)) bucket.walkingSpeed.push(numVal);
          break;
        case 'HKQuantityTypeIdentifierWalkingStepLength':
          if (!isNaN(numVal)) bucket.stepLength.push(numVal);
          break;
        case 'HKQuantityTypeIdentifierWalkingDoubleSupportPercentage':
          if (!isNaN(numVal)) bucket.doubleSupport.push(numVal < 1 ? numVal * 100 : numVal);
          break;
        case 'HKQuantityTypeIdentifierWalkingAsymmetryPercentage':
          if (!isNaN(numVal)) bucket.asymmetry.push(numVal < 1 ? numVal * 100 : numVal);
          break;
        case 'HKQuantityTypeIdentifierEnvironmentalAudioExposure':
          if (!isNaN(numVal)) bucket.envAudio.push(numVal);
          break;
        case 'HKQuantityTypeIdentifierHeadphoneAudioExposure':
          if (!isNaN(numVal)) bucket.headphoneAudio.push(numVal);
          break;
        case 'HKQuantityTypeIdentifierTimeInDaylight':
          if (!isNaN(numVal)) bucket.daylightMins += numVal;
          break;
        case 'HKCategoryTypeIdentifierMindfulSession': {
          if (end) {
            bucket.mindfulMins += Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
          }
          break;
        }
        case 'HKQuantityTypeIdentifierHeartRate': {
          if (!isNaN(numVal) && numVal >= 30 && numVal <= 230) {
            if (!dailyHrPoints.has(dateStr)) dailyHrPoints.set(dateStr, []);
            const timeMatch = attributes.startDate.match(/\s(\d{2}):(\d{2})/);
            if (timeMatch) {
              const h = parseInt(timeMatch[1], 10);
              const m = parseInt(timeMatch[2], 10);
              dailyHrPoints.get(dateStr)!.push({
                time: `${timeMatch[1]}:${timeMatch[2]}`,
                hr: Math.round(numVal),
                minuteOfDay: h * 60 + m,
              });
            }
          }
          break;
        }
        case 'HKCategoryTypeIdentifierSleepAnalysis': {
          if (end && attributes.value) {
            const durationMins = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
            const val = attributes.value;
            if (!dailySleepStages.has(dateStr)) {
              dailySleepStages.set(dateStr, {
                deep: 0,
                core: 0,
                rem: 0,
                awake: 0,
                bedTime: parseHourMinute(attributes.startDate),
                wakeTime: parseHourMinute(attributes.endDate),
              });
            }
            const sleepObj = dailySleepStages.get(dateStr)!;
            sleepObj.wakeTime = parseHourMinute(attributes.endDate);
            if (val.includes('Deep')) sleepObj.deep += durationMins;
            else if (val.includes('REM')) sleepObj.rem += durationMins;
            else if (val.includes('Awake')) sleepObj.awake += durationMins;
            else sleepObj.core += durationMins;
          }
          break;
        }
      }
    };

    const processActivitySummary = async (xml: string) => {
      const attributes = parseXmlAttributes(xml);
      await queueRawObject('ActivitySummary', xml, attributes);
      const date = attributes.dateComponents;
      if (!date) return;
      const move = parseFloat(attributes.activeEnergyBurned || '0');
      const exercise = parseFloat(attributes.appleExerciseTime || '0');
      const stand = parseFloat(attributes.appleStandHours || '0');
      if (move <= 0 && exercise <= 0 && stand <= 0) return;
      activitySummaries.set(date, {
        move,
        moveGoal: parseFloat(attributes.activeEnergyBurnedGoal || '600'),
        exercise,
        exerciseGoal: parseFloat(attributes.appleExerciseTimeGoal || '30'),
        stand,
        standGoal: parseFloat(attributes.appleStandHoursGoal || '12'),
      });
    };

    const processObject = async (tag: string, xml: string) => {
      if (tag === 'Record') {
        await processRecord(xml);
        return;
      }
      if (tag === 'ActivitySummary') {
        await processActivitySummary(xml);
        return;
      }
      const attributes = parseXmlAttributes(xml);
      const metadata = parseMetadataEntries(xml);
      const rawHash = await queueRawObject(tag, xml, attributes, metadata);
      if (tag === 'Workout') {
        processWorkout(xml, metadata, rawHash);
        const nestedRecords = xml.match(/<Record\b[^>]*\/>/g) || [];
        for (const nestedRecord of nestedRecords) {
          await processRecord(nestedRecord);
        }
      } else if (tag === 'Correlation' || tag === 'ClinicalRecord') {
        const nestedRecords = xml.match(/<Record\b[^>]*\/>/g) || [];
        for (const nestedRecord of nestedRecords) {
          await processRecord(nestedRecord);
        }
      }
    };

    let activeTag: string | null = null;
    let activeLines: string[] = [];
    for await (const line of rl) {
      if (!activeTag) {
        const tag = line.match(/^\s*<([A-Za-z0-9_:-]+)\b/)?.[1];
        if (!tag || !APPLE_HEALTH_OBJECT_TAGS.has(tag)) continue;
        if (line.includes(`</${tag}>`) || /\/>\s*$/.test(line)) {
          await processObject(tag, line);
        } else {
          activeTag = tag;
          activeLines = [line];
        }
        continue;
      }

      activeLines.push(line);
      if (line.includes(`</${activeTag}>`)) {
        const xml = activeLines.join('\n');
        const tag = activeTag;
        activeTag = null;
        activeLines = [];
        await processObject(tag, xml);
      }
    }
    await flushPending();

    function processWorkout(
      xml: string,
      metadata: Record<string, string>,
      rawHash: string
    ) {
      const attributes = parseXmlAttributes(xml);
      const dateStr = parseDateStr(attributes.startDate);
      if (!dateStr) return;

      const rawType = attributes.workoutActivityType || '';
      let category: DailySummary['workouts'][0]['category'] = 'running';
      let name = '体能训练';

      if (rawType.includes('Cycling')) {
        category = 'cycling';
        name = '户外骑行';
      } else if (rawType.includes('Strength')) {
        category = 'strength';
        name = '传统力量训练';
      } else if (rawType.includes('Walking')) {
        category = 'walking';
        name = '户外步行';
      } else if (rawType.includes('Swimming')) {
        category = 'swimming';
        name = '泳池游泳';
      } else if (rawType.includes('HighIntensityIntervalTraining') || rawType.includes('HIIT')) {
        category = 'hiit';
        name = '高强度间歇训练';
      }

      const durationMinutes = Math.max(0, Math.round(parseFloat(attributes.duration || '0')));
      const activeCalories = Math.round(parseFloat(attributes.totalEnergyBurned || '0'));
      const distanceKm =
        distanceToKm(attributes.totalDistance, attributes.totalDistanceUnit) ?? undefined;
      const avgHeartRate = metadata.HKAverageHeartRate
        ? Math.round(parseFloat(metadata.HKAverageHeartRate))
        : 0;
      const maxHeartRate = metadata.HKMaximumHeartRate
        ? Math.round(parseFloat(metadata.HKMaximumHeartRate))
        : 0;

      const gpxInfo = gpxRoutes.get(dateStr);
      const routeGpxPoints =
        (category === 'cycling' || category === 'running') && gpxInfo ? gpxInfo.points : undefined;

      if (!dailyWorkouts.has(dateStr)) dailyWorkouts.set(dateStr, []);
      const list = dailyWorkouts.get(dateStr)!;
      list.push({
        id: `w-${dateStr}-${list.length}`,
        name,
        category,
        source: 'hae',
        date: dateStr,
        startTime: parseHourMinute(attributes.startDate),
        durationMinutes,
        activeCalories,
        totalCalories: activeCalories,
        avgHeartRate,
        maxHeartRate,
        distanceKm,
        cadenceAvg: undefined,
        elevationGainM: metadata.HKElevationAscended
          ? Math.round(parseFloat(metadata.HKElevationAscended))
          : undefined,
        hrZones: { zone1: 0, zone2: 0, zone3: 0, zone4: 0, zone5: 0 },
        routeGpxPoints,
      });

      const startedAt = parseAppleTimestamp(attributes.startDate);
      const endedAt = parseAppleTimestamp(attributes.endDate);
      const sourceUpdatedAt = parseAppleTimestamp(attributes.creationDate);
      normalizedWorkouts.push({
        name,
        startedAt: startedAt?.toISOString() || null,
        endedAt: endedAt?.toISOString() || null,
        durationSec: durationToSeconds(attributes.duration, attributes.durationUnit),
        activeEnergyKcal: numericValue(attributes.totalEnergyBurned),
        distanceKm: distanceToKm(attributes.totalDistance, attributes.totalDistanceUnit),
        avgHeartRate: metadata.HKAverageHeartRate
          ? Math.round(parseFloat(metadata.HKAverageHeartRate))
          : null,
        maxHeartRate: metadata.HKMaximumHeartRate
          ? Math.round(parseFloat(metadata.HKMaximumHeartRate))
          : null,
        elevationGainM: metadata.HKElevationAscended
          ? numericValue(metadata.HKElevationAscended)
          : null,
        sourceName: attributes.sourceName || null,
        deviceName: attributes.device || null,
        sourceUpdatedAt: sourceUpdatedAt?.toISOString() || null,
        naturalKey: `workout|${name.toLowerCase()}|${startedAt?.toISOString() || dateStr}|${attributes.sourceName || ''}`,
        rawContentHash: rawHash,
        rawWorkout: { attributes, metadata },
      });
      normalizedObjectCount += 1;
    }

    // Blend with Fitdays body measurements
    const bodyRows = await pool.query(
      `SELECT to_char(measured_date, 'YYYY-MM-DD') AS measured_date,
              measured_at, weight_kg, bmi, body_fat_rate, lean_body_mass_kg,
              skeletal_muscle_rate, water_rate, visceral_fat_level, bmr_kcal,
              bone_mass_kg, protein_rate, body_age, score
       FROM body_measurements
       ORDER BY measured_at ASC`
    );

    const allTargetDates = Array.from(
      new Set([...Array.from(activitySummaries.keys()), ...Array.from(dailyMetrics.keys())])
    )
      .sort();

    if (allTargetDates.length === 0) {
      throw new Error('未在导出的健康数据中识别到有效日期记录。');
    }

    const averageOrZero = (arr: number[]): number =>
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const restingHrValues = allTargetDates.flatMap(
      (date) => dailyMetrics.get(date)?.restingHr || []
    );
    const hrvValues = allTargetDates.flatMap((date) => dailyMetrics.get(date)?.hrv || []);
    const restingHrBaseline = averageOrZero(restingHrValues);
    const hrvBaseline = averageOrZero(hrvValues);

    let totalWorkoutsCount = 0;

    try {
      await client.query(
        `DELETE FROM daily_summaries
         WHERE day < DATE '2000-01-01'
            OR (
              COALESCE((summary->'steps'->>'count')::numeric, 0) = 0
              AND COALESCE((summary->'sleep'->>'totalMinutes')::numeric, 0) = 0
              AND COALESCE((summary->'vitals'->>'latestHr')::numeric, 0) = 0
              AND jsonb_array_length(COALESCE(summary->'workouts', '[]'::jsonb)) = 0
              AND COALESCE((summary->'body'->>'weightKg')::numeric, 0) = 0
            )`
      );
      const workoutHashes = normalizedWorkouts.map((workout) => workout.rawContentHash);
      const rawWorkoutRows =
        workoutHashes.length > 0
          ? await client.query<{ id: string; content_hash: string }>(
              `SELECT id, content_hash
               FROM health_raw_records
               WHERE source_id = 'hae' AND object_type = 'Workout'
                 AND content_hash = ANY($1::text[])`,
              [workoutHashes]
            )
          : { rows: [] };
      const rawWorkoutIdByHash = new Map(
        rawWorkoutRows.rows.map((row) => [row.content_hash, Number(row.id)])
      );

      for (const workout of normalizedWorkouts) {
        await client.query(
          `INSERT INTO health_workouts
            (import_id, fingerprint, natural_key, source_id, name, started_at, ended_at,
             duration_sec, active_energy_kcal, distance_km, avg_heart_rate, max_heart_rate,
             elevation_gain_m, source_name, device_name, source_updated_at,
             raw_record_id, raw_workout)
           VALUES ($1, $2, $3, 'hae', $4, $5, $6, $7, $8, $9, $10, $11, $12,
                   $13, $14, $15, $16, $17::jsonb)
           ON CONFLICT (source_id, natural_key) DO UPDATE SET
             import_id = EXCLUDED.import_id,
             fingerprint = EXCLUDED.fingerprint,
             name = EXCLUDED.name,
             started_at = EXCLUDED.started_at,
             ended_at = EXCLUDED.ended_at,
             duration_sec = EXCLUDED.duration_sec,
             active_energy_kcal = EXCLUDED.active_energy_kcal,
             distance_km = EXCLUDED.distance_km,
             avg_heart_rate = EXCLUDED.avg_heart_rate,
             max_heart_rate = EXCLUDED.max_heart_rate,
             elevation_gain_m = EXCLUDED.elevation_gain_m,
             source_name = EXCLUDED.source_name,
             device_name = EXCLUDED.device_name,
             source_updated_at = EXCLUDED.source_updated_at,
             raw_record_id = EXCLUDED.raw_record_id,
             raw_workout = EXCLUDED.raw_workout`,
          [
            haeImportId,
            contentHash(workout.rawWorkout),
            workout.naturalKey,
            workout.name,
            workout.startedAt,
            workout.endedAt,
            workout.durationSec,
            workout.activeEnergyKcal,
            workout.distanceKm,
            workout.avgHeartRate,
            workout.maxHeartRate,
            workout.elevationGainM,
            workout.sourceName,
            workout.deviceName,
            workout.sourceUpdatedAt,
            rawWorkoutIdByHash.get(workout.rawContentHash) || null,
            JSON.stringify(workout.rawWorkout),
          ]
        );
      }

      for (const dateStr of allTargetDates) {
        const dayInfo = getDayInfo(dateStr);
        const ringsRaw = activitySummaries.get(dateStr);
        const metrics = dailyMetrics.get(dateStr) || getDailyBucket(dateStr);
        const workouts = dailyWorkouts.get(dateStr) || [];
        totalWorkoutsCount += workouts.length;
        const sleepRaw = dailySleepStages.get(dateStr);

        const moveCal = ringsRaw
          ? Math.round(ringsRaw.move)
          : Math.round(workouts.reduce((a, b) => a + b.activeCalories, 0));
        const moveGoal = ringsRaw ? Math.round(ringsRaw.moveGoal) : 600;
        const exMins = ringsRaw
          ? Math.round(ringsRaw.exercise)
          : Math.round(workouts.reduce((a, b) => a + b.durationMinutes, 0));
        const exGoal = ringsRaw ? Math.round(ringsRaw.exerciseGoal) : 30;
        const standHrs = ringsRaw ? Math.round(ringsRaw.stand) : 0;
        const standGoal = ringsRaw ? Math.round(ringsRaw.standGoal) : 12;

        const rings = {
          move: {
            current: moveCal,
            goal: moveGoal,
            unit: '千卡',
            color: '#FA114F',
            bgTrack: 'rgba(250, 17, 79, 0.2)',
          },
          exercise: {
            current: exMins,
            goal: exGoal,
            unit: '分钟',
            color: '#A1FF00',
            bgTrack: 'rgba(161, 255, 0, 0.2)',
          },
          stand: {
            current: standHrs,
            goal: standGoal,
            unit: '小时',
            color: '#00F5D4',
            bgTrack: 'rgba(0, 245, 212, 0.2)',
          },
        };

        const restingHr = Math.round(averageOrZero(metrics.restingHr));
        const hrvCurrent = Math.round(averageOrZero(metrics.hrv));
        const spo2 = Math.round(averageOrZero(metrics.spo2));
        const wristTempAbs = parseFloat(averageOrZero(metrics.wristTemp).toFixed(2));
        const vo2MaxValue = averageOrZero(metrics.vo2Max);
        const vo2Max = vo2MaxValue > 0 ? parseFloat(vo2MaxValue.toFixed(1)) : undefined;

        const rawHr = dailyHrPoints.get(dateStr) || [];
        const hrTimeline: { time: string; hr: number; isWorkout?: boolean }[] = [];
        rawHr.sort((a, b) => a.minuteOfDay - b.minuteOfDay);
        const hrStep = Math.max(1, Math.floor(rawHr.length / 240));
        for (let i = 0; i < rawHr.length; i += hrStep) {
          hrTimeline.push({
            time: rawHr[i].time,
            hr: rawHr[i].hr,
            isWorkout: rawHr[i].hr > 130,
          });
        }

        const vitals = {
          latestHr: hrTimeline[hrTimeline.length - 1]?.hr || 0,
          restingHr,
          restingHrTrend: allTargetDates
            .filter((date) => date <= dateStr)
            .map((date) => dailyMetrics.get(date)?.restingHr || [])
            .filter((values) => values.length > 0)
            .map((values) => Math.round(averageOrZero(values)))
            .slice(-7),
          sleepingHr: 0,
          walkingHrAvg: 0,
          hrvCurrent,
          hrvBaseline: Math.round(hrvBaseline),
          hrvTrend: allTargetDates
            .filter(
              (date) =>
                date <= dateStr && ((dailyMetrics.get(date)?.hrv || []).length || 0) > 0
            )
            .map((date) => ({
              date: date.slice(5),
              hrv: Math.round(averageOrZero(dailyMetrics.get(date)?.hrv || [])),
            }))
            .slice(-14),
          spo2,
          respiratoryRate: 0,
          wristTemperatureDiff: 0,
          wristTemperatureAbs: wristTempAbs > 0 ? wristTempAbs : undefined,
          vo2Max,
        };

        const deepMins = sleepRaw?.deep || 0;
        const coreMins = sleepRaw?.core || 0;
        const remMins = sleepRaw?.rem || 0;
        const awakeMins = sleepRaw?.awake || 0;
        const totalSleepMins = deepMins + coreMins + remMins;
        const inBedMins = totalSleepMins + awakeMins;
        const deepPct =
          totalSleepMins > 0
            ? parseFloat(((deepMins / totalSleepMins) * 100).toFixed(1))
            : 0;
        const sleepEfficiency =
          inBedMins > 0 ? Math.round((totalSleepMins / inBedMins) * 100) : 0;
        const sleepScore =
          totalSleepMins > 0
            ? Math.min(
                99,
                Math.max(
                  0,
                  Math.round(
                    sleepEfficiency * 0.55 +
                      Math.min(deepPct / 20, 1) * 25 +
                      Math.min(totalSleepMins / 480, 1) * 20
                  )
                )
              )
            : 0;

        const sleep: DailySummary['sleep'] = {
          score: sleepScore,
          bedTime: sleepRaw?.bedTime || '--:--',
          wakeTime: sleepRaw?.wakeTime || '--:--',
          totalMinutes: totalSleepMins,
          inBedMinutes: inBedMins,
          efficiency: sleepEfficiency,
          stages: { awake: awakeMins, rem: remMins, core: coreMins, deep: deepMins },
          timeline: [],
          respiratoryRate: 0,
          hrvSleepAvg: 0,
          deepSleepPercent: deepPct,
          breathingDisturbances: 0,
        };

        const mobility = {
          walkingSpeedKmH: parseFloat(averageOrZero(metrics.walkingSpeed).toFixed(2)),
          stepLengthCm: parseFloat(averageOrZero(metrics.stepLength).toFixed(1)),
          doubleSupportPercent: parseFloat(averageOrZero(metrics.doubleSupport).toFixed(1)),
          asymmetryPercent: parseFloat(averageOrZero(metrics.asymmetry).toFixed(1)),
          stairSpeedUpMs: 0,
          stairSpeedDownMs: 0,
          sixMinWalkDistanceM: 0,
          walkingHrAvg: 0,
        };

        const environmentalAudioDb = parseFloat(averageOrZero(metrics.envAudio).toFixed(1));
        const environment = {
          environmentalAudioDb,
          headphoneAudioDb: parseFloat(averageOrZero(metrics.headphoneAudio).toFixed(1)),
          timeInDaylightMin: Math.round(metrics.daylightMins),
          audioHealthStatus:
            environmentalAudioDb > 0 && environmentalAudioDb < 65
              ? '声级处于日常安全范围'
              : environmentalAudioDb > 0
                ? '环境声级偏高'
                : '暂无环境数据',
        };

        const matchedBody = bodyRows.rows.filter((r) => r.measured_date <= dateStr).slice(-1)[0];
        const recentBodyTrend = bodyRows.rows
          .filter((r) => r.measured_date <= dateStr)
          .filter((r) => r.weight_kg !== null && r.body_fat_rate !== null)
          .slice(-8)
          .map((r) => ({
            date: r.measured_date.slice(5),
            weight: numberOrNull(r.weight_kg) || 0,
            bodyFat: numberOrNull(r.body_fat_rate) || 0,
          }));

        const weightVal = matchedBody ? numberOrNull(matchedBody.weight_kg) || 0 : 0;
        const fatVal = matchedBody ? numberOrNull(matchedBody.body_fat_rate) || 0 : 0;
        const leanVal =
          (matchedBody ? numberOrNull(matchedBody.lean_body_mass_kg) : null) ??
          (weightVal > 0 && fatVal > 0
            ? Number((weightVal * (1 - fatVal / 100)).toFixed(2))
            : 0);
        const bmiVal = matchedBody ? numberOrNull(matchedBody.bmi) || 0 : 0;
        const skeletalMuscleRate = matchedBody
          ? numberOrNull(matchedBody.skeletal_muscle_rate) || 0
          : 0;

        const body = {
          weightKg: weightVal,
          bodyFatPercent: fatVal,
          leanMassKg: leanVal,
          bmi: bmiVal,
          fatMassKg: Number((weightVal * (fatVal / 100)).toFixed(2)),
          skeletalMuscleKg: Number((weightVal * (skeletalMuscleRate / 100)).toFixed(2)),
          skeletalMusclePercent: skeletalMuscleRate > 0 ? skeletalMuscleRate : undefined,
          waterPercent: matchedBody
            ? numberOrNull(matchedBody.water_rate) ?? undefined
            : undefined,
          visceralFatLevel: matchedBody
            ? numberOrNull(matchedBody.visceral_fat_level) ?? undefined
            : undefined,
          bmrKcal: matchedBody
            ? Math.round(numberOrNull(matchedBody.bmr_kcal) || 0) || undefined
            : undefined,
          boneMassKg: matchedBody
            ? numberOrNull(matchedBody.bone_mass_kg) ?? undefined
            : undefined,
          proteinPercent: matchedBody
            ? numberOrNull(matchedBody.protein_rate) ?? undefined
            : undefined,
          bodyAge: matchedBody?.body_age ?? undefined,
          bodyScore: matchedBody
            ? numberOrNull(matchedBody.score) ?? undefined
            : undefined,
          statusLabel:
            weightVal <= 0 || fatVal <= 0
              ? '等待体测数据'
              : fatVal < 20
              ? '体型精壮 · 骨骼肌卓越'
              : fatVal <= 24
                ? '健康标准 · 骨骼肌充沛'
                : '肌肉型超重',
          trend:
            recentBodyTrend,
        };

        const hasCompleteVitalityInputs =
          hrvCurrent > 0 && restingHr > 0 && sleepScore > 0;
        const hrvDiffPct =
          hasCompleteVitalityInputs && hrvBaseline > 0
            ? Math.round(((hrvCurrent - hrvBaseline) / hrvBaseline) * 100)
            : 0;
        const restingHrDiff =
          hasCompleteVitalityInputs && restingHrBaseline > 0
            ? Math.round(restingHr - restingHrBaseline)
            : 0;
        const vitalityScore = hasCompleteVitalityInputs
          ? Math.min(
              99,
              Math.max(
                0,
                Math.round(
                  72 -
                    restingHrDiff * 1.5 +
                    hrvDiffPct * 0.3 +
                    (sleepEfficiency - 85) * 0.35
                )
              )
            )
          : 0;
        const vitalityLabel: VitalityScore['label'] =
          !hasCompleteVitalityInputs
            ? '数据不足'
            : vitalityScore >= 90
              ? '优异'
              : vitalityScore >= 80
                ? '充沛'
                : vitalityScore >= 70
                  ? '良好'
                  : vitalityScore >= 60
                    ? '轻度疲倦'
                    : '需休整';
        const hrvStatus: VitalityScore['hrvStatus'] =
          !hasCompleteVitalityInputs
            ? '数据不足'
            : hrvDiffPct > 5
              ? '高于基线'
              : hrvDiffPct < -5
                ? '低于基线'
                : '正常基线';
        const stressLevel: VitalityScore['stressLevel'] =
          !hasCompleteVitalityInputs
            ? '数据不足'
            : hrvCurrent >= Math.max(hrvBaseline * 1.05, hrvBaseline)
              ? '低压力'
              : '适中';

        const vitality: VitalityScore = {
          score: vitalityScore,
          label: vitalityLabel,
          statusDescription: hasCompleteVitalityInputs
            ? `基于当日静息心率 ${restingHr} bpm、HRV ${hrvCurrent} ms 与睡眠效率 ${sleepEfficiency}% 计算，仅用于趋势参考。`
            : '当天缺少完整的静息心率、HRV 或睡眠数据，暂不生成状态评分。',
          hrvStatus,
          restingHrDiff,
          sleepContribution: sleepEfficiency,
          stressLevel,
        };

        const dailySummary: DailySummary = {
          date: dateStr,
          dayName: dayInfo.dayName,
          shortDay: dayInfo.shortDay,
          isToday:
            dateStr ===
            new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone }).format(new Date()),
          rings,
          vitality,
          sleep,
          vitals,
          heartRateTimeline: hrTimeline,
          workouts,
          steps: {
            count: Math.round(metrics.steps),
            goal: 10000,
            distanceKm: parseFloat(metrics.walkingDistanceKm.toFixed(2)),
            flightsClimbed: Math.round(metrics.flights),
          },
          body,
          mobility,
          environment,
          cyclingDistanceKm: parseFloat((metrics.cyclingDistanceKm || 0).toFixed(2)),
          basalEnergyKcal: Math.round(metrics.basalEnergy),
          totalBurnedKcal: moveCal + Math.round(metrics.basalEnergy),
          physicalEffortAvg: 0,
          mindfulMinutes: metrics.mindfulMins,
        };

        await client.query(
          `INSERT INTO daily_summaries
             (day, summary, hae_import_id, import_batch_id, updated_at)
           VALUES ($1, $2::jsonb, $3, $4, NOW())
           ON CONFLICT (day) DO UPDATE SET
             summary = EXCLUDED.summary,
             hae_import_id = EXCLUDED.hae_import_id,
             import_batch_id = EXCLUDED.import_batch_id,
             updated_at = NOW()`,
          [dateStr, JSON.stringify(dailySummary), haeImportId, batchId]
        );
      }

      await client.query(
        `UPDATE hae_imports
         SET date_from = $2, date_to = $3, metric_count = $4, workout_count = $5,
             daily_summary_count = $6, batch_id = $7
         WHERE id = $1`,
        [
          haeImportId,
          allTargetDates[0],
          allTargetDates[allTargetDates.length - 1],
          normalizedObjectCount - normalizedWorkouts.length,
          normalizedWorkouts.length,
          allTargetDates.length,
          batchId,
        ]
      );

      if (archiveId) {
        await client.query(
          `UPDATE source_archive_files
           SET record_count = $2,
               metadata = metadata || $3::jsonb
           WHERE id = $1`,
          [
            archiveId,
            rawObjectCount,
            JSON.stringify({
              dateFrom: allTargetDates[0],
              dateTo: allTargetDates[allTargetDates.length - 1],
              totalDays: allTargetDates.length,
              rawRecordCount: rawObjectCount,
              normalizedCount: normalizedObjectCount,
              skippedCount: skippedObjectCount,
            }),
          ]
        );
      }

      const storedCounts = await client.query<{
        sample_count: string;
        workout_count: string;
      }>(
        `SELECT
           (SELECT COUNT(*)::text FROM health_samples WHERE batch_id = $1) AS sample_count,
           (SELECT COUNT(*)::text FROM health_workouts WHERE import_id = $2) AS workout_count`,
        [batchId, haeImportId]
      );
      normalizedObjectCount =
        Number(storedCounts.rows[0]?.sample_count || 0) +
        Number(storedCounts.rows[0]?.workout_count || 0);

      if (batchId) {
        await completeImportBatch(client, batchId, {
          rawCount: rawObjectCount,
          normalizedCount: normalizedObjectCount,
          skippedCount: skippedObjectCount,
          metadata: {
            dateFrom: allTargetDates[0],
            dateTo: allTargetDates[allTargetDates.length - 1],
            validDays: allTargetDates.length,
            workoutCount: normalizedWorkouts.length,
          },
        });
      }

      await client.query(
        `UPDATE data_sources
         SET last_sync_at = NOW(), last_success_at = NOW(), last_error = NULL, updated_at = NOW()
         WHERE id = 'hae'`
      );

      await client.query('COMMIT');
    } catch (dbErr) {
      await client.query('ROLLBACK');
      if (batchId) {
        await failImportBatch(client, batchId, dbErr).catch(() => undefined);
      }
      throw dbErr;
    }

    return {
      ok: true,
      importedDays: allTargetDates.length,
      earliestDate: allTargetDates[0],
      latestDate: allTargetDates[allTargetDates.length - 1],
      totalWorkouts: totalWorkoutsCount,
      rawRecordCount: rawObjectCount,
      normalizedRecordCount: normalizedObjectCount,
      archivePath: archive.relativePath,
      archiveSizeBytes: archive.sizeBytes,
    };
  } catch (error) {
    if (libraryClient && libraryBatchId) {
      await libraryClient.query('ROLLBACK').catch(() => undefined);
      await failImportBatch(libraryClient, libraryBatchId, error).catch(() => undefined);
    }
    throw error;
  } finally {
    libraryClient?.release();
    // Clean up temporary extraction folder
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
