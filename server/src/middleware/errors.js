export class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export const errorHandler = (err, req, res, _next) => {
  const status = err.status || (err.name === 'MulterError' ? 400 : 500);
  if (status >= 500) console.error(err);
  const body = { error: err.message || 'Internal error', ...(err.extra || {}) };
  if (status === 413) body.error = 'Fayl hajmi juda katta';
  res.status(status).json(body);
};
