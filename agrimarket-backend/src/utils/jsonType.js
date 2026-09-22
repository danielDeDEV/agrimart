const { DataTypes } = require('sequelize');

/**
 * MariaDB — which is what XAMPP ships — stores JSON as LONGTEXT and the driver
 * hands it back as a raw string rather than a parsed value. MySQL 5.7+ parses
 * it for us. Rather than making every caller defensive, each JSON column
 * declares itself through this helper so reads always produce real objects and
 * arrays on both servers.
 *
 *   images: json('images', []),
 */
function json(fieldName, defaultValue = null) {
  const fallback = () => (Array.isArray(defaultValue) ? [...defaultValue]
    : defaultValue && typeof defaultValue === 'object' ? { ...defaultValue }
      : defaultValue);

  return {
    type: DataTypes.JSON,
    defaultValue,
    get() {
      const raw = this.getDataValue(fieldName);
      if (raw === null || raw === undefined) return fallback();
      if (typeof raw !== 'string') return raw;
      try {
        const parsed = JSON.parse(raw);
        return parsed === null ? fallback() : parsed;
      } catch {
        return fallback();
      }
    },
  };
}

module.exports = { json };
