-- インデックスを削除
DROP INDEX IF EXISTS idx_booking_status_logs_booking_id;
DROP INDEX IF EXISTS idx_booking_options_booking_id;
DROP INDEX IF EXISTS idx_notifications_is_read;
DROP INDEX IF EXISTS idx_notifications_user_id;
DROP INDEX IF EXISTS idx_bookings_booking_type;
DROP INDEX IF EXISTS idx_bookings_status;
DROP INDEX IF EXISTS idx_bookings_end_time;
DROP INDEX IF EXISTS idx_bookings_start_time;
DROP INDEX IF EXISTS idx_bookings_user_id;

-- テーブルを削除（依存関係の順序に注意）
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS booking_status_logs;
DROP TABLE IF EXISTS booking_options;
DROP TABLE IF EXISTS options;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS user_terms_agreements;
DROP TABLE IF EXISTS terms_of_service;
DROP TABLE IF EXISTS users;

-- 拡張機能を削除（必要な場合のみ）
-- DROP EXTENSION IF EXISTS "uuid-ossp";
