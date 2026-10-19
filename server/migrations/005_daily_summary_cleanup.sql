DELETE FROM daily_summaries
WHERE day < DATE '2000-01-01'
   OR NOT (
     COALESCE(NULLIF(summary->'rings'->'move'->>'current', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'rings'->'exercise'->>'current', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'rings'->'stand'->>'current', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'steps'->>'count', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'sleep'->>'totalMinutes', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'vitals'->>'latestHr', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'vitals'->>'restingHr', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'vitals'->>'hrvCurrent', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'vitals'->>'spo2', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'vitals'->>'respiratoryRate', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'vitals'->>'wristTemperatureAbs', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'vitals'->>'vo2Max', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'body'->>'weightKg', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'body'->>'bodyFatPercent', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'body'->>'leanMassKg', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'body'->>'skeletalMuscleKg', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'mobility'->>'walkingSpeedKmh', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'mobility'->>'walkingSpeedKmH', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'mobility'->>'stepLengthCm', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'mobility'->>'doubleSupportPercent', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'mobility'->>'asymmetryPercent', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'mobility'->>'stairSpeedUpMs', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'mobility'->>'stairSpeedDownMs', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'mobility'->>'sixMinWalkDistanceM', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'mobility'->>'walkingHrAvg', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'environment'->>'environmentalAudioDb', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'environment'->>'headphoneAudioDb', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->'environment'->>'timeInDaylightMin', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->>'cyclingDistanceKm', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->>'basalEnergyKcal', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->>'totalBurnedKcal', ''), '0')::numeric <> 0
     OR COALESCE(NULLIF(summary->>'mindfulMinutes', ''), '0')::numeric <> 0
     OR jsonb_array_length(COALESCE(summary->'workouts', '[]'::jsonb)) > 0
   );
