output "lambda_function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.redirect_lambda.function_name
}

output "lambda_function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.redirect_lambda.arn
}

output "api_gateway_url" {
  description = "Base URL of the API Gateway"
  value       = aws_api_gateway_deployment.redirect_deployment.invoke_url
}

output "api_gateway_endpoint" {
  description = "Full endpoint for redirect service (GET /{codigo})"
  value       = "${aws_api_gateway_deployment.redirect_deployment.invoke_url}/{codigo}"
}
