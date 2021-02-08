function _defineProperty(obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
}

function ownKeys(object, enumerableOnly) {
  var keys = Object.keys(object);

  if (Object.getOwnPropertySymbols) {
    var symbols = Object.getOwnPropertySymbols(object);
    if (enumerableOnly) symbols = symbols.filter(function (sym) {
      return Object.getOwnPropertyDescriptor(object, sym).enumerable;
    });
    keys.push.apply(keys, symbols);
  }

  return keys;
}

function _objectSpread2(target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i] != null ? arguments[i] : {};

    if (i % 2) {
      ownKeys(Object(source), true).forEach(function (key) {
        _defineProperty(target, key, source[key]);
      });
    } else if (Object.getOwnPropertyDescriptors) {
      Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    } else {
      ownKeys(Object(source)).forEach(function (key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }
  }

  return target;
}

/**
* @private
*/
class TreeIterator {
  constructor(set, type) {
    const node = set._tree;
    const keys = Object.keys(node);
    this.set = set;
    this.type = type;
    this.path = keys.length > 0 ? [{
      node,
      keys
    }] : [];
  }

  next() {
    const value = this.dive();
    this.backtrack();
    return value;
  }

  dive() {
    if (this.path.length === 0) {
      return {
        done: true
      };
    }

    const {
      node,
      keys
    } = last(this.path);

    if (last(keys) === LEAF) {
      return {
        done: false,
        value: this.result()
      };
    }

    this.path.push({
      node: node[last(keys)],
      keys: Object.keys(node[last(keys)])
    });
    return this.dive();
  }

  backtrack() {
    if (this.path.length === 0) {
      return;
    }

    last(this.path).keys.pop();

    if (last(this.path).keys.length > 0) {
      return;
    }

    this.path.pop();
    this.backtrack();
  }

  key() {
    return this.set._prefix + this.path.map(({
      keys
    }) => last(keys)).filter(key => key !== LEAF).join('');
  }

  value() {
    return last(this.path).node[LEAF];
  }

  result() {
    if (this.type === VALUES) {
      return this.value();
    }

    if (this.type === KEYS) {
      return this.key();
    }

    return [this.key(), this.value()];
  }

  [Symbol.iterator]() {
    return this;
  }

}
/** @ignore */


const ENTRIES = 'ENTRIES';
/** @ignore */

const KEYS = 'KEYS';
/** @ignore */

const VALUES = 'VALUES';
/** @ignore */

const LEAF = '';

const last = function (array) {
  return array[array.length - 1];
};

/**
* @ignore
*/

const fuzzySearch = function (node, query, maxDistance) {
  const stack = [{
    distance: 0,
    i: 0,
    key: '',
    node
  }];
  const results = {};
  const innerStack = [];

  while (stack.length > 0) {
    const {
      node,
      distance,
      key,
      i,
      edit
    } = stack.pop();
    Object.keys(node).forEach(k => {
      if (k === LEAF) {
        const totDistance = distance + (query.length - i);
        const [, d] = results[key] || [null, Infinity];

        if (totDistance <= maxDistance && totDistance < d) {
          results[key] = [node[k], totDistance];
        }
      } else {
        withinDistance(query, k, maxDistance - distance, i, edit, innerStack).forEach(({
          distance: d,
          i,
          edit
        }) => {
          stack.push({
            node: node[k],
            distance: distance + d,
            key: key + k,
            i,
            edit
          });
        });
      }
    });
  }

  return results;
};
/**
* @ignore
*/

const withinDistance = function (a, b, maxDistance, i, edit, stack) {
  stack.push({
    distance: 0,
    ia: i,
    ib: 0,
    edit
  });
  const results = [];

  while (stack.length > 0) {
    const {
      distance,
      ia,
      ib,
      edit
    } = stack.pop();

    if (ib === b.length) {
      results.push({
        distance,
        i: ia,
        edit
      });
      continue;
    }

    if (a[ia] === b[ib]) {
      stack.push({
        distance,
        ia: ia + 1,
        ib: ib + 1,
        edit: NONE
      });
    } else {
      if (distance >= maxDistance) {
        continue;
      }

      if (edit !== ADD) {
        stack.push({
          distance: distance + 1,
          ia,
          ib: ib + 1,
          edit: DELETE
        });
      }

      if (ia < a.length) {
        if (edit !== DELETE) {
          stack.push({
            distance: distance + 1,
            ia: ia + 1,
            ib,
            edit: ADD
          });
        }

        if (edit !== DELETE && edit !== ADD) {
          stack.push({
            distance: distance + 1,
            ia: ia + 1,
            ib: ib + 1,
            edit: CHANGE
          });
        }
      }
    }
  }

  return results;
};
const NONE = 0;
const CHANGE = 1;
const ADD = 2;
const DELETE = 3;

/**
* A class implementing the same interface as a standard JavaScript `Map` with
* string keys, but adding support for efficiently searching entries with prefix
* or fuzzy search. This is the class internally used by `MiniSearch` as the
* inverted index data structure. The implementation is a radix tree (compressed
* prefix tree).
*
* @implements {Map}
*/

class SearchableMap {
  constructor(tree = {}, prefix = '') {
    /** @private */
    this._tree = tree;
    /** @private */

    this._prefix = prefix;
  }
  /**
  * Creates and returns a mutable view of this `SearchableMap`, containing only
  * entries that share the given prefix.
  *
  * @example
  * let map = new SearchableMap()
  * map.set("unicorn", 1)
  * map.set("universe", 2)
  * map.set("university", 3)
  * map.set("unique", 4)
  * map.set("hello", 5)
  *
  * let uni = map.atPrefix("uni")
  * uni.get("unique") // => 4
  * uni.get("unicorn") // => 1
  * uni.get("hello") // => undefined
  *
  * let univer = map.atPrefix("univer")
  * univer.get("unique") // => undefined
  * univer.get("universe") // => 2
  * univer.get("university") // => 3
  *
  * @param {string} prefix - The prefix
  * @return {SearchableMap} A `SearchableMap` representing a mutable view of the original Map at the given prefix
  */


