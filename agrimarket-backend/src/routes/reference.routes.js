const router = require('express').Router();
const ctrl = require('../controllers/referenceController');
const { protect, restrictTo } = require('../middleware/auth');
const upload = require('../middleware/upload');

const adminOnly = [protect, restrictTo('admin', 'superadmin')];

// Public reference data — the website needs these before anyone signs in
router.get('/regions', ctrl.regions);
router.get('/districts', ctrl.districts);
router.get('/markets', ctrl.markets);
router.get('/categories', ctrl.categories);
router.get('/produce', ctrl.produce);
router.get('/produce/:id', ctrl.produceDetail);

// Curation
router.post('/categories', adminOnly, ctrl.createCategory);
router.patch('/categories/:id', adminOnly, ctrl.updateCategory);
router.delete('/categories/:id', adminOnly, ctrl.deleteCategory);
router.post('/categories/:id/image', adminOnly, upload.catalogImage, ctrl.uploadCategoryImage);
router.delete('/categories/:id/image', adminOnly, ctrl.resetCategoryImage);

router.post('/produce', adminOnly, ctrl.createProduce);
router.patch('/produce/:id', adminOnly, ctrl.updateProduce);
router.delete('/produce/:id', adminOnly, ctrl.deleteProduce);
router.post('/produce/:id/image', adminOnly, upload.catalogImage, ctrl.uploadProduceImage);
router.delete('/produce/:id/image', adminOnly, ctrl.resetProduceImage);

router.post('/markets', adminOnly, ctrl.createMarket);
router.patch('/markets/:id', adminOnly, ctrl.updateMarket);
router.delete('/markets/:id', adminOnly, ctrl.deleteMarket);

module.exports = router;
