import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export type Role = "user" | "vendor" | "admin";

export interface AuthUser {
  userId: string;
  role: Role;
}

// Lets us use req.user in every route
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Checks the JWT token sent in the Authorization header
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ message: "Missing or invalid token" });
    return;
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as jwt.JwtPayload;

    req.user = { userId: payload.userId, role: payload.role };
    next();
  } catch {
    res.status(401).json({ message: "Token expired or invalid" });
  }
}

// Allows only certain roles, e.g. requireRole("vendor")
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ message: "You do not have permission" });
      return;
    }
    next();
  };
}