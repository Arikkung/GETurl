import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const TABLE_NAME = process.env.DYNAMODB_TABLE || "short_links";
const REGION = process.env.AWS_REGION || "us-east-2";
const dynamo = new DynamoDBClient({ region: REGION });

export async function handler(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET",
    "Content-Type": "application/json",
    "Cache-Control": "no-cache"
  };

  try {
    console.log("Received event:", JSON.stringify(event));

    const codigo = event.pathParameters?.codigo;
    console.log("Extracted codigo:", codigo);

    if (!codigo) {
      console.log("Missing codigo parameter");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "codigo parameter is required" }),
        headers: corsHeaders,
      };
    }

    // 1. Buscar el registro por id
    const getCmd = new GetItemCommand({
      TableName: TABLE_NAME,
      Key: { id: { S: codigo } }
    });
    console.log("GetItemCommand input:", JSON.stringify(getCmd.input));

    const result = await dynamo.send(getCmd);
    console.log("GetItemCommand result:", JSON.stringify(result));

    if (!result.Item || !result.Item.link_og?.S) {
      console.log("Short URL not found for codigo:", codigo);
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Short URL not found" }),
        headers: corsHeaders,
      };
    }

    const originalUrl = result.Item.link_og.S;
    console.log("Original URL found:", originalUrl);

    // 2. Actualizar el array visits con el nuevo timestamp
    const now = new Date().toISOString();
    const updateCmd = new UpdateItemCommand({
      TableName: TABLE_NAME,
      Key: { id: { S: codigo } },
      UpdateExpression: "SET visits = list_append(if_not_exists(visits, :empty_list), :new_visit)",
      ExpressionAttributeValues: {
        ":new_visit": { L: [{ S: now }] },
        ":empty_list": { L: [] }
      }
    });
    console.log("UpdateItemCommand input:", JSON.stringify(updateCmd.input));

    const updateResult = await dynamo.send(updateCmd);
    console.log("UpdateItemCommand result:", JSON.stringify(updateResult));

    // 3. Redireccionar con 302
    console.log("Redirecting to:", originalUrl);
    return {
      statusCode: 302,
      headers: {
        ...corsHeaders,
        Location: originalUrl
      },
      body: ""
    };
  } catch (error) {
    console.error("Error in redirect handler:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error", details: error instanceof Error ? error.message : String(error) }),
      headers: corsHeaders,
    };
  }
}