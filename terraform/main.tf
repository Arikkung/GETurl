terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

resource "aws_iam_role" "lambda_exec_role" {
  name = "redirect-lambda-exec-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })
}

resource "aws_iam_role_policy" "lambda_dynamodb_policy" {
  name = "lambda-dynamodb-policy"
  role = aws_iam_role.lambda_exec_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:Query",
          "dynamodb:UpdateItem"
        ]
        Resource = "arn:aws:dynamodb:us-east-2:916574584493:table/short_links"
      }
    ]
  })
}

resource "aws_lambda_function" "redirect_lambda" {
  function_name = "redirect_service"
  role          = aws_iam_role.lambda_exec_role.arn
  handler       = "dist/handler/GETredirect.handler"
  runtime       = "nodejs20.x"
  timeout       = 10

  filename      = "${path.module}/lambda.zip" 

  environment {
    variables = {
      DYNAMODB_TABLE = "short_links"
    }
  }
}

resource "aws_api_gateway_rest_api" "redirect_api" {
  name        = "redirect-api"
  description = "API Gateway for URL redirect service"
}

resource "aws_api_gateway_resource" "codigo_resource" {
  rest_api_id = aws_api_gateway_rest_api.redirect_api.id
  parent_id   = aws_api_gateway_rest_api.redirect_api.root_resource_id
  path_part   = "{codigo}"
}

resource "aws_api_gateway_method" "get_redirect" {
  rest_api_id      = aws_api_gateway_rest_api.redirect_api.id
  resource_id      = aws_api_gateway_resource.codigo_resource.id
  http_method      = "GET"
  authorization    = "NONE"

  request_parameters = {
    "method.request.path.codigo" = true
  }
}

resource "aws_api_gateway_integration" "lambda_integration" {
  rest_api_id      = aws_api_gateway_rest_api.redirect_api.id
  resource_id      = aws_api_gateway_resource.codigo_resource.id
  http_method      = aws_api_gateway_method.get_redirect.http_method
  type             = "AWS_PROXY"
  integration_http_method = "POST"
  uri              = aws_lambda_function.redirect_lambda.invoke_arn
}

resource "aws_lambda_permission" "api_gateway_invoke" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.redirect_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.redirect_api.execution_arn}/*/*"
}

resource "aws_api_gateway_deployment" "redirect_deployment" {
  rest_api_id = aws_api_gateway_rest_api.redirect_api.id
  stage_name  = "prod"

  depends_on = [
    aws_api_gateway_integration.lambda_integration
  ]
}

resource "aws_cloudwatch_log_group" "redirect_logs" {
  name              = "/aws/lambda/redirect_service"
  retention_in_days = 14
}