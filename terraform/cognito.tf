# ------------------------------------------------------------------------------
# Cognito User Pool
# ------------------------------------------------------------------------------
resource "aws_cognito_user_pool" "main" {
  name = "zebra-app-user-pool"

  auto_verified_attributes = ["email"]

  # Password Policy
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  # Attribute for email
  schema {
    name     = "email"
    attribute_data_type = "String"
    mutable  = true
    required = true
  }

  tags = {
    Name = "zebra-app-user-pool"
  }
}

# ------------------------------------------------------------------------------
# Cognito User Pool Client
# ------------------------------------------------------------------------------
resource "aws_cognito_user_pool_client" "web_client" {
  name                                 = "zebra-app-web-client"
  user_pool_id                         = aws_cognito_user_pool.main.id
  generate_secret                      = false # For web clients, typically no secret
  explicit_auth_flows                  = ["ALLOW_ADMIN_USER_PASSWORD_AUTH", "ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
  prevent_user_existence_errors        = "ENABLED"

}
