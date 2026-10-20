-- Clean up 0 values in body_measurements resulting from weight-only / uncalculated scale sync
UPDATE body_measurements
SET body_fat_rate = NULL
WHERE body_fat_rate = 0;

UPDATE body_measurements
SET skeletal_muscle_rate = NULL
WHERE skeletal_muscle_rate = 0;

UPDATE body_measurements
SET muscle_rate = NULL
WHERE muscle_rate = 0;

UPDATE body_measurements
SET water_rate = NULL
WHERE water_rate = 0;

UPDATE body_measurements
SET visceral_fat_level = NULL
WHERE visceral_fat_level = 0;

UPDATE body_measurements
SET bmr_kcal = NULL
WHERE bmr_kcal = 0;

UPDATE body_measurements
SET bone_mass_kg = NULL
WHERE bone_mass_kg = 0;

UPDATE body_measurements
SET protein_rate = NULL
WHERE protein_rate = 0;

UPDATE body_measurements
SET subcutaneous_fat_rate = NULL
WHERE subcutaneous_fat_rate = 0;

UPDATE body_measurements
SET score = NULL
WHERE score = 0;

UPDATE body_measurements
SET bmi = ROUND((weight_kg / (1.84 * 1.84))::numeric, 1)
WHERE (bmi = 0 OR bmi IS NULL) AND weight_kg > 0;
