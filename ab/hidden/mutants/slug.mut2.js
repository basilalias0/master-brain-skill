function slugify(s) { return String(s).trim().replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
module.exports = { slugify };
