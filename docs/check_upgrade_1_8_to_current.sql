-- PlayEdu 1.8 -> current fork 巡检脚本
-- 用途：
-- 1. 检查当前库是否具备当前 fork 运行所需的关键表/字段
-- 2. 检查 1.8 旧数据里需要从 URL 迁到资源 ID 的字段是否已完成转换
-- 3. 检查 S3 配置是否已切到当前 fork 使用的 s3.* 配置项

SELECT '=== 表存在性检查 ===' AS section;

SELECT 'resource' AS item, COUNT(*) AS present
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'resource'
UNION ALL
SELECT 'resource_extra' AS item, COUNT(*) AS present
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'resource_extra'
UNION ALL
SELECT 'course_department_user' AS item, COUNT(*) AS present
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_department_user'
UNION ALL
SELECT 'subtitle_tasks' AS item, COUNT(*) AS present
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subtitle_tasks'
UNION ALL
SELECT 'ldap_sync_record' AS item, COUNT(*) AS present
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ldap_sync_record'
UNION ALL
SELECT 'ldap_sync_department_detail' AS item, COUNT(*) AS present
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ldap_sync_department_detail'
UNION ALL
SELECT 'ldap_sync_user_detail' AS item, COUNT(*) AS present
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ldap_sync_user_detail';

SELECT '=== 关键字段检查 ===' AS section;

SELECT 'courses.sort_at' AS item, COUNT(*) AS present
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'sort_at'
UNION ALL
SELECT 'courses.extra' AS item, COUNT(*) AS present
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'extra'
UNION ALL
SELECT 'courses.admin_id' AS item, COUNT(*) AS present
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'admin_id'
UNION ALL
SELECT 'courses.updated_at' AS item, COUNT(*) AS present
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'updated_at'
UNION ALL
SELECT 'courses.deleted_at' AS item, COUNT(*) AS present
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'deleted_at'
UNION ALL
SELECT 'course_hour.deleted' AS item, COUNT(*) AS present
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'course_hour' AND COLUMN_NAME = 'deleted'
UNION ALL
SELECT 'users.updated_at' AS item, COUNT(*) AS present
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'updated_at'
UNION ALL
SELECT 'user_learn_duration_records.from_id' AS item, COUNT(*) AS present
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_learn_duration_records' AND COLUMN_NAME = 'from_id'
UNION ALL
SELECT 'user_learn_duration_records.from_scene' AS item, COUNT(*) AS present
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_learn_duration_records' AND COLUMN_NAME = 'from_scene'
UNION ALL
SELECT 'subtitle_tasks.queue_sort' AS item, COUNT(*) AS present
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subtitle_tasks' AND COLUMN_NAME = 'queue_sort';

SELECT '=== S3 配置检查 ===' AS section;

SELECT key_name, IF(COALESCE(key_value, '') <> '', 'OK', 'EMPTY') AS status
FROM app_config
WHERE key_name IN (
    's3.access_key',
    's3.secret_key',
    's3.bucket',
    's3.region',
    's3.endpoint'
)
ORDER BY key_name;

SELECT 'visible_legacy_minio_config' AS item, COUNT(*) AS rows_count
FROM app_config
WHERE key_name LIKE 'minio.%' AND COALESCE(is_hidden, 0) = 0;

SELECT '=== URL -> 资源ID 数据形态检查 ===' AS section;

SET @sql = (
  SELECT IF(
    COUNT(*) = 1,
    "SELECT 'users.avatar non-numeric' AS item, COUNT(*) AS bad_rows FROM `users` WHERE `avatar` IS NOT NULL AND `avatar` <> '' AND `avatar` NOT REGEXP '^[0-9]+$'",
    "SELECT 'users.avatar non-numeric' AS item, NULL AS bad_rows"
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'avatar'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 1,
    "SELECT 'courses.thumb non-numeric' AS item, COUNT(*) AS bad_rows FROM `courses` WHERE `thumb` IS NOT NULL AND `thumb` <> '' AND `thumb` NOT REGEXP '^[0-9]+$'",
    "SELECT 'courses.thumb non-numeric' AS item, NULL AS bad_rows"
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'thumb'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 1,
    "SELECT 'resource_extra.poster non-numeric' AS item, COUNT(*) AS bad_rows FROM `resource_extra` WHERE `poster` IS NOT NULL AND `poster` <> '' AND `poster` NOT REGEXP '^[0-9]+$'",
    "SELECT 'resource_extra.poster non-numeric' AS item, NULL AS bad_rows"
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'resource_extra' AND COLUMN_NAME = 'poster'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 1,
    "SELECT 'app_config image values non-numeric' AS item, COUNT(*) AS bad_rows FROM `app_config` WHERE `key_name` IN ('system.logo','member.default_avatar','player.poster') AND `key_value` IS NOT NULL AND `key_value` <> '' AND `key_value` NOT REGEXP '^[0-9]+$'",
    "SELECT 'app_config image values non-numeric' AS item, NULL AS bad_rows"
  )
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'app_config' AND COLUMN_NAME = 'key_value'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT '=== 旧表残留参考 ===' AS section;

SELECT 'resources rows' AS item, COUNT(*) AS rows_count
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'resources';

SET @sql = (
  SELECT IF(
    COUNT(*) = 1,
    "SELECT 'legacy resources actual rows' AS item, COUNT(*) AS rows_count FROM `resources`",
    "SELECT 'legacy resources actual rows' AS item, NULL AS rows_count"
  )
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'resources'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (
  SELECT IF(
    COUNT(*) = 1,
    "SELECT 'legacy resource_videos actual rows' AS item, COUNT(*) AS rows_count FROM `resource_videos`",
    "SELECT 'legacy resource_videos actual rows' AS item, NULL AS rows_count"
  )
  FROM information_schema.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'resource_videos'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT '=== 巡检说明 ===' AS section;
SELECT 'present=1 表示字段/表存在；bad_rows>0 表示仍有 1.8 旧数据未迁完；visible_legacy_minio_config>0 表示后台仍可能展示旧 minio 配置。' AS notes;
