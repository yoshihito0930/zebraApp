# ------------------------------------------------------------------------------
# S3 Bucket for Frontend Hosting
# ------------------------------------------------------------------------------
resource "aws_s3_bucket" "frontend_hosting" {
  bucket = "zebra-app-frontend-hosting" # Replace with a unique bucket name

  tags = {
    Name = "zebra-app-frontend-hosting"
  }
}

resource "aws_s3_bucket_website_configuration" "frontend_hosting" {
  bucket = aws_s3_bucket.frontend_hosting.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html" # For SPA, redirect all errors to index.html
  }
}

resource "aws_s3_bucket_public_access_block" "frontend_hosting" {
  bucket = aws_s3_bucket.frontend_hosting.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "frontend_hosting" {
  bucket = aws_s3_bucket.frontend_hosting.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect    = "Allow",
        Principal = {
          Service = "cloudfront.amazonaws.com"
        },
        Action    = "s3:GetObject",
        Resource  = "${aws_s3_bucket.frontend_hosting.arn}/*",
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend_distribution.arn
          }
        }
      }
    ]
  })
}

# ------------------------------------------------------------------------------
# S3 Bucket for Log Storage (e.g., CloudFront/S3 access logs)
# ------------------------------------------------------------------------------
resource "aws_s3_bucket" "logs" {
  bucket = "zebra-app-logs-bucket" # Replace with a unique bucket name

  tags = {
    Name = "zebra-app-logs-bucket"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    id     = "log_retention"
    status = "Enabled"

    filter {} # Apply to all objects in the bucket

    expiration {
      days = 365 # Retain logs for 1 year
    }

    noncurrent_version_expiration {
      noncurrent_days = 30 # Delete noncurrent versions after 30 days
    }
  }
}
