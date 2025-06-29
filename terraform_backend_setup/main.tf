provider "aws" {
  region = "ap-northeast-1"
}

# S3 bucket for Terraform state
resource "aws_s3_bucket" "tfstate" {
  bucket = "zebra-app-tfstate-20250628"
}

# Enable versioning for the S3 bucket
resource "aws_s3_bucket_versioning" "tfstate_versioning" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration {
    status = "Enabled"
  }
}

# DynamoDB table for Terraform state locking
resource "aws_dynamodb_table" "tfstate_lock" {
  name           = "zebra-app-tfstate-lock"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }
}
