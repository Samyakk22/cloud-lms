// One interface for course files. With S3_BUCKET set it uses S3 presigned URLs, otherwise the local disk.
const s3 = require('./s3');
const local = require('./localFiles');

const useS3 = () => Boolean(process.env.S3_BUCKET);

exports.presignUpload = async (key, contentType) =>
  useS3() ? s3.presignUpload(key, contentType) : local.urlFor(key, 'put');

exports.presignDownload = async (key) => (useS3() ? s3.presignDownload(key) : local.urlFor(key, 'get'));
