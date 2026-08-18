import express from 'express';
import authenticate from '../../middleware/authenticate.mjs';
import { loadBackOfficeProfile, requirePermission } from './backoffice.middleware.mjs';
import backofficeRepository from './backoffice.repository.mjs';
import backofficeStaffService from './backoffice.service.mjs';

const router = express.Router();
router.use(authenticate, loadBackOfficeProfile);
router.get('/me', (req, res) => res.json({ success: true, data: req.staff }));
router.get('/dashboard', requirePermission('dashboard.view'), (req, res) => res.json({ success: true, data: { profile: req.staff, scope: req.staff.role, modules: ['crm','trips','bookings','payments','finance','suppliers','reports','team','settings'] } }));
router.get('/team/users', requirePermission('team.view'), async (req, res, next) => { try { res.json({ success: true, data: await backofficeRepository.listStaff() }); } catch (error) { next(error); } });
router.get('/team/roles', requirePermission('team.view'), async (req, res, next) => { try { res.json({ success: true, data: await backofficeRepository.listRoles() }); } catch (error) { next(error); } });
router.get('/team/teams', requirePermission('team.view'), async (req, res, next) => { try { res.json({ success: true, data: await backofficeRepository.listTeams() }); } catch (error) { next(error); } });
router.post('/team/users', requirePermission('team.manage'), async (req, res, next) => {
  try {
    const { name, email, password, roleId, teamId, status } = req.body || {};
    if (!name || !email || !password || !roleId || password.length < 10) return res.status(400).json({ success: false, error: { code: 'INVALID_STAFF_USER', message: 'name, email, roleId and a password of at least 10 characters are required' } });
    res.status(201).json({ success: true, data: await backofficeStaffService.createStaff({ name, email, password, roleId, teamId, status }) });
  } catch (error) { next(error); }
});
export default router;
export { router as backOfficeRouter };
