import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Protect routes
const protect = async (req, res, next) => {
  let token;

  // Read the JWT from the cookie
  token = req.headers.cookie ? req.headers.cookie.split('jwt=')[1] : null;

  // Fallback: If using localStorage and sending via Authorization Bearer header
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.userId).select('-password');
      next();
    } catch (error) {
      console.error(error);
      res.status(401);
      next(new Error('Not authorized, token failed'));
    }
  } else {
    res.status(401);
    next(new Error('Not authorized, no token'));
  }
};

// Admin middleware
const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403);
    next(new Error('Not authorized as an admin'));
  }
};

export { protect, admin };
