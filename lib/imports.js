/* jshint node:true, undef:true, unused:true */

var assert = require('assert');
var recast = require('recast');
var types = recast.types;
var n = types.namedTypes;

var ModuleBindingList = require('./module_binding_list');
var ModuleBindingDeclaration = require('./module_binding_declaration');
var ModuleBindingSpecifier = require('./module_binding_specifier');

var utils = require('./utils');
var memo = utils.memo;
var extend = utils.extend;
var sourcePosition = utils.sourcePosition;

/**
 * Represents a list of the imports for the given module.
 *
 * @constructor
 * @param {Module} mod
 */
function ImportDeclarationList(mod) {
  ModuleBindingList.call(this, mod);
}
extend(ImportDeclarationList, ModuleBindingList);

/**
 * @private
 * @param {ast-types.Node} node
 * @return {boolean}
 */
ImportDeclarationList.prototype.isMatchingBinding = function(node) {
  return n.ImportDeclaration.check(node) || n.ModuleDeclaration.check(node);
};

/**
 * Gets an import declaration for the given `node`.
 *
 * @private
 * @param {ast-types.ImportDeclaration} node
 * @return {Import}
 */
ImportDeclarationList.prototype.declarationForNode = function(node) {
  if (n.ImportDeclaration.check(node)) {
    switch (node.kind) {
      case 'default':
        return new DefaultImportDeclaration(this.module, node);

      case 'named':
        return new NamedImportDeclaration(this.module, node);

      case undefined:
        return new BareImportDeclaration(this.module, node);

      default:
        assert.ok(false, 'unexpected import kind at ' + sourcePosition(this.module, node) + ': ' + node.kind);
        break;
    }
  } else if (n.ModuleDeclaration.check(node)) {
    return new ModuleImportDeclaration(this.module, node);
  } else {
    assert.ok(false, 'unexpected declaration node type: ' + (node && node.type));
  }
};

/**
 * Contains information about an import declaration.
 *
 * @constructor
 * @abstract
 * @param {Module} mod
 * @param {ast-types.ImportDeclaration} node
 */
function ImportDeclaration(mod, node) {
  assert.ok(
    n.ImportDeclaration.check(node) || n.ModuleDeclaration.check(node),
    'expected an import declaration, got ' + (node && node.type)
  );

  Object.defineProperties(this, {
    node: {
      value: node
    },

    module: {
      value: mod
    }
  });
}
extend(ImportDeclaration, ModuleBindingDeclaration);

/**
 * Represents a default import of the form
 *
 *   import List from 'list';
 *
 * @constructor
 * @extends ImportDeclaration
 * @param {Module} mod
 * @param {ast-types.ImportDeclaration} node
 */
function DefaultImportDeclaration(mod, node) {
  assert.equal(node.kind, 'default');
  assert.ok(
    node.specifiers.length === 1 && node.specifiers[0],
    'expected exactly one specifier for a default import, got ' +
      node.specifiers.length
  );

  ImportDeclaration.call(this, mod, node);
}
extend(DefaultImportDeclaration, ImportDeclaration);

/**
 * Gets a reference to the exported value from this import's module that
 * corresponds to the local binding created by this import with the name given
 * by `identfier`.
 *
 * @param {ast-types.Identifier|string} identifier
 * @return {ast-types.Expression}
 */
DefaultImportDeclaration.prototype.getExportReference = function(identifier) {
  var name = n.Identifier.check(identifier) ? identifier.name : identifier;
  assert.equal(
    name,
    this.node.specifiers[0].id.name,
    'no export specifier found for `' + name + '`'
  );
  return this.module.getExportReference('default');
};

/**
 * Contains a list of specifier name information for this import.
 *
 * @type {Array.<ImportSpecifier>}
 * @property specifiers
 */
memo(DefaultImportDeclaration.prototype, 'specifiers', function() {
  var specifier = new ImportSpecifier(this, this.node.specifiers[0]);
  specifier.from = 'default';
  assert.equal(specifier.from, 'default');
  return [specifier];
});

/**
 * Represents a named import of the form
 *
 *   import { sin, cos } from 'math';
 *
 * @constructor
 * @extends ImportDeclaration
 * @param {Module} mod
 * @param {ast-types.ImportDeclaration} node
 */
function NamedImportDeclaration(mod, node) {
  assert.equal(node.kind, 'named');
  ImportDeclaration.call(this, mod, node);
}
extend(NamedImportDeclaration, ImportDeclaration);

/**
 * Contains a list of specifier name information for this import.
 *
 * @type {Array.<ImportSpecifier>}
 * @property specifiers
 */
memo(NamedImportDeclaration.prototype, 'specifiers', function() {
  var self = this;
  return this.node.specifiers.map(function(specifier) {
    return new ImportSpecifier(self, specifier);
  });
});

/**
 * Represents an import with no bindings created in the local scope. These
 * imports are of the form `import 'path/to/module'` and are generally included
 * only for their side effects.
 *
 * @constructor
 * @extends ImportDeclaration
 * @param {Module} mod
 * @param {ast-types.ImportDeclaration} node
 */
function BareImportDeclaration(mod, node) {
  assert.ok(
    node.kind === undefined && node.specifiers.length === 0,
    'expected a bare import at ' + sourcePosition(mod, node) +
    ', got one with kind=' + node.kind + ' and ' +
    node.specifiers.length + ' specifier(s)'
  );
  ImportDeclaration.call(this, mod, node);
}
extend(BareImportDeclaration, ImportDeclaration);

/**
 * Returns an empty set of specifiers.
 *
 * @type {Array.<ImportSpecifier>}
 * @property specifiers
 */
memo(BareImportDeclaration.prototype, 'specifiers', function() {
  return [];
});

/**
 * Represents an import of an entire module bound to a single object. These
 * imports are of the form `module foo from 'foo'` and create a single binding.
 *
 * @constructor
 * @param {Module} mod
 * @param {ast-types.ModuleDeclaration} node
 */
function ModuleImportDeclaration(mod, node) {
  ImportDeclaration.call(this, mod, node);
}
extend(ModuleImportDeclaration, ImportDeclaration);

memo(ModuleImportDeclaration.prototype, 'specifiers', function() {
  return [];
});

memo(ModuleImportDeclaration.prototype, 'id', function() {
  return this.node.id;
});

/**
 */
function ImportSpecifier(declaration, node) {
  assert.ok(
    declaration instanceof ImportDeclaration,
    'expected an instance of ImportDeclaration'
  );
  ModuleBindingSpecifier.call(this, declaration, node);
}
extend(ImportSpecifier, ModuleBindingSpecifier);

module.exports = ImportDeclarationList;