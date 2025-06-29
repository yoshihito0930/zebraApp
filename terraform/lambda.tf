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

data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/lambda_src"
  output_path = "${path.module}/dummy-lambda.zip"
}