  atPrefix(prefix) {
    if (!prefix.startsWith(this._prefix)) {
      throw new Error('Mismatched prefix');
    }

    const [node, path] = trackDown(this._tree, prefix.slice(this._prefix.length));

    if (node === undefined) {
      const [parentNode, key] = last$1(path);
      const nodeKey = Object.keys(parentNode).find(k => k !== LEAF && k.startsWith(key));

      if (nodeKey !== undefined) {
        return new SearchableMap({
          [nodeKey.slice(key.length)]: parentNode[nodeKey]
        }, prefix);
      }
    }

    return new SearchableMap(node || {}, prefix);
  }
  /**
  * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/clear
  * @return {undefined}
  */


  clear() {
    delete this._size;
    this._tree = {};
  }
  /**
  * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/delete
  * @param {string} key
  * @return {undefined}
  */


  delete(key) {
    delete this._size;
    return remove(this._tree, key);
  }
  /**
  * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/entries
  * @return {Iterator}
  */


  entries() {
    return new TreeIterator(this, ENTRIES);
  }
  /**
   * @callback SearchableMap~forEachFn
   * @param {string} key - Key
   * @param {any} value - Value associated to key
   * @return any
   */

  /**
  * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/forEach
  * @param {SearchableMap~forEachFn} fn
  * @return {undefined}
  */


  forEach(fn) {
    for (const [key, value] of this) {
      fn(key, value, this);
    }
  }
  /**
  * Returns a key-value object of all the entries that have a key within the
  * given edit distance from the search key. The keys of the returned object are
  * the matching keys, while the values are two-elements arrays where the first
  * element is the value associated to the key, and the second is the edit
  * distance of the key to the search key.
  *
  * @example
  * let map = new SearchableMap()
  * map.set('hello', 'world')
  * map.set('hell', 'yeah')
  * map.set('ciao', 'mondo')
  *
  * // Get all entries that match the key 'hallo' with a maximum edit distance of 2
  * map.fuzzyGet('hallo', 2)
  * // => { "hello": ["world", 1], "hell": ["yeah", 2] }
  *
  * // In the example, the "hello" key has value "world" and edit distance of 1
  * // (change "e" to "a"), the key "hell" has value "yeah" and edit distance of 2
  * // (change "e" to "a", delete "o")
  *
  * @param {string} key - The search key
  * @param {number} maxEditDistance - The maximum edit distance
  * @return {Object<string, Array>} A key-value object of the matching keys to their value and edit distance
  */


  fuzzyGet(key, maxEditDistance) {
    return fuzzySearch(this._tree, key, maxEditDistance);
  }
  /**
  * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/get
  * @param {string} key
  * @return {any}
  */


  get(key) {
    const node = lookup(this._tree, key);
    return node !== undefined ? node[LEAF] : undefined;
  }
  /**
  * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/has
  * @param {string} key
  * @return {boolean}
  */


  has(key) {
    const node = lookup(this._tree, key);
    return node !== undefined && node.hasOwnProperty(LEAF);
  }
  /**
  * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/keys
  * @return {Iterator}
  */


  keys() {
    return new TreeIterator(this, KEYS);
  }
  /**
  * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/set
  * @param {string} key
  * @param {any} value
  * @return {SearchableMap} The `SearchableMap` itself, to allow chaining
  */


  set(key, value) {
    if (typeof key !== 'string') {
      throw new Error('key must be a string');
    }

    delete this._size;
    const node = createPath(this._tree, key);
    node[LEAF] = value;
    return this;
  }
  /**
  * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/size
  * @type {number}
  */


  get size() {
    if (this._size) {
      return this._size;
    }
    /** @ignore */


    this._size = 0;
    this.forEach(() => {
      this._size += 1;
    });
    return this._size;
  }
  /**
   * @callback SearchableMap~updateFn
   * @param {any} currentValue - The current value
   * @return any - the updated value
   */

  /**
  * Updates the value at the given key using the provided function. The function
  * is called with the current value at the key, and its return value is used as
  * the new value to be set.
  *
  * @example
  * // Increment the current value by one
  * searchableMap.update('somekey', (currentValue) => currentValue == null ? 0 : currentValue + 1)
  *
  * @param {string} key - The key
  * @param {SearchableMap~updateFn} fn - The function used to compute the new value from the current one
  * @return {SearchableMap} The `SearchableMap` itself, to allow chaining
  */


  update(key, fn) {
    if (typeof key !== 'string') {
      throw new Error('key must be a string');
    }

    delete this._size;
    const node = createPath(this._tree, key);
    node[LEAF] = fn(node[LEAF]);
    return this;
  }
  /**
  * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/values
  * @return {Iterator}
  */


  values() {
    return new TreeIterator(this, VALUES);
  }
  /**
  * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map/@@iterator
  * @return {Iterator}
  */


  [Symbol.iterator]() {
    return this.entries();
  }

}
/**
* Creates a `SearchableMap` from an `Iterable` of entries
*
* @param {Iterable|Array} entries - Entries to be inserted in the `SearchableMap`
* @return {SearchableMap} A new `SearchableMap` with the given entries
**/


SearchableMap.from = function (entries) {
  const tree = new SearchableMap();

  for (const [key, value] of entries) {
    tree.set(key, value);
  }

  return tree;
};
/**
* Creates a `SearchableMap` from the iterable properties of a JavaScript object
*
* @param {Object} object - Object of entries for the `SearchableMap`
* @return {SearchableMap} A new `SearchableMap` with the given entries
**/


