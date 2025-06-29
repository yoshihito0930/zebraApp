# ------------------------------------------------------------------------------
# IAM Role for Lambda
# ------------------------------------------------------------------------------
resource "aws_iam_role" "lambda_exec" {
  name = "zebra-app-lambda-exec-role"

  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Action    = "sts:AssumeRole"
        Effect    = "Allow"
        Principal = {
          Service = ["lambda.amazonaws.com", "scheduler.amazonaws.com"]
        }
      }
    ]
  })

  tags = {
    Name = "zebra-app-lambda-exec-role"
  }
}

# ------------------------------------------------------------------------------
# IAM Policy for Lambda Logging
# ------------------------------------------------------------------------------
resource "aws_iam_policy" "lambda_logging" {
  name        = "zebra-app-lambda-logging-policy"
  description = "IAM policy for logging from a Lambda function"
  policy      = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Action   = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Effect   = "Allow"
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# Attach Logging Policy to Lambda Role
# ------------------------------------------------------------------------------
resource "aws_iam_role_policy_attachment" "lambda_logs" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_logging.arn
}

# ------------------------------------------------------------------------------
# IAM Policy for EventBridge Scheduler
# ------------------------------------------------------------------------------
resource "aws_iam_policy" "eventbridge_scheduler_invoke_lambda" {
  name        = "zebra-app-eventbridge-scheduler-invoke-lambda-policy"
  description = "IAM policy for EventBridge Scheduler to invoke Lambda functions"
  policy      = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Action    = "lambda:InvokeFunction"
        Resource  = aws_lambda_function.dummy_eventbridge_target.arn
      },
      {
        Effect    = "Allow"
        Action    = "iam:PassRole"
        Resource  = aws_iam_role.lambda_exec.arn
        Condition = {
          StringEquals = {
            "iam:PassedToService" = "scheduler.amazonaws.com"
          }
        }
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# Attach EventBridge Scheduler Policy to Lambda Role
# ------------------------------------------------------------------------------
resource "aws_iam_role_policy_attachment" "eventbridge_scheduler_lambda" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.eventbridge_scheduler_invoke_lambda.arn
}
