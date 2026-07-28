const errorHandler = (err, req, res, next) => {
  // body-parser attaches its own status (413 for an oversized body, 400 for bad
  // JSON); without this those all got reported as a generic 500.
  let statusCode = err.status || err.statusCode;
  if (!statusCode || statusCode < 400) {
    statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  }

  let message = err.message;
  if (err.type === 'entity.too.large') {
    message = 'The uploaded data is too large to send in one request. Please split the Excel file into smaller batches and import again.';
  }

  console.error(`[ERROR] ${err.message}`);
  res.status(statusCode).json({
    message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
};

const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

module.exports = { errorHandler, notFound };
