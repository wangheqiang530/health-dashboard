import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import AdmZip from 'adm-zip';
import type { DailySummary, VitalityScore } from '../src/types/health.ts';
import { archiveZip, registerArchive, type ArchiveFile } from './archive.ts';
import { config } from './config.ts';
import { pool } from './db.ts';

export interface AppleHealthZipResult {
  ok: true;
  importedDays: number;
  earliestDate: string;
  latestDate: string;
  totalWorkouts: number;
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

    let inWorkout = false;
    let currentWorkoutAttrs: string | null = null;
    let currentWorkoutMetadata: Record<string, string> = {};
    let lineCount = 0;

    for await (const line of rl) {
      lineCount++;
      if (line.includes('<ActivitySummary ')) {
        const dateMatch = line.match(/dateComponents="([^"]+)"/);
        if (dateMatch) {
          const dStr = dateMatch[1];
          const moveMatch = line.match(/activeEnergyBurned="([^"]+)"/);
          const moveGoalMatch = line.match(/activeEnergyBurnedGoal="([^"]+)"/);
          const exMatch = line.match(/appleExerciseTime="([^"]+)"/);
          const exGoalMatch = line.match(/appleExerciseTimeGoal="([^"]+)"/);
          const standMatch = line.match(/appleStandHours="([^"]+)"/);
          const standGoalMatch = line.match(/appleStandHoursGoal="([^"]+)"/);

          activitySummaries.set(dStr, {
            move: parseFloat(moveMatch?.[1] || '0'),
            moveGoal: parseFloat(moveGoalMatch?.[1] || '600'),
            exercise: parseFloat(exMatch?.[1] || '0'),
            exerciseGoal: parseFloat(exGoalMatch?.[1] || '30'),
            stand: parseFloat(standMatch?.[1] || '0'),
            standGoal: parseFloat(standGoalMatch?.[1] || '12'),
          });
        }
        continue;
      }

      if (line.includes('<Workout ') || line.includes('<Workout>')) {
        inWorkout = true;
        currentWorkoutAttrs = line;
        currentWorkoutMetadata = {};
        if (line.endsWith('/>')) {
          inWorkout = false;
          processWorkout(currentWorkoutAttrs, currentWorkoutMetadata);
        }
        continue;
      } else if (inWorkout) {
        if (line.includes('<MetadataEntry ')) {
          const kMatch = line.match(/key="([^"]+)"/);
          const vMatch = line.match(/value="([^"]+)"/);
          if (kMatch && vMatch) {
            currentWorkoutMetadata[kMatch[1]] = vMatch[1];
          }
        }
        if (line.includes('</Workout>')) {
          inWorkout = false;
          processWorkout(currentWorkoutAttrs, currentWorkoutMetadata);
        }
        continue;
      }

      if (!line.includes('<Record ')) continue;

      const typeMatch = line.match(/type="([^"]+)"/);
      if (!typeMatch) continue;
      const type = typeMatch[1];

      const startMatch = line.match(/startDate="([^"]+)"/);
      if (!startMatch) continue;
      const dateStr = parseDateStr(startMatch[1]);
      if (!dateStr) continue;

      const valMatch = line.match(/value="([^"]+)"/);
      const numVal = valMatch ? parseFloat(valMatch[1]) : NaN;
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
          const endMatch = line.match(/endDate="([^"]+)"/);
          if (endMatch) {
            const diffMs = new Date(endMatch[1]).getTime() - new Date(startMatch[1]).getTime();
            bucket.mindfulMins += Math.max(1, Math.round(diffMs / 60000));
          }
          break;
        }
        case 'HKQuantityTypeIdentifierHeartRate': {
          if (!isNaN(numVal) && numVal >= 30 && numVal <= 230) {
            if (!dailyHrPoints.has(dateStr)) dailyHrPoints.set(dateStr, []);
            const timeMatch = startMatch[1].match(/\s(\d{2}):(\d{2})/);
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
          const endMatch = line.match(/endDate="([^"]+)"/);
          if (endMatch && valMatch) {
            const start = new Date(startMatch[1]);
            const end = new Date(endMatch[1]);
            const durationMins = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
            const val = valMatch[1];
            if (!dailySleepStages.has(dateStr)) {
              dailySleepStages.set(dateStr, {
                deep: 0,
                core: 0,
                rem: 0,
                awake: 0,
                bedTime: parseHourMinute(startMatch[1]),
                wakeTime: parseHourMinute(endMatch[1]),
              });
            }
            const sleepObj = dailySleepStages.get(dateStr)!;
            sleepObj.wakeTime = parseHourMinute(endMatch[1]);
            if (val.includes('Deep')) sleepObj.deep += durationMins;
            else if (val.includes('REM')) sleepObj.rem += durationMins;
            else if (val.includes('Awake')) sleepObj.awake += durationMins;
            else sleepObj.core += durationMins;
          }
          break;
        }
      }
    }

    function processWorkout(attrs: string | null, metadata: Record<string, string>) {
      if (!attrs) return;
      const startMatch = attrs.match(/startDate="([^"]+)"/);
      if (!startMatch) return;
      const dateStr = parseDateStr(startMatch[1]);
      if (!dateStr) return;

      const typeMatch = attrs.match(/workoutActivityType="([^"]+)"/);
      const durMatch = attrs.match(/duration="([^"]+)"/);
      const energyMatch = attrs.match(/totalEnergyBurned="([^"]+)"/);
      const distMatch = attrs.match(/totalDistance="([^"]+)"/);

      const rawType = typeMatch?.[1] || '';
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

      const durationMinutes = Math.max(0, Math.round(parseFloat(durMatch?.[1] || '0')));
      const activeCalories = Math.round(parseFloat(energyMatch?.[1] || '0'));
      const distanceKm = distMatch ? parseFloat(parseFloat(distMatch[1]).toFixed(2)) : undefined;
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
        startTime: parseHourMinute(startMatch[1]),
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

    const client = await pool.connect();
    let totalWorkoutsCount = 0;

    try {
      await client.query('BEGIN');
      await registerArchive(
        client,
        archive,
        'hae',
        'apple-health-export',
        allTargetDates.length,
        {
          source: 'Apple Health Export Zip',
          dateFrom: allTargetDates[0],
          dateTo: allTargetDates[allTargetDates.length - 1],
          totalDays: allTargetDates.length,
          filename: originalFilename || 'export.zip',
        }
      );

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
          `INSERT INTO daily_summaries (day, summary, updated_at)
           VALUES ($1, $2::jsonb, NOW())
           ON CONFLICT (day) DO UPDATE SET
             summary = EXCLUDED.summary,
             updated_at = NOW()`,
          [dateStr, JSON.stringify(dailySummary)]
        );
      }

      await client.query(
        `UPDATE data_sources
         SET last_sync_at = NOW(), last_success_at = NOW(), last_error = NULL, updated_at = NOW()
         WHERE id = 'hae'`
      );

      await client.query('COMMIT');
    } catch (dbErr) {
      await client.query('ROLLBACK');
      throw dbErr;
    } finally {
      client.release();
    }

    return {
      ok: true,
      importedDays: allTargetDates.length,
      earliestDate: allTargetDates[0],
      latestDate: allTargetDates[allTargetDates.length - 1],
      totalWorkouts: totalWorkoutsCount,
      archivePath: archive.relativePath,
      archiveSizeBytes: archive.sizeBytes,
    };
  } finally {
    // Clean up temporary extraction folder
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
