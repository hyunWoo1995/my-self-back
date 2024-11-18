module.exports = (req, res, next) => {
    res.sendSuccess = (message = '요청 성공', data = null) => {
      res.status(200).json({
        success: true,
        message,
        data
      });
    };
  
    res.sendError = (statusCode = 500, message = '요청 실패', data = null) => {
      res.status(statusCode).json({
        success: false,
        message,
        data
      });
    };
  
    next();
  };
  