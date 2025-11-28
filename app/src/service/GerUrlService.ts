import {DynamoDBClient, GetItemCommand, GetItemCommandInput,} from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { Iurl } from "../types/urlTypes";

export class GetUrlService {
  private dynamodbClient: DynamoDBClient;
  private tableName: string;

  constructor() {
    this.dynamodbClient = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-2" });
    this.tableName = process.env.DYNAMODB_TABLE || "url-shortener-table";
  }

  /**
   * @param codigo 
   * @returns
   */
  async getUrlByCodigo(codigo: string): Promise<Iurl | null> {
    try {
      const input: GetItemCommandInput = {
        TableName: this.tableName,
        Key: {
          id: { S: codigo },
        },
      };

      const command = new GetItemCommand(input);
      const response = await this.dynamodbClient.send(command);

      if (!response.Item) {
        console.log(`URL not found for codigo: ${codigo}`);
        return null;
      }

      const urlItem = unmarshall(response.Item) as Iurl;

      if (urlItem.expiresAt && urlItem.expiresAt < Date.now()) {
        console.log(`URL expired for codigo: ${codigo}`);
        return null;
      }

      return urlItem;
    } catch (error) {
      console.error(`Error retrieving URL from DynamoDB:`, error);
      throw error;
    }
  }

  async closeConnection(): Promise<void> {
    await this.dynamodbClient.destroy();
  }
}