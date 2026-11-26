const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { httpError } = require('./util');

let client;
function s3() {
  if (!process.env.S3_BUCKET) {
    throw httpError(501, 'File storage is not configured. Set S3_BUCKET to enable uploads.');
  }
  // Credentials come from the EC2 instance role (default provider chain).
  // WHEN_REQUIRED keeps checksum params out of presigned PUT URLs so browser uploads work.
  client ||= new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });
  return client;
}

const EXPIRES = 300; // seconds

function presignUpload(key, contentType) {
  const command = new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, ContentType: contentType });
  return getSignedUrl(s3(), command, { expiresIn: EXPIRES });
}

function presignDownload(key) {
  const command = new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key });
  return getSignedUrl(s3(), command, { expiresIn: EXPIRES });
}

module.exports = { presignUpload, presignDownload };
