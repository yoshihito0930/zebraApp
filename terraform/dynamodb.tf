# ------------------------------------------------------------------------------
# DynamoDB Table: Users
# ------------------------------------------------------------------------------
resource "aws_dynamodb_table" "users" {
  name             = "Users"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  tags = {
    Name = "UsersTable"
  }
}

# ------------------------------------------------------------------------------
# DynamoDB Table: UserAgreements
# ------------------------------------------------------------------------------
resource "aws_dynamodb_table" "user_agreements" {
  name             = "UserAgreements"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "agreementId"

  attribute {
    name = "agreementId"
    type = "S"
  }

  tags = {
    Name = "UserAgreementsTable"
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
  name             = "TermsOfService"
  billing_mode     = "PAY_PER_REQUEST"
  hash_key         = "versionId" # Assuming versionId for terms of service

  attribute {
    name = "versionId"
    type = "S"
  }

  tags = {
    Name = "TermsOfServiceTable"
  }
}
