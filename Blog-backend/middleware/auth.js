require('dotenv').config();
const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
    try {
        // Get token from headers
        const token= req.header('Authorization');

        if (!token) {
            return res.status(401).json({ message: ' No token access denied' });
        }

        // Remove bearer from token
        const actualToken = token.replace('Bearer ', '');

        // verify token
        const decoded = jwt.verify(actualToken, process.env.JWT_SECRET);

        // Attach user info to request
        req.user = decoded;

        next(); // move to next step (routue)
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
};
module.exports = auth;