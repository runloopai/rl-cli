class Conf {
  constructor(options = {}) {
    this.store = new Map();
    this.defaults = options.defaults || {};
  }

  get(key, defaultValue) {
    return this.store.get(key) ?? this.defaults[key] ?? defaultValue;
  }

  set(key, value) {
    this.store.set(key, value);
  }

  delete(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }

  has(key) {
    return this.store.has(key) || key in this.defaults;
  }

  get size() {
    return this.store.size;
  }

  *[Symbol.iterator]() {
    for (const [key, value] of this.store) {
      yield [key, value];
    }
  }
}

module.exports = Conf;
module.exports.default = Conf;