SearchableMap.fromObject = function (object) {
  return SearchableMap.from(Object.entries(object));
};

const trackDown = function (tree, key, path = []) {
  if (key.length === 0) {
    return [tree, path];
  }

  const nodeKey = Object.keys(tree).find(k => k !== LEAF && key.startsWith(k));

  if (nodeKey === undefined) {
    return trackDown(undefined, '', [...path, [tree, key]]);
  }

  return trackDown(tree[nodeKey], key.slice(nodeKey.length), [...path, [tree, nodeKey]]);
};

const lookup = function (tree, key) {
  if (key.length === 0) {
    return tree;
  }

  const nodeKey = Object.keys(tree).find(k => k !== LEAF && key.startsWith(k));

  if (nodeKey === undefined) {
    return undefined;
  }

  return lookup(tree[nodeKey], key.slice(nodeKey.length));
};

const createPath = function (tree, key) {
  if (key.length === 0) {
    return tree;
  }

  const nodeKey = Object.keys(tree).find(k => k !== LEAF && key.startsWith(k));

  if (nodeKey === undefined) {
    const toSplit = Object.keys(tree).find(k => k !== LEAF && k.startsWith(key[0]));

    if (toSplit === undefined) {
      tree[key] = {};
    } else {
      const prefix = commonPrefix(key, toSplit);
      tree[prefix] = {
        [toSplit.slice(prefix.length)]: tree[toSplit]
      };
      delete tree[toSplit];
      return createPath(tree[prefix], key.slice(prefix.length));
    }

    return tree[key];
  }

  return createPath(tree[nodeKey], key.slice(nodeKey.length));
};

const commonPrefix = function (a, b, i = 0, length = Math.min(a.length, b.length), prefix = '') {
  if (i >= length) {
    return prefix;
  }

  if (a[i] !== b[i]) {
    return prefix;
  }

  return commonPrefix(a, b, i + 1, length, prefix + a[i]);
};

const remove = function (tree, key) {
  const [node, path] = trackDown(tree, key);

  if (node === undefined) {
    return;
  }

  delete node[LEAF];
  const keys = Object.keys(node);

  if (keys.length === 0) {
    cleanup(path);
  }

  if (keys.length === 1) {
    merge(path, keys[0], node[keys[0]]);
  }
};

const cleanup = function (path) {
  if (path.length === 0) {
    return;
  }

  const [node, key] = last$1(path);
  delete node[key];

  if (Object.keys(node).length === 0) {
    cleanup(path.slice(0, -1));
  }
};

const merge = function (path, key, value) {
  if (path.length === 0) {
    return;
  }

  const [node, nodeKey] = last$1(path);
  node[nodeKey + key] = value;
  delete node[nodeKey];
};

const last$1 = function (array) {
  return array[array.length - 1];
};

const OR = 'or';
const AND = 'and';
/**
* MiniSearch is the main entrypoint class, and represents a full-text search
* engine.
*
* @example
* const documents = [
*   {
*     id: 1,
*     title: 'Moby Dick',
*     text: 'Call me Ishmael. Some years ago...',
*     category: 'fiction'
*   },
*   {
*     id: 2,
*     title: 'Zen and the Art of Motorcycle Maintenance',
*     text: 'I can see by my watch...',
*     category: 'fiction'
*   },
*   {
*     id: 3,
*     title: 'Neuromancer',
*     text: 'The sky above the port was...',
*     category: 'fiction'
*   },
*   {
*     id: 4,
*     title: 'Zen and the Art of Archery',
*     text: 'At first sight it must seem...',
*     category: 'non-fiction'
*   },
*   // ...and more
* ]
*
* // Create a search engine that indexes the 'title' and 'text' fields for
* // full-text search. Search results will include 'title' and 'category' (plus the
* // id field, that is always stored and returned)
* const miniSearch = MiniSearch.new({
*   fields: ['title', 'text'],
*   storeFields: ['title', 'category']
* })
*
* // Add documents to the index
* miniSearch.addAll(documents)
*
* // Search for documents:
* let results = miniSearch.search('zen art motorcycle')
* // => [
*   { id: 2, title: 'Zen and the Art of Motorcycle Maintenance', category: 'fiction', score: 2.77258 },
*   { id: 4, title: 'Zen and the Art of Archery', category: 'non-fiction', score: 1.38629 }
* ]
* */

class MiniSearch {
  /**
   * @callback MiniSearch~extractField
   * @param {Object} document - A document object
   * @param {string} fieldName - Name of the field to extract
   * @return string - Value of the field
   */

  /**
   * @callback MiniSearch~tokenize
   * @param {string} text - Text to tokenize
   * @param {?string} fieldName - Name of the field to tokenize
   * @return string[] - Tokenized terms
   */

  /**
   * @callback MiniSearch~processTerm
   * @param {string} text - The text to tokenize
   * @param {?string} fieldName - The name of the field to tokenize
   * @return string|null|undefined|false - Processed term, or a falsy value to discard the term
   */

