const AWS = require('aws-sdk');
const ddb = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.TABLE_NAME;

exports.handler = async (event) => {
    const connectionId = event.requestContext.connectionId;

    try {
        await ddb.delete({
            TableName: TABLE_NAME,
            Key: { connectionId }
        }).promise();

        return { statusCode: 200, body: 'Disconnected' };
    } catch (err) {
        console.error('Disconnect error:', err);
        return { statusCode: 500, body: 'Failed to disconnect' };
    }
};
