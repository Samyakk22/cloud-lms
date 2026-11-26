// Local-disk storage used when S3_BUCKET is not set, so uploads work on your machine.
// It mimics presigned URLs: the API hands out short-lived signed links and the browser PUTs/GETs the file.
const path = require('path');
const fs = require('fs/promises');
const jwt = require('jsonwebtoken');
const express = require('express');
const { wrap, httpError } = require('./util');

const ROOT = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads'));

const urlFor = (key, op) =>
  `/api/local-files?t=${jwt.sign({ key, op }, process.env.JWT_SECRET, { expiresIn: 300 })}`;

function keyFromToken(req, op) {
  try {
    const payload = jwt.verify(String(req.query.t || ''), process.env.JWT_SECRET);
    if (payload.op !== op) throw new Error('wrong operation');
    const full = path.resolve(ROOT, payload.key);
    if (!full.startsWith(ROOT + path.sep)) throw new Error('outside upload folder');
    return full;
  } catch {
    throw httpError(403, 'This link expired. Reload the page and try again');
  }
}

const router = express.Router();

router.put(
  '/',
  express.raw({ type: () => true, limit: '100mb' }),
  wrap(async (req, res) => {
    const full = keyFromToken(req, 'put');
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) throw httpError(400, 'The file is empty');
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, req.body);
    res.status(200).end();
  })
);

router.get(
  '/',
  wrap(async (req, res) => {
    const full = keyFromToken(req, 'get');
    res.sendFile(full, (err) => {
      if (err && !res.headersSent) res.status(404).json({ message: 'File not found' });
    });
  })
);

module.exports = { urlFor, router };