  /**
  * @param {Object} options - Configuration options
  * @param {Array<string>} options.fields - Fields to be indexed. Required.
  * @param {string} [options.idField='id'] - ID field, uniquely identifying a document
  * @param {Array<string>} [options.storeFields] - Fields to store, so that search results would include them. By default none, so resuts would only contain the id field.
  * @param {MiniSearch~extractField} [options.extractField] - Function used to get the value of a field in a document
  * @param {MiniSearch~tokenize} [options.tokenize] - Function used to split a field into individual terms
  * @param {MiniSearch~processTerm} [options.processTerm] - Function used to process a term before indexing it or searching
  * @param {Object} [options.searchOptions] - Default search options (see the `search` method for details)
  *
  * @example
  * // Create a search engine that indexes the 'title' and 'text' fields of your
  * // documents:
  * const miniSearch = MiniSearch.new({ fields: ['title', 'text'] })
  *
  * @example
  * // Your documents are assumed to include a unique 'id' field, but if you want
  * // to use a different field for document identification, you can set the
  * // 'idField' option:
  * const miniSearch = MiniSearch.new({ idField: 'key', fields: ['title', 'text'] })
  *
  * @example
  * // The full set of options (here with their default value) is:
  * const miniSearch = MiniSearch.new({
  *   // idField: field that uniquely identifies a document
  *   idField: 'id',
  *
  *   // extractField: function used to get the value of a field in a document.
  *   // By default, it assumes the document is a flat object with field names as
  *   // property keys and field values as string property values, but custom logic
  *   // can be implemented by setting this option to a custom extractor function.
  *   extractField: (document, fieldName) => document[fieldName],
  *
  *   // tokenize: function used to split fields into individual terms. By
  *   // default, it is also used to tokenize search queries, unless a specific
  *   // `tokenize` search option is supplied. When tokenizing an indexed field,
  *   // the field name is passed as the second argument.
  *   tokenize: (string, _fieldName) => string.split(SPACE_OR_PUNCTUATION),
  *
  *   // processTerm: function used to process each tokenized term before
  *   // indexing. It can be used for stemming and normalization. Return a falsy
  *   // value in order to discard a term. By default, it is also used to process
  *   // search queries, unless a specific `processTerm` option is supplied as a
  *   // search option. When processing a term from a indexed field, the field
  *   // name is passed as the second argument.
  *   processTerm: (term, _fieldName) => term.toLowerCase(),
  *
  *   // searchOptions: default search options, see the `search` method for
  *   // details
  *   searchOptions: undefined,
  *
  *   // fields: document fields to be indexed. Mandatory, but not set by default
  *   fields: undefined
  *
  *   // storeFields: document fields to be stored and returned as part of the
  *   // search results.
  *   storeFields: []
  * })
  */
  constructor(options = {}) {
    /** @private */
    this._options = _objectSpread2(_objectSpread2({}, defaultOptions), options);
    this._options.searchOptions = _objectSpread2(_objectSpread2({}, defaultSearchOptions), this._options.searchOptions || {});
    const {
      fields
    } = this._options;

    if (fields == null) {
      throw new Error('MiniSearch: option "fields" must be provided');
    }
    /** @private */


    this._index = new SearchableMap();
    /** @private */

    this._documentCount = 0;
    /** @private */

    this._documentIds = {};
    /** @private */

    this._fieldIds = {};
    /** @private */

    this._fieldLength = {};
    /** @private */

    this._averageFieldLength = {};
    /** @private */

    this._nextId = 0;
    /** @private */

    this._storedFields = {};
    addFields(this, fields);
  }
  /**
  * Adds a document to the index
  *
  * @param {Object} document - the document to be indexed
  */


  add(document) {
    const {
      extractField,
      tokenize,
      processTerm,
      fields,
      idField
    } = this._options;

    if (getOwnProperty(document, idField) == null) {
      throw new Error(`MiniSearch: document does not have ID field "${idField}"`);
    }

    const shortDocumentId = addDocumentId(this, document[idField]);
    saveStoredFields(this, shortDocumentId, document);
    fields.forEach(field => {
      const fieldValue = extractField(document, field);
      const tokens = tokenize(fieldValue == null ? '' : fieldValue.toString(), field);
      addFieldLength(this, shortDocumentId, this._fieldIds[field], this.documentCount - 1, tokens.length);
      tokens.forEach(term => {
        const processedTerm = processTerm(term, field);

        if (isTruthy(processedTerm)) {
          addTerm(this, this._fieldIds[field], shortDocumentId, processedTerm);
        }
      });
    });
  }
  /**
  * Adds all the given documents to the index
  *
  * @param {Object[]} documents - an array of documents to be indexed
  */


  addAll(documents) {
    documents.forEach(document => this.add(document));
  }
  /**
  * Adds all the given documents to the index asynchronously.
  *
  * Returns a promise that resolves to undefined when the indexing is done. This
  * method is useful when index many documents, to avoid blocking the main
  * thread. The indexing is performed asynchronously and in chunks.
  *
  * @param {Object[]} documents - an array of documents to be indexed
  * @param {Object} [options] - Configuration options
  * @param {number} [options.chunkSize] - Size of the document chunks indexed, 10 by default
  * @return {Promise} A promise resolving to `null` when the indexing is done
  */


  addAllAsync(documents, options = {}) {
    const {
      chunkSize = 10
    } = options;
    const acc = {
      chunk: [],
      promise: Promise.resolve(null)
    };
    const {
      chunk,
      promise
    } = documents.reduce(({
      chunk,
      promise
    }, document, i) => {
      chunk.push(document);

      if ((i + 1) % chunkSize === 0) {
        return {
          chunk: [],
          promise: promise.then(() => this.addAll(chunk))
        };
      } else {
        return {
          chunk,
          promise
        };
      }
    }, acc);
    return promise.then(() => this.addAll(chunk));
  }
  /**
  * Removes the given document from the index.
  *
  * The document to delete must NOT have changed between indexing and deletion,
  * otherwise the index will be corrupted. Therefore, when reindexing a document
  * after a change, the correct order of operations is:
  *
  *   1. remove old version
  *   2. apply changes
  *   3. index new version
  *
  * @param {Object} document - the document to be removed
  */


