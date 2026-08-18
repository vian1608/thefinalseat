import backofficeStaffService from '../modules/backoffice/backoffice.service.mjs';
import legacyAdminPermissionForRequest from '../modules/backoffice/backoffice.legacy-admin-map.mjs';

export const authorize = (allowedRoles = []) => {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    if (allowedRoles.includes(req.user.role)) return next();

    if (allowedRoles.includes('admin') && req.user.role === 'staff') {
      try {
        const permission = legacyAdminPermissionForRequest(req);
        if (!permission) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'This administrative operation is owner-only' } });
        const profile = await backofficeStaffService.profileFromToken(req.user);
        if (profile && backofficeStaffService.hasPermission(profile, permission)) {
          req.staff = profile;
          req.permissionScope = backofficeStaffService.scopeFor(profile, permission);
          return next();
        }
      } catch (error) { return next(error); }
    }

    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have permission to access this resource' } });
  };
};

export default authorize;
