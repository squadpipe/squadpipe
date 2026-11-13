import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  agencyName?: string;
  tenantId: string;
  rateMasked: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const authenticateJwt = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // For development convenience / prototype testing, allow fallback dev user if not in strict prod
    if (process.env.NODE_ENV !== 'production' && !authHeader) {
      req.user = {
        id: 'usr_admin',
        email: 'j.miller@talentos-agency.com',
        role: UserRole.ADMINISTRATOR,
        fullName: 'Johnathan Miller',
        agencyName: 'TalentOS Staffing',
        tenantId: 'talentos-agency',
        rateMasked: false
      };
      return next();
    }
    return res.status(401).json({ success: false, message: 'Authentication required. Missing Bearer token.' });
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_ACCESS_SECRET || 'dev_secret_key';

  try {
    const decoded = jwt.verify(token, secret) as AuthenticatedUser;
    // Fallback tenantId if missing in older tokens
    if (!decoded.tenantId) {
      decoded.tenantId = decoded.email?.endsWith('@talentos-agency.com') ? 'talentos-agency' : `tenant_${decoded.id}`;
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid or expired access token.' });
  }
};

export const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient role permissions for this operation.' });
    }
    next();
  };
};

