/**
 * Backs study objective 5 — evaluating whether the platform actually improves
 * market participation and income. One row per farmer per survey period, so the
 * admin analytics page can compare baseline against current performance.
 */
module.exports = (sequelize, DataTypes) => {
  const ImpactRecord = sequelize.define('ImpactRecord', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    period: { type: DataTypes.STRING(20), allowNull: false, comment: 'YYYY-Qn or YYYY-MM' },
    surveyType: { type: DataTypes.ENUM('baseline', 'midline', 'endline'), defaultValue: 'baseline' },

    monthlyIncomeBefore: { type: DataTypes.DECIMAL(12, 2), comment: 'GHS, self reported pre-platform' },
    monthlyIncomeAfter: { type: DataTypes.DECIMAL(12, 2) },
    incomeChangePercent: { type: DataTypes.DECIMAL(8, 2) },

    buyersReachedBefore: { type: DataTypes.INTEGER, defaultValue: 0 },
    buyersReachedAfter: { type: DataTypes.INTEGER, defaultValue: 0 },
    marketsAccessedBefore: { type: DataTypes.INTEGER, defaultValue: 0 },
    marketsAccessedAfter: { type: DataTypes.INTEGER, defaultValue: 0 },

    postHarvestLossBefore: { type: DataTypes.DECIMAL(5, 2), comment: 'Percent of harvest lost' },
    postHarvestLossAfter: { type: DataTypes.DECIMAL(5, 2) },
    avgPriceReceivedBefore: { type: DataTypes.DECIMAL(12, 2) },
    avgPriceReceivedAfter: { type: DataTypes.DECIMAL(12, 2) },
    travelCostSaved: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },

    soldThroughPlatform: { type: DataTypes.BOOLEAN, defaultValue: false },
    usesUssd: { type: DataTypes.BOOLEAN, defaultValue: false },
    usesSms: { type: DataTypes.BOOLEAN, defaultValue: false },
    usesWeb: { type: DataTypes.BOOLEAN, defaultValue: false },

    satisfactionScore: { type: DataTypes.INTEGER, validate: { min: 1, max: 5 } },
    wouldRecommend: { type: DataTypes.BOOLEAN },
    feedback: { type: DataTypes.TEXT },
    collectedBy: { type: DataTypes.INTEGER },
    collectionMethod: { type: DataTypes.ENUM('ussd', 'sms', 'web', 'field_agent', 'phone'), defaultValue: 'field_agent' },
  }, {
    tableName: 'impact_records',
    timestamps: true,
    indexes: [{ fields: ['userId'] }, { fields: ['period'] }, { fields: ['surveyType'] }],
    hooks: {
      beforeSave: (rec) => {
        const before = Number(rec.monthlyIncomeBefore || 0);
        const after = Number(rec.monthlyIncomeAfter || 0);
        if (before > 0) {
          rec.incomeChangePercent = Number((((after - before) / before) * 100).toFixed(2));
        }
      },
    },
  });

  return ImpactRecord;
};
