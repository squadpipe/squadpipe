import { Request, Response } from 'express';
import { USER_SORTABLE_FIELDS, userService } from '../services/user.service';
import {
  complianceService,
  extractRequestNetworkMeta,
} from '../services/compliance.service';
import { parseSortParams } from '../utils/tableSort';

export const getUsers = async (req: Request, res: Response) => {
  try {
    const { search, role, status, page, limit } = req.query;
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const parsedPage = page ? Math.max(1, parseInt(String(page), 10) || 1) : undefined;
    const parsedLimit = limit ? Math.max(1, Math.min(100, parseInt(String(limit), 10) || 10)) : undefined;
    const { sortBy, sortDir } = parseSortParams(req.query as Record<string, any>, USER_SORTABLE_FIELDS);

    const result = await userService.getUsers(tenantId, {
      search: search ? String(search) : undefined,
      role: role ? String(role) : undefined,
      status: status ? String(status) : undefined,
      page: parsedPage,
      limit: parsedLimit,
      sortBy,
      sortDir,
    });
    res.json({ success: true, data: result.data, pagination: result.pagination });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch users' });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const user = await userService.getUserById(req.params.id, tenantId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch user details' });
  }
};

export const toggleUserRateMask = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const updated = await userService.toggleRateMask(req.params.id, tenantId);
    await complianceService.recordSecurityAuditEvent({
      tenantId,
      actorUserId: req.user?.id,
      actorEmail: req.user?.email,
      actorRole: req.user?.role,
      action: 'USER_RATE_MASK_CHANGED',
      targetType: 'USER',
      targetId: updated.id,
      ...extractRequestNetworkMeta(req),
      metadata: { rateMasked: updated.rateMasked },
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    const status = error.message === 'User not found' ? 404 : 500;
    res.status(status).json({ success: false, message: error.message || 'Failed to toggle rate mask' });
  }
};

export const inviteUser = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const agencyName = req.user?.agencyName;
    const user = await userService.inviteUser(req.body, tenantId, agencyName);
    await complianceService.recordSecurityAuditEvent({
      tenantId,
      actorUserId: req.user?.id,
      actorEmail: req.user?.email,
      actorRole: req.user?.role,
      action: 'USER_INVITED',
      targetType: 'USER',
      targetId: user.id,
      ...extractRequestNetworkMeta(req),
      metadata: { role: user.role, rateMasked: user.rateMasked },
    });
    res.status(201).json({ success: true, data: user });
  } catch (error: any) {
    const msg = error?.message || 'Failed to invite user';
    const status = msg.includes('already exists') ? 409 : msg.includes('valid corporate email') ? 400 : 500;
    res.status(status).json({ success: false, message: msg });
  }
};

export const inviteUsersBatch = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const agencyName = req.user?.agencyName;
    const members = Array.isArray(req.body?.members) ? req.body.members : [];
    if (members.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Provide at least one team member to invite.',
      });
    }
    const batch = await userService.inviteUsersBatch(members, tenantId, agencyName);
    for (const invited of batch.created) {
      await complianceService.recordSecurityAuditEvent({
        tenantId,
        actorUserId: req.user?.id,
        actorEmail: req.user?.email,
        actorRole: req.user?.role,
        action: 'USER_INVITED',
        targetType: 'USER',
        targetId: invited.id,
        ...extractRequestNetworkMeta(req),
        metadata: { role: invited.role, rateMasked: invited.rateMasked, batch: true },
      });
    }
    const status = batch.created.length > 0 ? 201 : 400;
    res.status(status).json({
      success: batch.created.length > 0,
      data: batch,
      message:
        batch.created.length > 0
          ? `Invited ${batch.created.length} team member${batch.created.length === 1 ? '' : 's'}.`
          : batch.failed[0]?.error || 'No invitations could be created.',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error?.message || 'Failed to process team invitations',
    });
  }
};

export const resendUserInvite = async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId || 'squadpipe-agency';
    const agencyName = req.user?.agencyName;
    const result = await userService.resendInvite(req.params.id, tenantId, agencyName);
    res.json({
      success: true,
      delivered: result.emailDelivered,
      inviteUrl: result.inviteUrl,
      emailError: result.emailError,
      message: result.emailDelivered
        ? `Fresh invitation link sent to ${result.user.email}.`
        : `Fresh invite link generated for ${result.user.email} (SMTP unavailable).`,
      data: result.user,
    });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    res.status(status).json({
      success: false,
      message: error?.message || 'Failed to resend invitation link',
    });
  }
};
