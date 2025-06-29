# ------------------------------------------------------------------------------
# EventBridge Scheduler Rule
# ------------------------------------------------------------------------------
resource "aws_scheduler_schedule" "daily_cleanup" {
  name       = "zebra-app-daily-cleanup-schedule"
  group_name = "default" # Can specify a custom group if needed

  flexible_time_window {
    mode = "OFF" # Exact time
  }

  schedule_expression = "cron(0 0 * * ? *)" # Every day at 00:00 UTC
  schedule_expression_timezone = "UTC"

  target {
    arn      = aws_lambda_function.dummy_eventbridge_target.arn
    role_arn = aws_iam_role.lambda_exec.arn
    input    = jsonencode({ "message" = "Daily cleanup trigger" }) # Example input
  }

}
