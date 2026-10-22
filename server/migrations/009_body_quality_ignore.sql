-- Move incomplete Fitdays measurements out of the visible body dataset.
-- Raw payloads remain in the archive/raw library and can be inspected from the ignore list.

WITH incomplete AS (
  SELECT
    source_id,
    external_id,
    to_char(measured_date, 'YYYY-MM-DD') AS measured_date,
    measured_at,
    to_jsonb(body_measurements) AS snapshot
  FROM body_measurements
  WHERE weight_kg IS NOT NULL
    AND (
      body_fat_rate IS NULL
      OR body_fat_rate <= 0
      OR skeletal_muscle_rate IS NULL
      OR skeletal_muscle_rate <= 0
      OR water_rate IS NULL
      OR water_rate <= 0
      OR bmr_kcal IS NULL
      OR bmr_kcal <= 0
      OR COALESCE(raw_record->>'adc_list', '') = ''
      OR COALESCE(raw_record->>'adc_list', '') ~ '^0(,0)+$'
    )
)
INSERT INTO data_tombstones
  (record_kind, source_id, external_id, metadata)
SELECT
  'body_measurement',
  source_id,
  external_id,
  jsonb_build_object(
    'reasonCode', 'auto_incomplete_body',
    'reason', '自动忽略：体测字段不完整，缺少体脂率、骨骼肌率、水分率、基础代谢或电极阻抗',
    'autoIgnored', TRUE,
    'measuredAt', measured_at,
    'measuredDate', measured_date,
    'snapshot', snapshot
  )
FROM incomplete
ON CONFLICT (record_kind, source_id, external_id) DO NOTHING;

DELETE FROM body_measurements
WHERE weight_kg IS NOT NULL
  AND (
    body_fat_rate IS NULL
    OR body_fat_rate <= 0
    OR skeletal_muscle_rate IS NULL
    OR skeletal_muscle_rate <= 0
    OR water_rate IS NULL
    OR water_rate <= 0
    OR bmr_kcal IS NULL
    OR bmr_kcal <= 0
    OR COALESCE(raw_record->>'adc_list', '') = ''
    OR COALESCE(raw_record->>'adc_list', '') ~ '^0(,0)+$'
  );
