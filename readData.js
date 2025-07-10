const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const BUCKET_NAME = process.env.BUCKET_NAME;

exports.handler = async (event) => {
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Content-Type": "application/json"
    };
    try {
        const plantId = event.pathParameters?.plant_id;

        if (plantId) {
            const key = `plants/${plantId}.json`;

            try {
                const res = await s3.getObject({
                    Bucket: BUCKET_NAME,
                    Key: key
                }).promise();

                return {
                    statusCode: 200,
                    body: res.Body.toString('utf-8'),
                    headers: corsHeaders
                };
            } catch (err) {
                if (err.code === 'NoSuchKey') {
                    return {
                        statusCode: 404,
                        body: JSON.stringify({ error: 'Plant not found' }),
                        headers: corsHeaders
                    };
                }
                throw err;
            }

        } else {
            // List all plants
            const listedObjects = await s3.listObjectsV2({
                Bucket: BUCKET_NAME,
                Prefix: 'plants/',
            }).promise();

            const keys = listedObjects.Contents.map(obj => obj.Key);

            const files = await Promise.all(keys.map(async key => {
                const res = await s3.getObject({ Bucket: BUCKET_NAME, Key: key }).promise();
                return JSON.parse(res.Body.toString('utf-8'));
            }));

            return {
                statusCode: 200,
                body: JSON.stringify(files),
                headers: corsHeaders
            };
        }

    } catch (err) {
        console.error(err);
        return { statusCode: 500, body: 'Internal Server Error', headers: corsHeaders };
    }
};
