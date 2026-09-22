const { Op } = require('sequelize');
const { isPostgres } = require('../config/database');

/**
 * Case-insensitive text matching, whichever database is underneath.
 *
 * MySQL's default collation compares text case-insensitively, so `LIKE` there
 * already matches "Tomato" for "TOMATO". PostgreSQL does not: `LIKE` is exact,
 * and `ILIKE` is the case-insensitive form. Written naively, moving between the
 * two silently breaks every search on the platform — a farmer texting
 * "SELL TOMATO" would be told the crop does not exist, and a buyer searching
 * "maize" would find nothing.
 *
 *   where: { name: matches(term) }              // contains, anywhere
 *   where: { code: matches(term, 'starts') }    // begins with
 */

/** The operator this database uses for case-insensitive matching. */
const LIKE = isPostgres ? Op.iLike : Op.like;

/**
 * Builds a case-insensitive pattern clause.
 *
 * `%` and `_` are wildcards in SQL, so a search for "50%" would otherwise
 * match far too much; both are escaped before the term is wrapped.
 */
function matches(term, mode = 'contains') {
  const safe = String(term ?? '').replace(/[\\%_]/g, (ch) => `\\${ch}`);
  const pattern = mode === 'starts' ? `${safe}%`
    : mode === 'ends' ? `%${safe}`
      : mode === 'exact' ? safe
        : `%${safe}%`;
  return { [LIKE]: pattern };
}

/** The raw pattern, for the few places that build their own clause. */
const pattern = (term, mode = 'contains') => matches(term, mode)[LIKE];

/**
 * Groups rows by calendar month.
 *
 * MySQL spells this DATE_FORMAT(col, '%Y-%m'); PostgreSQL has TO_CHAR with its
 * own pattern language. The same expression has to appear in SELECT, GROUP BY
 * and ORDER BY, so it is built once here.
 */
function monthExpression(sequelize, column = 'createdAt') {
  return isPostgres
    ? sequelize.fn('TO_CHAR', sequelize.col(column), 'YYYY-MM')
    : sequelize.fn('DATE_FORMAT', sequelize.col(column), '%Y-%m');
}

/**
 * Orders rows by a fixed list of values rather than alphabetically — urgent
 * tickets before low ones. MySQL has FIELD(); PostgreSQL needs a CASE, which
 * is also plain standard SQL.
 */
function orderByValues(sequelize, column, values) {
  if (!isPostgres) {
    const list = values.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(',');
    return sequelize.literal(`FIELD(${column},${list})`);
  }
  const cases = values
    .map((v, i) => `WHEN '${String(v).replace(/'/g, "''")}' THEN ${i + 1}`)
    .join(' ');
  return sequelize.literal(`CASE "${column}" ${cases} ELSE ${values.length + 1} END`);
}

module.exports = { LIKE, matches, pattern, monthExpression, orderByValues };
