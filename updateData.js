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

        // ✅ Validate input
        if (!body.plant_id || typeof body.plant_id !== 'string') {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Invalid plant_id' }),
            };
        }

        const key = `plants/${body.plant_id}.json`;

        // ✅ Check if file already exists (optional)
        let previousData = null;
        try {
            const existing = await s3.getObject({ Bucket: BUCKET_NAME, Key: key }).promise();
            previousData = JSON.parse(existing.Body.toString('utf-8'));
        } catch (err) {
            if (err.code !== 'NoSuchKey') throw err;
        }

        // ✅ Overwrite with new data
        const updated = {
            ...previousData,
            ...body,
            last_updated: new Date().toISOString(),
        };

        await s3.putObject({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: JSON.stringify(updated),
            ContentType: "application/json",
        }).promise();

        // ✅ Notify all active WebSocket clients
        const connectionData = await ddb.scan({ TableName: CONNECTION_TABLE }).promise();

        const postCalls = connectionData.Items.map(async ({ connectionId }) => {
            try {
                await apiGateway.postToConnection({
                    ConnectionId: connectionId,
                    Data: JSON.stringify(updated),
                }).promise();
            } catch (err) {
                if (err.statusCode === 410) {
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
            body: JSON.stringify({ message: 'Plant data updated and broadcasted.' }),
        };

    } catch (err) {
        console.error("Error:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to update plant.' }),
        };
    }
};
