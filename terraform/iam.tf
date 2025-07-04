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

# ------------------------------------------------------------------------------
# IAM Policy for DynamoDB Stream Processing
# ------------------------------------------------------------------------------
resource "aws_iam_policy" "dynamodb_stream_processing" {
  name        = "zebra-app-dynamodb-stream-processing-policy"
  description = "IAM policy for DynamoDB stream processing and table access"
  policy      = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:DescribeStream",
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:ListStreams"
        ]
        Resource = [
          aws_dynamodb_table.bookings.stream_arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.bookings.arn,
          aws_dynamodb_table.notifications.arn,
          aws_dynamodb_table.calendar.arn,
          aws_dynamodb_table.options.arn,
          aws_dynamodb_table.users.arn,
          "${aws_dynamodb_table.bookings.arn}/index/*",
          "${aws_dynamodb_table.notifications.arn}/index/*",
          "${aws_dynamodb_table.calendar.arn}/index/*",
          "${aws_dynamodb_table.options.arn}/index/*",
          "${aws_dynamodb_table.users.arn}/index/*"
        ]
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# IAM Policy for EventBridge Publishing
# ------------------------------------------------------------------------------
resource "aws_iam_policy" "eventbridge_publishing" {
  name        = "zebra-app-eventbridge-publishing-policy"
  description = "IAM policy for publishing events to EventBridge"
  policy      = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "events:PutEvents"
        ]
        Resource = "*"
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# IAM Policy for SQS Dead Letter Queue
# ------------------------------------------------------------------------------
resource "aws_iam_policy" "sqs_dlq_access" {
  name        = "zebra-app-sqs-dlq-access-policy"
  description = "IAM policy for SQS dead letter queue access"
  policy      = jsonencode({
    Version   = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = [
          aws_sqs_queue.stream_processor_dlq.arn
        ]
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# Attach DynamoDB Stream Processing Policy to Lambda Role
# ------------------------------------------------------------------------------
resource "aws_iam_role_policy_attachment" "lambda_dynamodb_stream" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.dynamodb_stream_processing.arn
}

# ------------------------------------------------------------------------------
# Attach EventBridge Publishing Policy to Lambda Role
# ------------------------------------------------------------------------------
resource "aws_iam_role_policy_attachment" "lambda_eventbridge_publishing" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.eventbridge_publishing.arn
}

# ------------------------------------------------------------------------------
# Attach SQS DLQ Access Policy to Lambda Role
# ------------------------------------------------------------------------------
resource "aws_iam_role_policy_attachment" "lambda_sqs_dlq" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.sqs_dlq_access.arn
}