  remove(document) {
    const {
      tokenize,
      processTerm,
      extractField,
      fields,
      idField
    } = this._options;

    if (getOwnProperty(document, idField) == null) {
      throw new Error(`MiniSearch: document does not have ID field "${idField}"`);
    }

    const [shortDocumentId] = Object.entries(this._documentIds).find(([_, longId]) => document[idField] === longId) || [];

    if (shortDocumentId == null) {
      throw new Error(`MiniSearch: cannot remove document with ID ${document[idField]}: it is not in the index`);
    }

    fields.filter(field => getOwnProperty(document, field) != null).forEach(field => {
      const tokens = tokenize(extractField(document, field) || '', field);
      tokens.forEach(term => {
        const processedTerm = processTerm(term, field);

        if (isTruthy(processedTerm)) {
          removeTerm(this, this._fieldIds[field], shortDocumentId, processedTerm);
        }
      });
    });
    delete this._storedFields[shortDocumentId];
    delete this._documentIds[shortDocumentId];
    this._documentCount -= 1;
  }
  /**
  * Removes all the given documents from the index. If called with no arguments,
  * it removes _all_ documents from the index.
  *
  * @param {Array<Object>} [documents] - the documents to be removed
  */


  removeAll(documents) {
    if (arguments.length === 0) {
      this._index = new SearchableMap();
      this._documentCount = 0;
      this._documentIds = {};
      this._fieldLength = {};
      this._averageFieldLength = {};
      this._storedFields = {};
      this._nextId = 0;
    } else {
      documents.forEach(document => this.remove(document));
    }
  }
  /**
   * @callback MiniSearch~prefixFn
   * @param {string} term - Search term
   * @param {number} i - Index of the term in the query terms array
   * @param {string[]} terms - Array of all query terms
   * @return boolean - `true` to perform prefix search, `false` to not perform it
   */

  /**
   * @callback MiniSearch~fuzzyFn
   * @param {string} term - Search term
   * @param {number} i - Index of the search term in the tokenized search query
   * @param {string[]} terms - Array of all query terms
   * @return number|false - Maximum edit distance, or `false` to not perform fuzzy search
   */

  /**
   * @callback MiniSearch~filter
   * @param {Object} result - A search result
   * @return boolean - `true` to keep the result, `false` to filter it out
   */

  /**
  * Search for documents matching the given search query.
  *
  * The result is a list of scored document IDs matching the query, sorted by
  * descending score, and each including data about which terms were matched and
  * in which fields.
  *
  * @param {string} queryString - Query string to search for
  * @param {Object} [options] - Search options. Each option, if not given, defaults to the corresponding value of `searchOptions` given to the constructor, or to the library default.
  * @param {Array<string>} [options.fields] - Fields to search in. If omitted, all fields are searched
  * @param {Object<string, number>} [options.boost] - Key-value object of boosting values for fields
  * @param {boolean|MiniSearch~prefixFn} [options.prefix=false] - Whether to perform prefix search. Value can be a boolean, or a function computing the boolean from each tokenized and processed query term. If a function is given, it is called with the following arguments: `term: string` - the query term; `i: number` - the term index in the query terms; `terms: Array<string>` - the array of query terms.
  * @param {number|false|MiniSearch~fuzzyFn} [options.fuzzy=false] - If set to a number greater than or equal 1, it performs fuzzy search within a maximum edit distance equal to that value. If set to a number less than 1, it performs fuzzy search with a maximum edit distance equal to the term length times the value, rouded at the nearest integer. If set to a function, it calls the function for each tokenized and processed query term and expects a numeric value indicating the maximum edit distance, or a falsy falue if fuzzy search should not be performed. If a function is given, it is called with the following arguments: `term: string` - the query term; `i: number` - the term index in the query terms; `terms: Array<string>` - the array of query terms.
  * @param {string} [options.combineWith='OR'] - How to combine term queries (it can be 'OR' or 'AND')
  * @param {MiniSearch~tokenize} [options.tokenize] - Function used to tokenize the search query. It defaults to the same tokenizer used for indexing.
  * @param {MiniSearch~processTerm} [options.processTerm] - Function used to process each search term. Return a falsy value to discard a term. Defaults to the same function used to process terms upon indexing.
  * @param {MiniSearch~filter} [options.filter] - Function used to filter search results, for example on the basis of stored fields
  * @return {Array<{ id: any, score: number, match: Object }>} A sorted array of scored document IDs matching the search
  *
  * @example
  * // Search for "zen art motorcycle" with default options: terms have to match
  * // exactly, and individual terms are joined with OR
  * miniSearch.search('zen art motorcycle')
  * // => [ { id: 2, score: 2.77258, match: { ... } }, { id: 4, score: 1.38629, match: { ... } } ]
  *
  * @example
  * // Search only in the 'title' field
  * miniSearch.search('zen', { fields: ['title'] })
  *
  * @example
  * // Boost a field
  * miniSearch.search('zen', { boost: { title: 2 } })
  *
  * @example
  * // Search for "moto" with prefix search (it will match documents
  * // containing terms that start with "moto" or "neuro")
  * miniSearch.search('moto neuro', { prefix: true })
  *
  * @example
  * // Search for "ismael" with fuzzy search (it will match documents containing
  * // terms similar to "ismael", with a maximum edit distance of 0.2 term.length
  * // (rounded to nearest integer)
  * miniSearch.search('ismael', { fuzzy: 0.2 })
  *
  * @example
  * // Mix of exact match, prefix search, and fuzzy search
  * miniSearch.search('ismael mob', {
  *  prefix: true,
  *  fuzzy: 0.2
  * })
  *
  * @example
  * // Perform fuzzy and prefix search depending on the search term. Here
  * // performing prefix and fuzzy search only on terms longer than 3 characters
  * miniSearch.search('ismael mob', {
  *  prefix: term => term.length > 3
  *  fuzzy: term => term.length > 3 ? 0.2 : null
  * })
  *
  * @example
  * // Combine search terms with AND (to match only documents that contain both
  * // "motorcycle" and "art")
  * miniSearch.search('motorcycle art', { combineWith: 'AND' })
  *
  * @example
  * // Filter only results in the 'fiction' category (assuming that 'category'
  * // is a stored field)
  * miniSearch.search('motorcycle art', {
  *   filter: (result) => result.category === 'fiction'
  * })
  */


