import tripAddonFlexService from './trip-addon-flex.service.mjs';

function fail(res, error) {
  return res.status(error?.status || 500).json({
    success: false,
    error: {
      code: error?.code || 'FLEX_CHANGE_REQUEST_FAILED',
      message: error?.message || 'Unable to process Flex Assist change request.',
    },
  });
}

export const tripAddonFlexController = {
  create: async (req, res) => {
    try {
      const data = await tripAddonFlexService.create(req.params.reference, req.body || {});
      return res.status(201).json({ success: true, data });
    } catch (error) { return fail(res, error); }
  },
  listCustomer: async (req, res) => {
    try {
      const data = await tripAddonFlexService.listCustomer(req.params.reference, req.query.email);
      return res.json({ success: true, data });
    } catch (error) { return fail(res, error); }
  },
  listAdmin: async (req, res) => {
    try {
      const data = await tripAddonFlexService.listAdmin(req.params.id);
      return res.json({ success: true, data, statuses: tripAddonFlexService.STATUSES });
    } catch (error) { return fail(res, error); }
  },
  updateAdmin: async (req, res) => {
    try {
      const actor = req.user?.email || 'admin';
      const data = await tripAddonFlexService.update(req.params.id, req.params.changeRequestId, req.body || {}, actor);
      return res.json({ success: true, data });
    } catch (error) { return fail(res, error); }
  },
};

export default tripAddonFlexController;
