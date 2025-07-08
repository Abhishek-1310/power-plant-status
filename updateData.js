const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const ddb = new AWS.DynamoDB.DocumentClient();

const BUCKET_NAME = process.env.BUCKET_NAME;
const TABLE_NAME = process.env.TABLE_NAME;

exports.handler = async (event) => {
    try {
        const body = JSON.parse(event.body);
        const { plant_id } = body;

        if (!plant_id) {
            return { statusCode: 400, body: 'Missing plant_id' };
        }

        const key = `${plant_id}.json`;

        // Save to S3
        await s3.putObject({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: JSON.stringify(body),
            ContentType: 'application/json'
        }).promise();

        // Notify WebSocket Clients
        const connections = await ddb.scan({ TableName: TABLE_NAME }).promise();
        const apiGateway = new AWS.ApiGatewayManagementApi({
            endpoint: `${event.requestContext.domainName}/${event.requestContext.stage}`
        });

        await Promise.all(
            connections.Items.map(async ({ connectionId }) => {
                try {
                    await apiGateway.postToConnection({
                        ConnectionId: connectionId,
                        Data: JSON.stringify({ event: 'plantUpdated', data: body })
                    }).promise();
                } catch (err) {
                    if (err.statusCode === 410) {
                        await ddb.delete({ TableName: TABLE_NAME, Key: { connectionId } }).promise();
                    }
                }
            })
        );

        return { statusCode: 200, body: JSON.stringify({ message: 'Success' }) };

    } catch (err) {
        console.error(err);
        return { statusCode: 500, body: 'Internal Server Error' };
    }
};