  search(queryString, options = {}) {
    const {
      tokenize,
      processTerm,
      searchOptions
    } = this._options;
    options = _objectSpread2(_objectSpread2({
      tokenize,
      processTerm
    }, searchOptions), options);
    const {
      tokenize: searchTokenize,
      processTerm: searchProcessTerm
    } = options;
    const queries = searchTokenize(queryString).map(term => searchProcessTerm(term)).filter(isTruthy).map(termToQuery(options));
    const results = queries.map(query => this.executeQuery(query, options));
    const combinedResults = this.combineResults(results, options.combineWith);
    return Object.entries(combinedResults).reduce((results, [docId, {
      score,
      match,
      terms,
      tfScores
    }]) => {
      const result = {
        id: this._documentIds[docId],
        terms: uniq(terms),
        allTerms: terms,
        score,
        match,
        tfScores
      };
      Object.assign(result, this._storedFields[docId]);

      if (options.filter == null || options.filter(result)) {
        results.push(result);
      }

      return results;
    }, []).sort(({
      score: a
    }, {
      score: b
    }) => a < b ? 1 : -1);
  }
  /**
  * Provide suggestions for the given search query
  *
  * The result is a list of suggested modified search queries, derived from the
  * given search query, each with a relevance score, sorted by descending score.
  *
  * @param {string} queryString - Query string to be expanded into suggestions
  * @param {Object} [options] - Search options. The supported options and default values are the same as for the `search` method, except that by default prefix search is performed on the last term in the query.
  * @return {Array<{ suggestion: string, score: number }>} A sorted array of suggestions sorted by relevance score.
  *
  * @example
  * // Get suggestions for 'neuro':
  * miniSearch.autoSuggest('neuro')
  * // => [ { suggestion: 'neuromancer', terms: [ 'neuromancer' ], score: 0.46240 } ]
  *
  * @example
  * // Get suggestions for 'zen ar':
  * miniSearch.autoSuggest('zen ar')
  * // => [
  * //  { suggestion: 'zen archery art', terms: [ 'zen', 'archery', 'art' ], score: 1.73332 },
  * //  { suggestion: 'zen art', terms: [ 'zen', 'art' ], score: 1.21313 }
  * // ]
  *
  * @example
  * // Correct spelling mistakes using fuzzy search:
  * miniSearch.autoSuggest('neromancer', { fuzzy: 0.2 })
  * // => [ { suggestion: 'neuromancer', terms: [ 'neuromancer' ], score: 1.03998 } ]
  *
  * @example
  * // Get suggestions for 'zen ar', but only within the 'fiction' category
  * // (assuming that 'category' is a stored field):
  * miniSearch.autoSuggest('zen ar', {
  *   filter: (result) => result.category === 'fiction'
  * })
  * // => [
  * //  { suggestion: 'zen archery art', terms: [ 'zen', 'archery', 'art' ], score: 1.73332 },
  * //  { suggestion: 'zen art', terms: [ 'zen', 'art' ], score: 1.21313 }
  * // ]
  */


  autoSuggest(queryString, options = {}) {
    options = _objectSpread2(_objectSpread2({}, defaultAutoSuggestOptions), options);
    const suggestions = this.search(queryString, options).reduce((suggestions, {
      score,
      terms
    }) => {
      const phrase = terms.join(' ');

      if (suggestions[phrase] == null) {
        suggestions[phrase] = {
          score,
          terms,
          count: 1
        };
      } else {
        suggestions[phrase].score += score;
        suggestions[phrase].count += 1;
      }

      return suggestions;
    }, {});
    return Object.entries(suggestions).map(([suggestion, {
      score,
      terms,
      count
    }]) => ({
      suggestion,
      terms,
      score: score / count
    })).sort(({
      score: a
    }, {
      score: b
    }) => a < b ? 1 : -1);
  }
  /**
  * Number of documents in the index
  *
  * @type {number}
  */


  get documentCount() {
    return this._documentCount;
  }
  /**
  * Deserializes a JSON index (serialized with `miniSearch.toJSON()`) and
  * instantiates a MiniSearch instance. It should be given the same options
  * originally used when serializing the index.
  *
  * **Warning:** JSON (de)serialization of the index is currently tightly
  * coupled to the index implementation. For this reason, the current
  * implementation is to be considered a _beta_ feature, subject to breaking
  * changes changes in future releases. If a breaking change is introduced,
  * though, it will be properly reported in the changelog.
  *
  * @param {string} json - JSON-serialized index
  * @param {Object} options - configuration options, same as the constructor
  * @return {MiniSearch} an instance of MiniSearch
  */


  static loadJSON(json, options) {
    if (options == null) {
      throw new Error('MiniSearch: loadJSON should be given the same options used when serializing the index');
    }

    return MiniSearch.loadJS(JSON.parse(json), options);
  }
  /**
  * Get the default value of an option. It will throw an error if no option with
  * the given name exists.
  *
  * @param {string} optionName - name of the option
  * @return {any} the default value of the given option
  *
  * @example
  * // Get default tokenizer
  * MiniSearch.getDefault('tokenize')
  *
  * @example
  * // Get default term processor
  * MiniSearch.getDefault('processTerm')
  *
  * @example
  * // Unknown options will throw an error
  * MiniSearch.getDefault('notExisting')
  * // => throws 'MiniSearch: unknown option "notExisting"'
  */


  static getDefault(optionName) {
    if (defaultOptions.hasOwnProperty(optionName)) {
      return defaultOptions[optionName];
    } else {
      throw new Error(`MiniSearch: unknown option "${optionName}"`);
    }
  }
  /**
  * @private
  */


