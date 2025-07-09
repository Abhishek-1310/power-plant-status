const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const ddb = new AWS.DynamoDB.DocumentClient();

const CONNECTION_TABLE = process.env.CONNECTION_TABLE;
const BUCKET_NAME = process.env.BUCKET_NAME;
const WEBSOCKET_ENDPOINT = process.env.WEBSOCKET_ENDPOINT;

const apiGateway = new AWS.ApiGatewayManagementApi({
    endpoint: WEBSOCKET_ENDPOINT,
});

exports.handler = async (event) => {
    try {
        const body = JSON.parse(event.body);

        const fileName = `plants/${body.plant_id}.json`;
        const s3Params = {
            Bucket: BUCKET_NAME,
            Key: fileName,
            Body: JSON.stringify(body),
            ContentType: "application/json",
        };

        // Save to S3
        await s3.putObject(s3Params).promise();

        // Get all active WebSocket connections
        const connectionData = await ddb.scan({ TableName: CONNECTION_TABLE }).promise();

        const postCalls = connectionData.Items.map(async ({ connectionId }) => {
            try {
                await apiGateway.postToConnection({
                    ConnectionId: connectionId,
                    Data: JSON.stringify(body),
                }).promise();
            } catch (err) {
                if (err.statusCode === 410) {
                    // Stale connection, delete it
                    await ddb.delete({
                        TableName: CONNECTION_TABLE,
                        Key: { connectionId },
                    }).promise();
                } else {
                    console.error("Failed to post:", err);
                }
            }
        });

        await Promise.all(postCalls);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Plant data updated and pushed to clients.' }),
        };

    } catch (err) {
        console.error("Error:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to update and notify clients.' }),
        };
    }
};
