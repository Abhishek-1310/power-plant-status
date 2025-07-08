const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const BUCKET_NAME = process.env.BUCKET_NAME;

exports.handler = async (event) => {
    try {
        const plantId = event.pathParameters ? event.pathParameters.id : null;

        if (plantId) {
            // Return specific plant
            const res = await s3.getObject({
                Bucket: BUCKET_NAME,
                Key: `${plantId}.json`
            }).promise();

            return {
                statusCode: 200,
                body: res.Body.toString('utf-8'),
                headers: { 'Content-Type': 'application/json' }
            };
        } else {
            // List all plants
            const listedObjects = await s3.listObjectsV2({ Bucket: BUCKET_NAME }).promise();
            const keys = listedObjects.Contents.map(obj => obj.Key);

            const files = await Promise.all(keys.map(async key => {
                const res = await s3.getObject({ Bucket: BUCKET_NAME, Key: key }).promise();
                return JSON.parse(res.Body.toString('utf-8'));
            }));

            return {
                statusCode: 200,
                body: JSON.stringify(files),
                headers: { 'Content-Type': 'application/json' }
            };
        }

    } catch (err) {
        console.error(err);
        return { statusCode: 500, body: 'Internal Server Error' };
    }
};
