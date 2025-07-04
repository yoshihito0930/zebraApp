# ------------------------------------------------------------------------------
# Dummy Lambda Function for EventBridge Target
# ------------------------------------------------------------------------------
resource "aws_lambda_function" "dummy_eventbridge_target" {
  function_name = "zebra-app-dummy-eventbridge-target"
  handler       = "index.handler" # Placeholder handler
  runtime       = "nodejs18.x"    # Example runtime
  role          = aws_iam_role.lambda_exec.arn

  # A minimal deployment package (empty zip)
  # In a real scenario, this would be your actual Lambda code
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  tags = {
    Name = "zebra-app-dummy-eventbridge-target"
  }
}

# ------------------------------------------------------------------------------
# DynamoDB Stream Processor Lambda Function
# ------------------------------------------------------------------------------
resource "aws_lambda_function" "booking_stream_processor" {
  function_name = "zebra-app-booking-stream-processor"
  handler       = "booking/streamProcessor.handler"
  runtime       = "nodejs18.x"
  role          = aws_iam_role.lambda_exec.arn
  timeout       = 300 # 5分タイムアウト（ストリーム処理用）
  memory_size   = 512 # メモリ使用量を増加

  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256

  environment {
    variables = {
      BOOKINGS_TABLE      = aws_dynamodb_table.bookings.name
      NOTIFICATIONS_TABLE = aws_dynamodb_table.notifications.name
      CALENDAR_TABLE      = aws_dynamodb_table.calendar.name
      OPTIONS_TABLE       = aws_dynamodb_table.options.name
      USERS_TABLE         = aws_dynamodb_table.users.name
    }
  }

  # デッドレターキュー設定
  dead_letter_config {
    target_arn = aws_sqs_queue.stream_processor_dlq.arn
  }

  tags = {
    Name = "zebra-app-booking-stream-processor"
  }
}

# ------------------------------------------------------------------------------
# SQS Dead Letter Queue for Stream Processor
# ------------------------------------------------------------------------------
resource "aws_sqs_queue" "stream_processor_dlq" {
  name = "zebra-app-booking-stream-processor-dlq"
  
  message_retention_seconds = 1209600 # 14日間保持
  
  tags = {
    Name = "zebra-app-booking-stream-processor-dlq"
  }
}

# ------------------------------------------------------------------------------
# DynamoDB Stream Event Source Mapping
# ------------------------------------------------------------------------------
resource "aws_lambda_event_source_mapping" "booking_stream" {
  event_source_arn  = aws_dynamodb_table.bookings.stream_arn
  function_name     = aws_lambda_function.booking_stream_processor.arn
  starting_position = "LATEST"
  
  # バッチサイズとタイムアウト設定
  batch_size        = 10
  maximum_batching_window_in_seconds = 5
  
  # 並行処理設定
  parallelization_factor = 2
  
  # エラーハンドリング設定
  maximum_retry_attempts = 3
  maximum_record_age_in_seconds = 3600 # 1時間
  
  # 分割処理失敗時の設定
  tumbling_window_in_seconds = 30
  
  depends_on = [
    aws_lambda_function.booking_stream_processor,
    aws_dynamodb_table.bookings
  ]
}

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_src"
  output_path = "${path.module}/lambda-functions.zip"
}
