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
  name             = "Bookings"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "bookingId"

  attribute {
    name = "bookingId"
    type = "S"
  }

  tags = {
    Name = "BookingsTable"
  }
}

# ------------------------------------------------------------------------------
# DynamoDB Table: Calendar
# ------------------------------------------------------------------------------
resource "aws_dynamodb_table" "calendar" {
  name             = "Calendar"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "date" # Assuming date as hash key for calendar entries

  attribute {
    name = "date"
    type = "S"
  }

  tags = {
    Name = "CalendarTable"
  }
}

# ------------------------------------------------------------------------------
# DynamoDB Table: Options
# ------------------------------------------------------------------------------
resource "aws_dynamodb_table" "options" {
  name             = "Options"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "optionId"

  attribute {
    name = "optionId"
    type = "S"
  }

  tags = {
    Name = "OptionsTable"
  }
}

# ------------------------------------------------------------------------------
# DynamoDB Table: Notifications
# ------------------------------------------------------------------------------
resource "aws_dynamodb_table" "notifications" {
  name             = "Notifications"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "notificationId"

  attribute {
    name = "notificationId"
    type = "S"
  }

  tags = {
    Name = "NotificationsTable"
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
