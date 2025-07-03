# ------------------------------------------------------------------------------
# DynamoDB Table: Users
# ------------------------------------------------------------------------------
resource "aws_dynamodb_table" "users" {
  name             = "studio-booking-users"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "PK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  global_secondary_index {
    name               = "EmailIndex"
    hash_key           = "email"
    projection_type    = "ALL"
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "UsersTable"
    Environment = "production"
    Project     = "StudioBooking"
  }

  point_in_time_recovery {
    enabled = true
  }
}

# ------------------------------------------------------------------------------
# DynamoDB Table: UserAgreements
# ------------------------------------------------------------------------------
resource "aws_dynamodb_table" "user_agreements" {
  name             = "studio-booking-user-agreements"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "PK"
  range_key        = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "UserAgreementsTable"
    Environment = "production"
    Project     = "StudioBooking"
  }

  point_in_time_recovery {
    enabled = true
  }
}

# ------------------------------------------------------------------------------
# DynamoDB Table: Bookings
# ------------------------------------------------------------------------------
resource "aws_dynamodb_table" "bookings" {
  name             = "studio-booking-bookings"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "PK"
  range_key        = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # GSI1: ユーザー別予約一覧
  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  # GSI2: ステータス別予約一覧
  attribute {
    name = "GSI2PK"
    type = "S"
  }

  attribute {
    name = "GSI2SK"
    type = "S"
  }

  # GSI3: 日付別予約一覧
  attribute {
    name = "GSI3PK"
    type = "S"
  }

  attribute {
    name = "GSI3SK"
    type = "S"
  }

  global_secondary_index {
    name               = "UserBookingsIndex"
    hash_key           = "GSI1PK"
    range_key          = "GSI1SK"
    projection_type    = "ALL"
  }

  global_secondary_index {
    name               = "StatusBookingsIndex"
    hash_key           = "GSI2PK"
    range_key          = "GSI2SK"
    projection_type    = "ALL"
  }

  global_secondary_index {
    name               = "DateBookingsIndex"
    hash_key           = "GSI3PK"
    range_key          = "GSI3SK"
    projection_type    = "ALL"
  }

  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "BookingsTable"
    Environment = "production"
    Project     = "StudioBooking"
  }

  point_in_time_recovery {
    enabled = true
  }
}

# ------------------------------------------------------------------------------
# DynamoDB Table: Calendar
# ------------------------------------------------------------------------------
resource "aws_dynamodb_table" "calendar" {
  name             = "studio-booking-calendar"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "PK"
  range_key        = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "CalendarTable"
    Environment = "production"
    Project     = "StudioBooking"
  }

  point_in_time_recovery {
    enabled = true
  }
}

# ------------------------------------------------------------------------------
# DynamoDB Table: Options
# ------------------------------------------------------------------------------
resource "aws_dynamodb_table" "options" {
  name             = "studio-booking-options"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "PK"

  attribute {
    name = "PK"
    type = "S"
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "OptionsTable"
    Environment = "production"
    Project     = "StudioBooking"
  }

  point_in_time_recovery {
    enabled = true
  }
}

# ------------------------------------------------------------------------------
# DynamoDB Table: Notifications
# ------------------------------------------------------------------------------
resource "aws_dynamodb_table" "notifications" {
  name             = "studio-booking-notifications"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "PK"
  range_key        = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # GSI1: タイプ別通知一覧
  attribute {
    name = "GSI1PK"
    type = "S"
  }

  attribute {
    name = "GSI1SK"
    type = "S"
  }

  global_secondary_index {
    name               = "TypeNotificationsIndex"
    hash_key           = "GSI1PK"
    range_key          = "GSI1SK"
    projection_type    = "ALL"
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "NotificationsTable"
    Environment = "production"
    Project     = "StudioBooking"
  }

  point_in_time_recovery {
    enabled = true
  }
}

# ------------------------------------------------------------------------------
# DynamoDB Table: TermsOfService
# ------------------------------------------------------------------------------
resource "aws_dynamodb_table" "terms_of_service" {
  name             = "studio-booking-terms-of-service"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "PK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "STATUS"
    type = "S"
  }

  attribute {
    name = "effectiveDate"
    type = "S"
  }

  global_secondary_index {
    name               = "StatusEffectiveDateIndex"
    hash_key           = "STATUS"
    range_key          = "effectiveDate"
    projection_type    = "ALL"
  }

  server_side_encryption {
    enabled = true
  }

  tags = {
    Name        = "TermsOfServiceTable"
    Environment = "production"
    Project     = "StudioBooking"
  }

  point_in_time_recovery {
    enabled = true
  }
}
