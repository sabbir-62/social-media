const jwt = require('jsonwebtoken');

exports.tokenVerify = async (req, res, next) => {
    try {
        const {
            token
        } = req.headers;
        if (!token) {
            return res.status(401).json({
                status: "Fail",
                message: "Unauthorized."
            });
        }

        const KEY = "5<4D''{#GvWXj78Z0)M}xY)*;Kv;@}"
        const verifyToken = jwt.verify(token, KEY || "ABCD");

        const expireToken = Date.now() / 1000 > verifyToken.exp;

        if (expireToken) {
            res.status(200).json({
                status: "Fail",
                message: "expire Your Token"
            });
        }

        req.userId = verifyToken['id'];

        next();

    } catch (err) {
        res.status(200).json({
            status: "Fail",
            message: "something went worng.",
            error: err.message
        });
    }
};