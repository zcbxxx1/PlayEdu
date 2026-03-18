-- PlayEdu 1.8 -> current 2.x local upgrade helper
-- Preconditions:
-- 1. Import the legacy 1.8 full SQL into a temporary database.
-- 2. Start the current 2.x app once against that database so MigrationCheck creates
--    the new 2.x tables and config rows.
-- 3. Run this script against the same database.

START TRANSACTION;

-- 0) Backfill legacy schema columns that current 2.x code expects but 1.8 tables may still miss.
-- Run this script once on a fresh 1.8 -> 2.x migration database.
ALTER TABLE `courses`
  ADD COLUMN `sort_at` timestamp NULL DEFAULT NULL COMMENT '排序时间' AFTER `created_at`,
  ADD COLUMN `extra` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '其它规则[课程设置]' AFTER `sort_at`,
  ADD COLUMN `admin_id` int(11) NOT NULL DEFAULT 0 COMMENT '管理员ID' AFTER `extra`,
  ADD COLUMN `updated_at` timestamp NULL DEFAULT NULL COMMENT '更新时间' AFTER `admin_id`,
  ADD COLUMN `deleted_at` timestamp NULL DEFAULT NULL COMMENT '删除时间' AFTER `updated_at`;

ALTER TABLE `course_hour`
  ADD COLUMN `deleted` tinyint(4) NOT NULL DEFAULT 0 COMMENT '删除标志[0:存在,1:删除]' AFTER `created_at`;

ALTER TABLE `users`
  ADD COLUMN `updated_at` timestamp NULL DEFAULT NULL COMMENT '更新时间' AFTER `created_at`;

ALTER TABLE `user_learn_duration_records`
  ADD COLUMN `from_id` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '' COMMENT '来源ID' AFTER `end_at`,
  ADD COLUMN `from_scene` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT '' COMMENT '记录来源[线上课:COURSE,学习任务:STUDY]' AFTER `from_id`;

-- 1) Copy legacy resource rows into the new resource table while preserving IDs.
INSERT INTO `resource` (
  `id`,
  `admin_id`,
  `type`,
  `name`,
  `extension`,
  `size`,
  `disk`,
  `path`,
  `parent_id`,
  `is_hidden`,
  `created_at`
)
SELECT
  old_r.`id`,
  old_r.`admin_id`,
  old_r.`type`,
  old_r.`name`,
  old_r.`extension`,
  old_r.`size`,
  old_r.`disk`,
  old_r.`path`,
  old_r.`parent_id`,
  old_r.`is_hidden`,
  old_r.`created_at`
FROM `resources` old_r
LEFT JOIN `resource` new_r ON new_r.`id` = old_r.`id`
WHERE new_r.`id` IS NULL;

-- 2) Copy legacy video metadata into the new resource_extra table.
-- Legacy poster stored a full URL; current 2.x expects the poster resource ID.
INSERT INTO `resource_extra` (
  `rid`,
  `poster`,
  `duration`,
  `subtitle_rid`,
  `subtitle_status`,
  `subtitle_lang`,
  `subtitle_error`,
  `created_at`
)
SELECT
  old_v.`rid`,
  COALESCE(poster_r.`id`, 0) AS `poster`,
  old_v.`duration`,
  0 AS `subtitle_rid`,
  'NONE' AS `subtitle_status`,
  '' AS `subtitle_lang`,
  '' AS `subtitle_error`,
  old_v.`created_at`
FROM `resource_videos` old_v
LEFT JOIN `resources` poster_r ON poster_r.`url` = old_v.`poster`
LEFT JOIN `resource_extra` new_v ON new_v.`rid` = old_v.`rid`
WHERE new_v.`rid` IS NULL;

-- 3) Migrate legacy course -> department assignment rows.
INSERT INTO `course_department_user` (
  `course_id`,
  `range_id`,
  `type`
)
SELECT
  old_cd.`course_id`,
  old_cd.`dep_id`,
  0 AS `type`
FROM `course_department` old_cd
LEFT JOIN `course_department_user` new_cd
  ON new_cd.`course_id` = old_cd.`course_id`
 AND new_cd.`range_id` = old_cd.`dep_id`
 AND new_cd.`type` = 0
WHERE new_cd.`course_id` IS NULL;

-- 4) Copy MinIO config into the current S3 config keys.
UPDATE `app_config` dst
JOIN `app_config` src ON src.`key_name` = 'minio.access_key'
SET dst.`key_value` = src.`key_value`
WHERE dst.`key_name` = 's3.access_key'
  AND COALESCE(dst.`key_value`, '') = '';

UPDATE `app_config` dst
JOIN `app_config` src ON src.`key_name` = 'minio.secret_key'
SET dst.`key_value` = src.`key_value`
WHERE dst.`key_name` = 's3.secret_key'
  AND COALESCE(dst.`key_value`, '') = '';

UPDATE `app_config` dst
JOIN `app_config` src ON src.`key_name` = 'minio.bucket'
SET dst.`key_value` = src.`key_value`
WHERE dst.`key_name` = 's3.bucket'
  AND COALESCE(dst.`key_value`, '') = '';

UPDATE `app_config` dst
JOIN `app_config` src ON src.`key_name` = 'minio.endpoint'
SET dst.`key_value` = src.`key_value`
WHERE dst.`key_name` = 's3.endpoint'
  AND COALESCE(dst.`key_value`, '') = '';

UPDATE `app_config`
SET `key_value` = 'us-east-1'
WHERE `key_name` = 's3.region'
  AND COALESCE(`key_value`, '') = '';

-- 5) Current 2.x image config values store resource IDs, not raw URLs.
UPDATE `app_config` cfg
JOIN `resources` img ON img.`url` = cfg.`key_value`
SET cfg.`key_value` = CAST(img.`id` AS CHAR)
WHERE cfg.`key_name` IN ('system.logo', 'member.default_avatar', 'player.poster')
  AND COALESCE(cfg.`key_value`, '') <> ''
  AND cfg.`key_value` NOT REGEXP '^[0-9]+$';

-- 6) Hide legacy MinIO-only config rows so the admin panel only shows current S3 config.
UPDATE `app_config`
SET `is_hidden` = 1
WHERE `key_name` LIKE 'minio.%';

COMMIT;
