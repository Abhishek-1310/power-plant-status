const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME;

exports.handler = async (event) => {
    const connectionId = event.requestContext.connectionId;

    try {
        await ddb.put({
            TableName: TABLE_NAME,
            Item: { connectionId }
        }).promise();

        return { statusCode: 200, body: 'Connected' };
    } catch (err) {
        console.error('Connect error:', err);
        return { statusCode: 500, body: 'Failed to connect' };
    }
};