  static loadJS(js, options = {}) {
    const {
      index,
      documentCount,
      nextId,
      documentIds,
      fieldIds,
      fieldLength,
      averageFieldLength,
      storedFields
    } = js;
    const miniSearch = new MiniSearch(options);
    miniSearch._index = new SearchableMap(index._tree, index._prefix);
    miniSearch._documentCount = documentCount;
    miniSearch._nextId = nextId;
    miniSearch._documentIds = documentIds;
    miniSearch._fieldIds = fieldIds;
    miniSearch._fieldLength = fieldLength;
    miniSearch._averageFieldLength = averageFieldLength;
    miniSearch._fieldIds = fieldIds;
    miniSearch._storedFields = storedFields || {};
    return miniSearch;
  }
  /**
  * @private
  * @ignore
  */


  executeQuery(query, options = {}) {
    options = _objectSpread2(_objectSpread2({}, this._options.searchOptions), options);

    const boosts = (options.fields || this._options.fields).reduce((boosts, field) => _objectSpread2(_objectSpread2({}, boosts), {}, {
      [field]: getOwnProperty(boosts, field) || 1
    }), options.boost || {});

    const {
      boostDocument,
      weights: {
        fuzzy: fuzzyWeight = 0.9,
        prefix: prefixWeight = 0.75
      }
    } = options;
    const exactMatch = termResults(this, query.term, boosts, boostDocument, this._index.get(query.term));

    if (!query.fuzzy && !query.prefix) {
      return exactMatch;
    }

    const results = [exactMatch];

    if (query.prefix) {
      this._index.atPrefix(query.term).forEach((term, data) => {
        const weightedDistance = 0.3 * (term.length - query.term.length) / term.length;
        results.push(termResults(this, term, boosts, boostDocument, data, prefixWeight, weightedDistance));
      });
    }

    if (query.fuzzy) {
      const maxDistance = query.fuzzy < 1 ? Math.round(query.term.length * query.fuzzy) : query.fuzzy;
      Object.entries(this._index.fuzzyGet(query.term, maxDistance)).forEach(([term, [data, distance]]) => {
        const weightedDistance = distance / term.length;
        results.push(termResults(this, term, boosts, boostDocument, data, fuzzyWeight, weightedDistance));
      });
    }

    return results.reduce(combinators[OR], {});
  }
  /**
  * @private
  * @ignore
  */


  combineResults(results, combineWith = OR) {
    if (results.length === 0) {
      return {};
    }

    const operator = combineWith.toLowerCase();
    return results.reduce(combinators[operator], null);
  }
  /**
  * Allows serialization of the index to JSON, to possibly store it and later
  * deserialize it with MiniSearch.loadJSON
  *
  * **Warning:** JSON (de)serialization of the index is currently tightly
  * coupled to the index implementation. For this reason, the current
  * implementation is to be considered a _beta_ feature, subject to breaking
  * changes changes in future releases. If a breaking change is introduced,
  * though, it will be reported in the changelog.
  *
  * @return {Object} the serializeable representation of the search index
  */


  toJSON() {
    return {
      index: this._index,
      documentCount: this._documentCount,
      nextId: this._nextId,
      documentIds: this._documentIds,
      fieldIds: this._fieldIds,
      fieldLength: this._fieldLength,
      averageFieldLength: this._averageFieldLength,
      storedFields: this._storedFields
    };
  }

}

MiniSearch.SearchableMap = SearchableMap;

const addTerm = function (self, fieldId, documentId, term) {
  self._index.update(term, indexData => {
    indexData = indexData || {};
    const fieldIndex = indexData[fieldId] || {
      df: 0,
      ds: {}
    };

    if (fieldIndex.ds[documentId] == null) {
      fieldIndex.df += 1;
    }

    fieldIndex.ds[documentId] = (fieldIndex.ds[documentId] || 0) + 1;
    return _objectSpread2(_objectSpread2({}, indexData), {}, {
      [fieldId]: fieldIndex
    });
  });
};

const removeTerm = function (self, fieldId, documentId, term) {
  if (!self._index.has(term)) {
    warnDocumentChanged(self, documentId, fieldId, term);
    return;
  }

  self._index.update(term, indexData => {
    const fieldIndex = indexData[fieldId];

    if (fieldIndex == null || fieldIndex.ds[documentId] == null) {
      warnDocumentChanged(self, documentId, fieldId, term);
      return indexData;
    }

    if (fieldIndex.ds[documentId] <= 1) {
      if (fieldIndex.df <= 1) {
        delete indexData[fieldId];
        return indexData;
      }

      fieldIndex.df -= 1;
    }

    if (fieldIndex.ds[documentId] <= 1) {
      delete fieldIndex.ds[documentId];
      return indexData;
    }

    fieldIndex.ds[documentId] -= 1;
    return _objectSpread2(_objectSpread2({}, indexData), {}, {
      [fieldId]: fieldIndex
    });
  });

  if (Object.keys(self._index.get(term)).length === 0) {
    self._index.delete(term);
  }
};

const warnDocumentChanged = function (self, shortDocumentId, fieldId, term) {
  if (console == null || console.warn == null) {
    return;
  }

  const fieldName = Object.entries(self._fieldIds).find(([name, id]) => id === fieldId)[0];
  console.warn(`MiniSearch: document with ID ${self._documentIds[shortDocumentId]} has changed before removal: term "${term}" was not present in field "${fieldName}". Removing a document after it has changed can corrupt the index!`);
};

const addDocumentId = function (self, documentId) {
  const shortDocumentId = self._nextId.toString(36);

  self._documentIds[shortDocumentId] = documentId;
  self._documentCount += 1;
  self._nextId += 1;
  return shortDocumentId;
};

const addFields = function (self, fields) {
  fields.forEach((field, i) => {
    self._fieldIds[field] = i;
  });
};

