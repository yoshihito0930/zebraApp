terraform {
  backend "s3" {
    bucket         = "zebra-app-tfstate-20250628"
    key            = "terraform.tfstate"
    region         = "ap-northeast-1"
    dynamodb_table = "zebra-app-tfstate-lock"
    encrypt        = true
  }
}
