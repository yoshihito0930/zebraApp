# This file is for defining output values.

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.frontend_distribution.domain_name
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.frontend_distribution.id
}

output "s3_bucket_name" {
  value = aws_s3_bucket.frontend_hosting.bucket
}