const termResults = function (self, term, boosts, boostDocument, indexData, weight = 1, editDistance = 0) {
  if (indexData == null) {
    return {};
  }

  return Object.entries(boosts).reduce((results, [field, boost]) => {
    const fieldId = self._fieldIds[field];
    const {
      df,
      ds
    } = indexData[fieldId] || {
      ds: {}
    };
    Object.entries(ds).forEach(([documentId, tf]) => {
      const docBoost = boostDocument ? boostDocument(self._documentIds[documentId], term) : 1;

      if (!docBoost) {
        return;
      }

      const normalizedLength = self._fieldLength[documentId][fieldId] / self._averageFieldLength[fieldId];
      results[documentId] = results[documentId] || {
        score: 0,
        match: {},
        terms: [],
        tfScores: []
      };
      results[documentId].terms.push(term);
      results[documentId].match[term] = getOwnProperty(results[documentId].match, term) || [];
      const scorePart = docBoost * score(tf, df, self._documentCount, normalizedLength, boost, editDistance);
      results[documentId].score += scorePart;
      results[documentId].tfScores.push(scorePart);
      results[documentId].match[term].push(field);
    });
    return results;
  }, {});
};

const getOwnProperty = function (object, property) {
  return Object.prototype.hasOwnProperty.call(object, property) ? object[property] : undefined;
};

const addFieldLength = function (self, documentId, fieldId, count, length) {
  self._averageFieldLength[fieldId] = self._averageFieldLength[fieldId] || 0;
  const totalLength = self._averageFieldLength[fieldId] * count + length;
  self._fieldLength[documentId] = self._fieldLength[documentId] || {};
  self._fieldLength[documentId][fieldId] = length;
  self._averageFieldLength[fieldId] = totalLength / (count + 1);
};

const saveStoredFields = function (self, documentId, doc) {
  const {
    storeFields,
    extractField
  } = self._options;

  if (storeFields == null || storeFields.length === 0) {
    return;
  }

  self._storedFields[documentId] = self._storedFields[documentId] || {};
  storeFields.forEach(fieldName => {
    const fieldValue = extractField(doc, fieldName);

    if (fieldValue === undefined) {
      return;
    }

    self._storedFields[documentId][fieldName] = fieldValue;
  });
};

const combinators = {
  [OR]: function (a, b) {
    return Object.entries(b).reduce((combined, [documentId, {
      score,
      match,
      terms,
      tfScores
    }]) => {
      if (combined[documentId] == null) {
        combined[documentId] = {
          score,
          match,
          terms,
          tfScores
        };
      } else {
        combined[documentId].score += score;
        combined[documentId].score *= 1.5;
        combined[documentId].tfScores = [...combined[documentId].tfScores, ...tfScores];
        combined[documentId].terms = [...combined[documentId].terms, ...terms];
        Object.assign(combined[documentId].match, match);
      }

      return combined;
    }, a || {});
  },
  [AND]: function (a, b) {
    if (a == null) {
      return b;
    }

    return Object.entries(b).reduce((combined, [documentId, {
      score,
      match,
      terms,
      tfScores
    }]) => {
      if (a[documentId] === undefined) {
        return combined;
      }

      combined[documentId] = combined[documentId] || {};
      combined[documentId].score = a[documentId].score + score;
      combined[documentId].tfScores = [...a[documentId].tfScores, ...tfScores];
      combined[documentId].match = _objectSpread2(_objectSpread2({}, a[documentId].match), match);
      combined[documentId].terms = [...a[documentId].terms, ...terms];
      return combined;
    }, {});
  }
};

const tfIdf = function (tf, df, n) {
  return tf * Math.log(n / df);
};

const score = function (termFrequency, documentFrequency, documentCount, normalizedLength, boost, editDistance) {
  const weight = boost / (1 + 0.333 * boost * editDistance);
  return weight * tfIdf(termFrequency, documentFrequency, documentCount) / normalizedLength;
};

const termToQuery = options => (term, i, terms) => {
  const fuzzy = typeof options.fuzzy === 'function' ? options.fuzzy(term, i, terms) : options.fuzzy;
  const prefix = typeof options.prefix === 'function' ? options.prefix(term, i, terms) : options.prefix;
  return {
    term,
    fuzzy,
    prefix
  };
};

const uniq = function (array) {
  return array.filter((element, i, array) => array.indexOf(element) === i);
};

const isTruthy = x => !!x;

const defaultOptions = {
  idField: 'id',
  extractField: (document, fieldName) => document[fieldName],
  tokenize: (string, _fieldName) => string.split(SPACE_OR_PUNCTUATION),
  processTerm: (term, _fieldName) => term.toLowerCase(),
  fields: undefined,
  searchOptions: undefined,
  storeFields: []
};
const defaultSearchOptions = {
  combineWith: OR,
  prefix: false,
  fuzzy: false,
  weights: {}
};
const defaultAutoSuggestOptions = {
  prefix: (term, i, terms) => i === terms.length - 1
}; // This regular expression matches any Unicode space or punctuation character
// Adapted from https://unicode.org/cldr/utility/list-unicodeset.jsp?a=%5Cp%7BZ%7D%5Cp%7BP%7D&abb=on&c=on&esc=on

const SPACE_OR_PUNCTUATION = /[\n\r -#%-*,-/:;?@[-\]_{}\u00A0\u00A1\u00A7\u00AB\u00B6\u00B7\u00BB\u00BF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061E\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u09FD\u0A76\u0AF0\u0C77\u0C84\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166E\u1680\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2000-\u200A\u2010-\u2029\u202F-\u2043\u2045-\u2051\u2053-\u205F\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E4F\u3000-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]+/u;

export default MiniSearch;
//# sourceMappingURL=index.js.map
