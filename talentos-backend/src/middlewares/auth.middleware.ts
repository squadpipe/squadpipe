import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import { prisma } from '../config/prisma.config';
import { getJwtAccessSecret } from '../config/jwt.config';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  agencyName?: string;
  tenantId: string;
  rateMasked: boolean;
  tokenVersion?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const authenticateJwt = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Allow headerless dev convenience ONLY outside production
    if (process.env.NODE_ENV !== 'production' && !authHeader) {
      req.user = {
        id: 'usr_admin',
        email: 'j.miller@squadpipe.com',
        role: UserRole.ADMINISTRATOR,
        fullName: 'Johnathan Miller',
        agencyName: 'SquadPipe Staffing',
        tenantId: 'talentos-agency',
        rateMasked: false,
        tokenVersion: 0
      };
      return next();
    }
    return res.status(401).json({ success: false, message: 'Authentication required. Missing Bearer token.' });
  }

  const token = authHeader.split(' ')[1];
  const secret = getJwtAccessSecret();

  try {
    const decoded = jwt.verify(token, secret) as AuthenticatedUser;
    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
        fullName: true,
        agencyName: true,
        tenantId: true,
        rateMasked: true,
        status: true,
        tokenVersion: true
      }
    });

    if (!dbUser) {
      return res.status(401).json({ success: false, message: 'Session is no longer valid.' });
    }

    if (dbUser.status === 'SUSPENDED') {
      return res.status(403).json({ success: false, message: 'Account suspended. Contact your workspace administrator.' });
    }

    const tokenVersionMatches =
      typeof decoded.tokenVersion === 'number'
        ? decoded.tokenVersion === dbUser.tokenVersion
        : dbUser.tokenVersion === 0;

    if (!tokenVersionMatches) {
      return res.status(401).json({ success: false, message: 'Session expired or signed out. Please sign in again.' });
    }

    req.user = {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role,
      fullName: dbUser.fullName,
      agencyName: dbUser.agencyName,
      tenantId: dbUser.tenantId || 'talentos-agency',
      rateMasked: dbUser.rateMasked,
      tokenVersion: dbUser.tokenVersion
    };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired access token.' });
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

