const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {

  try {

    const authHeader =
      req.header('Authorization');

    if (!authHeader) {

      return res.status(401).json({
        message: 'No Token'
      });

    }

    /* HANDLE Bearer TOKEN */

    const token =
      authHeader.startsWith('Bearer ')
        ? authHeader.split(' ')[1]
        : authHeader;

    const verified = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = verified;

    next();

  } catch (err) {

    console.log(err);

    return res.status(401).json({
      message: 'Invalid Token'
    });

  }

};