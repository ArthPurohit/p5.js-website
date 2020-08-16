(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.App = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// https://github.com/umdjs/umd/blob/master/templates/returnExports.js
(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.DocumentedMethod = factory();
  }
}(this, function () {
  function extend(target, src) {
    Object.keys(src).forEach(function(prop) {
      target[prop] = src[prop];
    });
    return target;
  }

  function DocumentedMethod(classitem) {
    extend(this, classitem);

    if (this.overloads) {
      // Make each overload inherit properties from their parent
      // classitem.
      this.overloads = this.overloads.map(function(overload) {
        return extend(Object.create(this), overload);
      }, this);

      if (this.params) {
        throw new Error('params for overloaded methods should be undefined');
      }

      this.params = this._getMergedParams();
    }
  }

  DocumentedMethod.prototype = {
    // Merge parameters across all overloaded versions of this item.
    _getMergedParams: function() {
      var paramNames = {};
      var params = [];

      this.overloads.forEach(function(overload) {
        if (!overload.params) {
          return;
        }
        overload.params.forEach(function(param) {
          if (param.name in paramNames) {
            return;
          }
          paramNames[param.name] = param;
          params.push(param);
        });
      });

      return params;
    }
  };

  return DocumentedMethod;
}));

},{}],2:[function(require,module,exports){
const DocumentedMethod = require('./documented-method.js');
const router = require('./router.js');

/**
 * Define global App.
 */
var App = window.App || {};

/**
 * Load json API data and start the router.
 * @param {module} App
 * @param {module} router
 */
// Set collections
App.collections = [
  'allItems',
  'classes',
  'events',
  'methods',
  'properties',
  'p5.sound'
];

// Get json API data
$.getJSON('data.min.json', function(data) {
  App.data = data;
  App.classes = [];
  App.methods = [];
  App.properties = [];
  App.events = [];
  App.allItems = [];
  App.sound = { items: [] };
  App.dom = { items: [] };
  App.modules = [];
  App.project = data.project;

  var modules = data.modules;

  // Get class items (methods, properties, events)
  _.each(modules, function(m, idx, array) {
    App.modules.push(m);
    if (m.name === 'p5.sound') {
      App.sound.module = m;
    }
  });

  var items = data.classitems;
  var classes = data.classes;

  // Get classes
  _.each(classes, function(c, idx, array) {
    if (!c.private) {
      App.classes.push(c);
    }
  });

  // Get class items (methods, properties, events)
  _.each(items, function(el, idx, array) {
    if (el.itemtype) {
      if (el.itemtype === 'method') {
        el = new DocumentedMethod(el);
        App.methods.push(el);
        App.allItems.push(el);
      } else if (el.itemtype === 'property') {
        App.properties.push(el);
        App.allItems.push(el);
      } else if (el.itemtype === 'event') {
        App.events.push(el);
        App.allItems.push(el);
      }

      // libraries
      if (el.module === 'p5.sound') {
        App.sound.items.push(el);
      }
    }
  });

  _.each(App.classes, function(c, idx) {
    c.items = _.filter(App.allItems, function(it) {
      return it.class === c.name;
    });
  });

  router(App);
});

module.exports = App;

},{"./documented-method.js":1,"./router.js":3}],3:[function(require,module,exports){
module.exports = function(App) {
  const pageView = require('./views/pageView.js')(App);

  var Router = Backbone.Router.extend({
    routes: {
      '': 'list',
      p5: 'list',
      'p5/': 'list',
      classes: 'list',
      search: 'search',
      'libraries/:lib': 'library',
      ':searchClass(/:searchItem)': 'get'
    },
    /**
     * Whether the json API data was loaded.
     */
    _initialized: false,
    /**
     * Initialize the app: load json API data and create searchable arrays.
     */
    init: function(callback) {
      var self = this;

      // If already initialized, move away from here!
      if (self._initialized) {
        if (callback) {
          callback();
        }
        return;
      }

      // Update initialization state: must be done now to avoid recursive mess
      self._initialized = true;

      // Render views
      if (!App.pageView) {
        App.pageView = new pageView();
        App.pageView.init().render();
      }

      // If a callback is set (a route has already been called), run it
      // otherwise, show the default list
      if (callback) {
        callback();
      } else {
        self.list();
      }
    },
    /**
     * Start route. Simply check if initialized.
     */
    start: function() {
      this.init();
    },
    /**
     * Show item details by searching a class or a class item (method, property or event).
     * @param {string} searchClass The class name (mandatory).
     * @param {string} searchItem The class item name: can be a method, property or event name.
     */
    get: function(searchClass, searchItem) {
      // if looking for a library page, redirect
      if (searchClass === 'p5.sound' && !searchItem) {
        window.location.hash = '/libraries/' + searchClass;
        return;
      }

      var self = this;
      this.init(function() {
        var item = self.getItem(searchClass, searchItem);

        App.menuView.hide();

        if (item) {
          App.itemView.show(item);
        } else {
          //App.itemView.nothingFound();

          self.list();
        }

        styleCodeLinks();
      });
    },
    /**
     * Returns one item object by searching a class or a class item (method, property or event).
     * @param {string} searchClass The class name (mandatory).
     * @param {string} searchItem The class item name: can be a method, property or event name.
     * @returns {object} The item found or undefined if nothing was found.
     */
    getItem: function(searchClass, searchItem) {
      var classes = App.classes,
        items = App.allItems,
        classesCount = classes.length,
        itemsCount = items.length,
        className = searchClass ? searchClass.toLowerCase() : undefined,
        itemName = searchItem ? searchItem : undefined,
        found;

      // Only search for a class, if itemName is undefined
      if (className && !itemName) {
        for (let i = 0; i < classesCount; i++) {
          if (classes[i].name.toLowerCase() === className) {
            found = classes[i];
            _.each(found.items, function(i, idx) {
              i.hash = App.router.getHash(i);
            });
            break;
          }
        }
        // Search for a class item
      } else if (className && itemName) {
        // Search case sensitively
        for (let i = 0; i < itemsCount; i++) {
          if (
            items[i].class.toLowerCase() === className &&
            items[i].name === itemName
          ) {
            found = items[i];
            break;
          }
        }

        // If no match was found, fallback to search case insensitively
        if (!found) {
          for (var i = 0; i < itemsCount; i++) {
            if (
              items[i].class.toLowerCase() === className &&
              items[i].name.toLowerCase() === itemName.toLowerCase()
            ) {
              found = items[i];
              break;
            }
          }
        }
      }

      return found;
    },
    /**
     * List items.
     * @param {string} collection The name of the collection to list.
     */
    list: function(collection) {
      collection = 'allItems';

      // Make sure collection is valid
      if (App.collections.indexOf(collection) < 0) {
        return;
      }

      this.init(function() {
        App.menuView.show(collection);
        App.menuView.update(collection);
        App.listView.show(collection);
        styleCodeLinks();
      });
    },
    /**
     * Display information for a library.
     * @param {string} collection The name of the collection to list.
     */
    library: function(collection) {
      this.init(function() {
        App.menuView.hide();
        App.libraryView.show(collection.substring(3)); //remove p5.
        styleCodeLinks();
      });
    },
    /**
     * Close all content views.
     */
    search: function() {
      this.init(function() {
        App.menuView.hide();
        App.pageView.hideContentViews();
      });
    },

    /**
     * Create an hash/url for the item.
     * @param {Object} item A class, method, property or event object.
     * @returns {String} The hash string, including the '#'.
     */
    getHash: function(item) {
      if (!item.hash) {
        // FIX TO INVISIBLE OBJECTS: DH (see also listView.js)

        if (item.class) {
          var clsFunc = '#/' + item.class + '.' + item.name;
          var idx = clsFunc.lastIndexOf('.');
          item.hash =
            clsFunc.substring(0, idx) + '/' + clsFunc.substring(idx + 1);
        } else {
          item.hash = '#/' + item.name;
        }
      }

      return item.hash;
    }
  });

  function styleCodeLinks() {
    var links = document.getElementsByTagName('a');
    for (var iLink = 0; iLink < links.length; iLink++) {
      var link = links[iLink];
      if (link.hash.startsWith('#/p5')) {
        link.classList.add('code');
      }
    }
  }
  // Get the router
  App.router = new Router();

  // Start history
  Backbone.history.start();

  return App.router;
};

},{"./views/pageView.js":8}],4:[function(require,module,exports){

const itemTpl = "<h2><%=item.name%><% if (item.isMethod) { %>()<% } %></h2>\n\n<% if (item.example) { %>\n<div class=\"example\">\n  <h3 id=\"reference-example\">Examples</h3>\n\n  <div class=\"example-content\" data-alt=\"<%= item.alt %>\">\n    <% _.each(item.example, function(example, i){ %>\n      <%= example %>\n    <% }); %>\n  </div>\n</div>\n<% } %>\n\n<div class=\"description\">\n    \n  <h3 id=\"reference-description\">Description</h3>\n\n  <% if (item.deprecated) { %>\n    <p>\n      Deprecated: <%=item.name%><% if (item.isMethod) { %>()<% } %> is deprecated and will be removed in a future version of p5. <% if (item.deprecationMessage) { %><%=item.deprecationMessage%><% } %>\n    </p>\n  <% } %>\n      \n\n  <span class='description-text'><%= item.description %></span>\n\n  <% if (item.extends) { %>\n    <p><span id=\"reference-extends\">Extends</span> <a href=\"/reference/#/<%=item.extends%>\" title=\"<%=item.extends%> reference\"><%=item.extends%></a></p>\n  <% } %>\n\n  <% if (item.module === 'p5.sound') { %>\n    <p>This function requires you include the p5.sound library.  Add the following into the head of your index.html file:\n      <pre><code class=\"language-javascript\">&lt;script src=\"path/to/p5.sound.js\"&gt;&lt;/script&gt;</code></pre>\n    </p>\n  <% } %>\n\n  <% if (item.constRefs) { %>\n    <p>Used by:\n  <%\n      var refs = item.constRefs;\n      for (var i = 0; i < refs.length; i ++) {\n        var ref = refs[i];\n        var name = ref;\n        if (name.substr(0, 3) === 'p5.') {\n          name = name.substr(3);\n        }\n  if (i !== 0) {\n          if (i == refs.length - 1) {\n            %> and <%\n          } else {\n            %>, <%\n          }\n        }\n        %><a href=\"./#/<%= ref.replace('.', '/') %>\"><%= name %>()</a><%\n      }\n  %>\n    </p>\n  <% } %>\n</div>\n\n<% if (isConstructor || !isClass) { %>\n\n<div>\n  <h3 id=\"reference-syntax\">Syntax</h3>\n  <p>\n    <% syntaxes.forEach(function(syntax) { %>\n    <pre><code class=\"language-javascript\"><%= syntax %></code></pre>\n    <% }) %>\n  </p>\n</div>\n\n\n<% if (item.params) { %>\n  <div class=\"params\">\n    <h3 id=\"reference-parameters\">Parameters</h3>\n    <ul aria-labelledby='reference-parameters'>\n    <% for (var i=0; i<item.params.length; i++) { %>\n      <% var p = item.params[i] %>\n      <li>\n        <div class='paramname'><%=p.name%></div>\n        <% if (p.type) { %>\n          <div class='paramtype'>\n          <% var type = p.type.replace(/(p5\\.[A-Z][A-Za-z]*)/, '<a href=\"#/$1\">$1</a>'); %>\n          <span class=\"param-type label label-info\"><%=type%></span>: <%=p.description%>\n          <% if (p.optional) { %> (Optional)<% } %>\n          </div>\n        <% } %>\n      </li>\n    <% } %>\n    </ul>\n  </div>\n<% } %>\n\n<% if (item.return && item.return.type) { %>\n  <div>\n    <h3 id=\"reference-returns\">Returns</h3>\n    <p class='returns'><span class=\"param-type label label-info\"><%=item.return.type%></span>: <%= item.return.description %></p>\n  </div>\n<% } %>\n\n<% } %>\n";
const classTpl = "\n<% if (typeof constructor !== 'undefined') { %>\n<div class=\"constructor\">\n  <%=constructor%>\n</div>\n<% } %>\n\n<% let fields = _.filter(things, function(item) { return item.itemtype === 'property' && item.access !== 'private' }); %>\n<% if (fields.length > 0) { %>\n  <h3 id='reference-fields'>Fields</h3>\n  <ul aria-labelledby='reference-fields'>\n  <% _.each(fields, function(item) { %>\n    <li>\n      <div class='paramname'><a href=\"<%=item.hash%>\" <% if (item.module !== module) { %>class=\"addon\"<% } %>><%=item.name%></a></div>\n      <div class='paramtype'><%= item.description %></div>\n    </li>\n  <% }); %>\n  </ul>\n<% } %>\n\n<% let methods = _.filter(things, function(item) { return item.itemtype === 'method' && item.access !== 'private' }); %>\n<% if (methods.length > 0) { %>\n  <h3 id='reference-methods'>Methods</h3>\n  <ul aria-labelledby='reference-methods'>\n    <% _.each(methods, function(item) { %>\n      <li>\n        <div class='paramname'><a href=\"<%=item.hash%>\" <% if (item.module !== module) { %>class=\"addon\"<% } %>><%=item.name%><% if (item.itemtype === 'method') { %>()<%}%></a></div>\n        <div class='paramtype'><%= item.description %></div>\n      </li>\n    <% }); %>\n  </ul>\n<% } %>\n";
const endTpl = "\n<br><br>\n\n<div>\n<% if (item.file && item.line) { %>\n<span id=\"reference-error1\">Notice any errors or typos?</span> <a href=\"https://github.com/processing/p5.js/issues\"><span id=\"reference-contribute2\">Please let us know.</span></a> <span id=\"reference-error3\">Please feel free to edit</span> <a href=\"https://github.com/processing/p5.js/blob/<%= appVersion %>/<%= item.file %>#L<%= item.line %>\" target=\"_blank\" ><%= item.file %></a> <span id=\"reference-error5\">and issue a pull request!</span>\n<% } %>\n</div>\n\n<a style=\"border-bottom:none !important;\" href=\"http://creativecommons.org/licenses/by-nc-sa/4.0/\" target=_blank><img src=\"https://i.creativecommons.org/l/by-nc-sa/4.0/88x31.png\" style=\"width:88px\" alt=\"creative commons logo\"/></a>\n<br><br>\n";

module.exports = function(App) {
  var appVersion = App.project.version || 'master';

  var itemView = Backbone.View.extend({
    el: '#item',
    init: function() {
      this.$html = $('html');
      this.$body = $('body');
      this.$scrollBody = $('html, body'); // hack for Chrome/Firefox scroll

      this.tpl = _.template(itemTpl);
      this.classTpl = _.template(classTpl);
      this.endTpl = _.template(endTpl);

      return this;
    },
    getSyntax: function(isMethod, cleanItem) {
      var isConstructor = cleanItem.is_constructor;
      var syntax = '';
      if (isConstructor) {
        syntax += 'new ';
      } else if (cleanItem.static && cleanItem.class) {
        syntax += cleanItem.class + '.';
      }
      syntax += cleanItem.name;

      if (isMethod || isConstructor) {
        syntax += '(';
        if (cleanItem.params) {
          for (var i = 0; i < cleanItem.params.length; i++) {
            var p = cleanItem.params[i];
            if (p.optional) {
              syntax += '[';
            }
            syntax += p.name;
            if (p.optdefault) {
              syntax += '=' + p.optdefault;
            }
            if (p.optional) {
              syntax += ']';
            }
            if (i !== cleanItem.params.length - 1) {
              syntax += ', ';
            }
          }
        }
        syntax += ')';
      }

      return syntax;
    },
    // Return a list of valid syntaxes across all overloaded versions of
    // this item.
    //
    // For reference, we ultimately want to replicate something like this:
    //
    // https://processing.org/reference/color_.html
    getSyntaxes: function(isMethod, cleanItem) {
      var overloads = cleanItem.overloads || [cleanItem];
      return overloads.map(this.getSyntax.bind(this, isMethod));
    },
    render: function(item) {
      if (item) {
        var itemHtml = '';
        var cleanItem = this.clean(item);
        var isClass = item.hasOwnProperty('itemtype') ? 0 : 1;
        var collectionName = isClass
            ? 'Constructor'
            : this.capitalizeFirst(cleanItem.itemtype),
          isConstructor = cleanItem.is_constructor;
        cleanItem.isMethod = collectionName === 'Method';

        var syntaxes = this.getSyntaxes(cleanItem.isMethod, cleanItem);

        // Set the item header (title)

        // Set item contents
        if (isClass) {
          var constructor = this.tpl({
            item: cleanItem,
            isClass: true,
            isConstructor: isConstructor,
            syntaxes: syntaxes
          });
          cleanItem.constructor = constructor;

          var contents = _.find(App.classes, function(c) {
            return c.name === cleanItem.name;
          });
          cleanItem.things = contents.items;

          itemHtml = this.classTpl(cleanItem);
        } else {
          cleanItem.constRefs =
            item.module === 'Constants' && App.data.consts[item.name];

          itemHtml = this.tpl({
            item: cleanItem,
            isClass: false,
            isConstructor: false,
            syntaxes: syntaxes
          });
        }

        itemHtml += this.endTpl({ item: cleanItem, appVersion: appVersion });

        // Insert the view in the dom
        this.$el.html(itemHtml);

        renderCode(cleanItem.name);

        // Set the document title based on the item name.
        // If it is a method, add parentheses to the name
        if (item.itemtype === 'method') {
          App.pageView.appendToDocumentTitle(item.name + '()');
        } else {
          App.pageView.appendToDocumentTitle(item.name);
        }

        // Hook up alt-text for examples
        setTimeout(function() {
          var alts = $('.example-content')[0];
          if (alts) {
            alts = $(alts)
              .data('alt')
              .split('\n');

            var canvases = $('.cnv_div');
            for (var j = 0; j < alts.length; j++) {
              if (j < canvases.length) {
                $(canvases[j]).append(
                  '<span class="sr-only">' + alts[j] + '</span>'
                );
              }
            }
          }
        }, 1000);
        Prism.highlightAll();
      }

      var renderEvent = new Event('reference-rendered');
      window.dispatchEvent(renderEvent);

      return this;
    },
    /**
     * Clean item properties: url encode properties containing paths.
     * @param {object} item The item object.
     * @returns {object} Returns the same item object with urlencoded paths.
     */
    clean: function(item) {
      var cleanItem = item;

      if (cleanItem.hasOwnProperty('file')) {
        cleanItem.urlencodedfile = encodeURIComponent(item.file);
      }
      return cleanItem;
    },
    /**
     * Show a single item.
     * @param {object} item Item object.
     * @returns {object} This view.
     */
    show: function(item) {
      if (item) {
        this.render(item);
      }

      App.pageView.hideContentViews();

      this.$el.show();

      this.scrollTop();
      $('#item').focus();
      return this;
    },
    /**
     * Show a message if no item is found.
     * @returns {object} This view.
     */
    nothingFound: function() {
      this.$el.html(
        '<p><br><br>Ouch. I am unable to find any item that match the current query.</p>'
      );
      App.pageView.hideContentViews();
      this.$el.show();

      return this;
    },
    /**
     * Scroll to the top of the window with an animation.
     */
    scrollTop: function() {
      // Hack for Chrome/Firefox scroll animation
      // Chrome scrolls 'body', Firefox scrolls 'html'
      var scroll = this.$body.scrollTop() > 0 || this.$html.scrollTop() > 0;
      if (scroll) {
        this.$scrollBody.animate({ scrollTop: 0 }, 600);
      }
    },
    /**
     * Helper method to capitalize the first letter of a string
     * @param {string} str
     * @returns {string} Returns the string.
     */
    capitalizeFirst: function(str) {
      return str.substr(0, 1).toUpperCase() + str.substr(1);
    }
  });

  return itemView;
};

},{}],5:[function(require,module,exports){

const libraryTpl = "<h3><%= module.name %> library</h3>\n\n<p><%= module.description %></p>\n\n<div id=\"library-page\" class=\"reference-group clearfix\">  \n\n<% var t = 0; col = 0; %>\n\n<% _.each(groups, function(group){ %>\n  <% if (t == 0) { %> \n    <div class=\"column_<%=col%>\">\n  <% } %>\n  <% if (group.name !== module.name && group.name !== 'p5') { %>\n    <% if (group.hash) { %> <a href=\"<%=group.hash%>\" <% if (group.module !== module.name) { %>class=\"core\"<% } %>><% } %>  \n    <h4 class=\"group-name <% if (t == 0) { %> first<%}%>\"><%=group.name%></h4>\n    <% if (group.hash) { %> </a><br> <% } %>\n  <% } %>\n  <% _.each(group.items.filter(function(item) {return item.access !== 'private'}), function(item) { %>\n    <a href=\"<%=item.hash%>\" <% if (item.module !== module.name) { %>class=\"core\"<% } %>><%=item.name%><% if (item.itemtype === 'method') { %>()<%}%></a><br>\n    <% t++; %>\n  <% }); %>\n  <% if (t >= Math.floor(totalItems/4)) { col++; t = 0; %>\n    </div>\n  <% } %>\n<% }); %>\n</div>\n";

module.exports = function(App) {
  var libraryView = Backbone.View.extend({
    el: '#list',
    events: {},
    /**
     * Init.
     */
    init: function() {
      this.libraryTpl = _.template(libraryTpl);

      return this;
    },
    /**
     * Render the list.
     */
    render: function(m, listCollection) {
      if (m && listCollection) {
        var self = this;

        // Render items and group them by module
        // module === group
        this.groups = {};
        _.each(m.items, function(item, i) {
          var module = item.module || '_';
          var group;
          // Override default group with a selected category
          // TODO: Overwriting with the first category might not be the best choice
          // We might also want to have links for categories
          if (item.category && item.category[0]) {
            group = item.category[0];
            // Populate item.hash
            App.router.getHash(item);

            // Create a group list without link hash
            if (!self.groups[group]) {
              self.groups[group] = {
                name: group.replace('_', '&nbsp;'),
                module: module,
                hash: undefined,
                items: []
              };
            }
          } else {
            group = item.class || '_';
            var hash = App.router.getHash(item);

            var ind = hash.lastIndexOf('/');
            hash = hash.substring(0, ind);

            // Create a group list
            if (!self.groups[group]) {
              self.groups[group] = {
                name: group.replace('_', '&nbsp;'),
                module: module,
                hash: hash,
                items: []
              };
            }
          }

          self.groups[group].items.push(item);
        });

        // Sort groups by name A-Z
        self.groups = _.sortBy(self.groups, this.sortByName);

        // Put the <li> items html into the list <ul>
        var libraryHtml = self.libraryTpl({
          title: self.capitalizeFirst(listCollection),
          module: m.module,
          totalItems: m.items.length,
          groups: self.groups
        });

        // Render the view
        this.$el.html(libraryHtml);
      }

      return this;
    },
    /**
     * Show a list of items.
     * @param {array} items Array of item objects.
     * @returns {object} This view.
     */
    show: function(listGroup) {
      if (App[listGroup]) {
        this.render(App[listGroup], listGroup);
      }
      App.pageView.hideContentViews();

      this.$el.show();

      return this;
    },
    /**
     * Helper method to capitalize the first letter of a string
     * @param {string} str
     * @returns {string} Returns the string.
     */
    capitalizeFirst: function(str) {
      return str.substr(0, 1).toUpperCase() + str.substr(1);
    },
    /**
     * Sort function (for the Array.prototype.sort() native method): from A to Z.
     * @param {string} a
     * @param {string} b
     * @returns {Array} Returns an array with elements sorted from A to Z.
     */
    sortAZ: function(a, b) {
      return a.innerHTML.toLowerCase() > b.innerHTML.toLowerCase() ? 1 : -1;
    },

    sortByName: function(a, b) {
      if (a.name === 'p5') {
        return -1;
      } else {
        return 0;
      }
    }
  });

  return libraryView;
};

},{}],6:[function(require,module,exports){

const listTpl = "<% _.each(groups, function(group){ %>\n  <div class=\"reference-group clearfix main-ref-page\">  \n    <h2 class=\"group-name\" id=\"group-<%=group.name%>\" tab-index=\"-1\"><%=group.name%></h2>\n    <div class=\"reference-subgroups clearfix main-ref-page\">  \n    <% _.each(group.subgroups, function(subgroup, ind) { %>\n      <div class=\"reference-subgroup\">\n        <% if (subgroup.name !== '0') { %>\n          <h3 id=\"<%=group.name%><%=ind%>\" class=\"subgroup-name subgroup-<%=subgroup.name%>\"><%=subgroup.name%></h3>\n        <% } %>\n        <ul aria-labelledby=\"<%=group.name%> <%=ind%>\">\n        <% _.each(subgroup.items, function(item) { %>\n        <li><a href=\"<%=item.hash%>\"><%=item.name%><% if (item.itemtype === 'method') { %>()<%}%></a></li>\n        <% }); %>\n        </ul>\n      </div>\n    <% }); %>\n    </div>\n  </div>\n<% }); %>\n";

module.exports = function(App) {
  var striptags = function(html) {
    var div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent;
  };

  var listView = Backbone.View.extend({
    el: '#list',
    events: {},
    /**
     * Init.
     */
    init: function() {
      this.listTpl = _.template(listTpl);

      return this;
    },
    /**
     * Render the list.
     */
    render: function(items, listCollection) {
      if (items && listCollection) {
        var self = this;

        // Render items and group them by module
        // module === group
        this.groups = {};
        _.each(items, function(item, i) {
          if (!item.private && item.file.indexOf('addons') === -1) {
            //addons don't get displayed on main page
            var group = item.module || '_';
            var subgroup = item.submodule || '_';
            if (group === subgroup) {
              subgroup = '0';
            }
            var hash = App.router.getHash(item);

            // fixes broken links for #/p5/> and #/p5/>=
            item.hash = item.hash.replace('>', '&gt;');

            // Create a group list
            if (!self.groups[group]) {
              self.groups[group] = {
                name: group.replace('_', '&nbsp;'),
                subgroups: {}
              };
            }

            // Create a subgroup list
            if (!self.groups[group].subgroups[subgroup]) {
              self.groups[group].subgroups[subgroup] = {
                name: subgroup.replace('_', '&nbsp;'),
                items: []
              };
            }

            // hide the un-interesting constants
            if (group === 'Constants' && !item.example) {
              return;
            }

            if (item.class === 'p5') {
              self.groups[group].subgroups[subgroup].items.push(item);
            } else {
              var found = _.find(
                self.groups[group].subgroups[subgroup].items,
                function(i) {
                  return i.name === item.class;
                }
              );

              if (!found) {
                // FIX TO INVISIBLE OBJECTS: DH (see also router.js)
                var ind = hash.lastIndexOf('/');
                hash = item.hash.substring(0, ind).replace('p5/', 'p5.');
                self.groups[group].subgroups[subgroup].items.push({
                  name: item.class,
                  hash: hash
                });
              }
            }
          }
        });

        // Put the <li> items html into the list <ul>
        var listHtml = self.listTpl({
          striptags: striptags,
          title: self.capitalizeFirst(listCollection),
          groups: self.groups,
          listCollection: listCollection
        });

        // Render the view
        this.$el.html(listHtml);
      }

      var renderEvent = new Event('reference-rendered');
      window.dispatchEvent(renderEvent);

      return this;
    },
    /**
     * Show a list of items.
     * @param {array} items Array of item objects.
     * @returns {object} This view.
     */
    show: function(listGroup) {
      if (App[listGroup]) {
        this.render(App[listGroup], listGroup);
      }
      App.pageView.hideContentViews();

      this.$el.show();

      return this;
    },
    /**
     * Helper method to capitalize the first letter of a string
     * @param {string} str
     * @returns {string} Returns the string.
     */
    capitalizeFirst: function(str) {
      return str.substr(0, 1).toUpperCase() + str.substr(1);
    }
  });

  return listView;
};

},{}],7:[function(require,module,exports){

const menuTpl = "<div>\n  <br>\n  <span id=\"reference-description1\">Can't find what you're looking for? You may want to check out</span>\n  <a href=\"#/libraries/p5.sound\">p5.sound</a>.<br><a href='https://p5js.org/offline-reference/p5-reference.zip' target=_blank><span id=\"reference-description3\">You can also download an offline version of the reference.</span></a>\n</div>\n\n<div id='collection-list-categories'>\n<h2 class=\"sr-only\" id=\"categories\">Categories</h2>\n<% var i=0; %>\n<% var max=Math.floor(groups.length/4); %>\n<% var rem=groups.length%4; %>\n\n<% _.each(groups, function(group){ %>\n  <% var m = rem > 0 ? 1 : 0 %>\n  <% if (i === 0) { %>\n    <ul aria-labelledby=\"categories\">\n    <% } %>\n    <li><a href=\"#group-<%=group%>\"><%=group%></a></li>\n    <% if (i === (max+m-1)) { %>\n    </ul>\n  \t<% rem-- %>\n  \t<% i=0 %>\n  <% } else { %>\n  \t<% i++ %>\n  <% } %>\n<% }); %>\n</div>\n";

module.exports = function(App) {
  var menuView = Backbone.View.extend({
    el: '#collection-list-nav',
    /**
     * Init.
     * @returns {object} This view.
     */
    init: function() {
      this.menuTpl = _.template(menuTpl);
      return this;
    },
    /**
     * Render.
     * @returns {object} This view.
     */
    render: function() {
      var groups = [];
      _.each(App.modules, function(item, i) {
        if (!item.is_submodule) {
          if (!item.file || item.file.indexOf('addons') === -1) {
            //addons don't get displayed on main page
            groups.push(item.name);
          }
        }
        //}
      });

      // Sort groups by name A-Z
      groups.sort();

      var menuHtml = this.menuTpl({
        groups: groups
      });

      // Render the view
      this.$el.html(menuHtml);
    },

    hide: function() {
      this.$el.hide();
    },

    show: function() {
      this.$el.show();
    },

    /**
     * Update the menu.
     * @param {string} el The name of the current route.
     */
    update: function(menuItem) {
      //console.log(menuItem);
      // this.$menuItems.removeClass('active');
      // this.$menuItems.find('a[href=#'+menuItem+']').parent().addClass('active');
    }
  });

  return menuView;
};

},{}],8:[function(require,module,exports){
module.exports = function(App) {
  const menuView = require('./menuView.js')(App);
  const itemView = require('./itemView.js')(App);
  const listView = require('./listView.js')(App);
  const libraryView = require('./libraryView.js')(App);
  const searchView = require('./searchView.js')(App);

  // Store the original title parts so we can substitue different endings.
  var _originalDocumentTitle = window.document.title;

  var pageView = Backbone.View.extend({
    el: 'body',
    /**
     * Init.
     */
    init: function() {
      App.$container = $('#container');
      App.contentViews = [];

      return this;
    },
    /**
     * Render.
     */
    render: function() {
      // Menu view
      if (!App.menuView) {
        App.menuView = new menuView();
        App.menuView.init().render();
      }

      // Item view
      if (!App.itemView) {
        App.itemView = new itemView();
        App.itemView.init().render();
        // Add the item view to the views array
        App.contentViews.push(App.itemView);
      }

      // List view
      if (!App.listView) {
        App.listView = new listView();
        App.listView.init().render();
        // Add the list view to the views array
        App.contentViews.push(App.listView);
      }

      // Library view
      if (!App.libraryView) {
        App.libraryView = new libraryView();
        App.libraryView.init().render();
        // Add the list view to the views array
        App.contentViews.push(App.libraryView);
      }

      // Search
      if (!App.searchView) {
        App.searchView = new searchView();
        App.searchView.init().render();
      }
      return this;
    },
    /**
     * Hide item and list views.
     * @returns {object} This view.
     */
    hideContentViews: function() {
      _.each(App.contentViews, function(view, i) {
        view.$el.hide();
      });

      return this;
    },
    /**
     * Append the supplied name to the first part of original document title.
     * If no name is supplied, the title will reset to the original one.
     */
    appendToDocumentTitle: function(name) {
      if (name) {
        let firstTitlePart = _originalDocumentTitle.split(' | ')[0];
        window.document.title = [firstTitlePart, name].join(' | ');
      } else {
        window.document.title = _originalDocumentTitle;
      }
    }
  });

  return pageView;
};

},{"./itemView.js":4,"./libraryView.js":5,"./listView.js":6,"./menuView.js":7,"./searchView.js":9}],9:[function(require,module,exports){

const searchTpl = "<h2 class=\"sr-only\">search</h2>\n<form>\n  <input id=\"search_reference_field\" type=\"text\" class=\"<%=className%>\" value=\"\" placeholder=\"<%=placeholder%>\" aria-label=\"search reference\">\n  <label class=\"sr-only\" for=\"search_reference_field\">Search reference</label>\n</form>\n\n";
const suggestionTpl = "<p id=\"index-<%=idx%>\" class=\"search-suggestion\">\n\n  <strong><%=name%></strong>\n\n  <span class=\"small\">\n    <% if (final) { %>\n    constant\n    <% } else if (itemtype) { %>\n    <%=itemtype%> \n    <% } %>\n\n    <% if (className) { %>\n    in <strong><%=className%></strong>\n    <% } %>\n\n    <% if (typeof is_constructor !== 'undefined' && is_constructor) { %>\n    <strong><span class=\"glyphicon glyphicon-star\"></span> constructor</strong>\n    <% } %>\n  </span>\n\n</p>";

module.exports = function(App) {
  var searchView = Backbone.View.extend({
    el: '#search',
    /**
     * Init.
     */
    init: function() {
      var tpl = _.template(searchTpl);
      var className = 'form-control input-lg';
      var placeholder = 'Search reference';
      this.searchHtml = tpl({
        placeholder: placeholder,
        className: className
      });
      this.items = App.classes.concat(App.allItems);

      return this;
    },
    /**
     * Render input field with Typehead activated.
     */
    render: function() {
      // Append the view to the dom
      this.$el.append(this.searchHtml);

      // Render Typeahead
      var $searchInput = this.$el.find('input[type=text]');
      this.typeaheadRender($searchInput);
      this.typeaheadEvents($searchInput);

      return this;
    },
    /**
     * Apply Twitter Typeahead to the search input field.
     * @param {jquery} $input
     */
    typeaheadRender: function($input) {
      var self = this;
      $input.typeahead(null, {
        displayKey: 'name',
        minLength: 2,
        //'highlight': true,
        source: self.substringMatcher(this.items),
        templates: {
          empty:
            '<p class="empty-message">Unable to find any item that match the current query</p>',
          suggestion: _.template(suggestionTpl)
        }
      });
    },
    /**
     * Setup typeahead custom events (item selected).
     */
    typeaheadEvents: function($input) {
      var self = this;
      $input.on('typeahead:selected', function(e, item, datasetName) {
        var selectedItem = self.items[item.idx];
        select(selectedItem);
      });
      $input.on('keydown', function(e) {
        if (e.which === 13) {
          // enter
          var txt = $input.val();
          var f = _.find(self.items, function(it) {
            return it.name === txt;
          });
          if (f) {
            select(f);
          }
        } else if (e.which === 27) {
          $input.blur();
        }
      });

      function select(selectedItem) {
        var hash = App.router.getHash(selectedItem);
        App.router.navigate(hash, {
          trigger: true
        });
        $('#item').focus();
      }
    },
    /**
     * substringMatcher function for Typehead (search for strings in an array).
     * @param {array} array
     * @returns {Function}
     */
    substringMatcher: function(array) {
      return function findMatches(query, callback) {
        var matches = [],
          substrRegex,
          arrayLength = array.length;

        // regex used to determine if a string contains the substring `query`
        substrRegex = new RegExp(query, 'i');

        // iterate through the pool of strings and for any string that
        // contains the substring `query`, add it to the `matches` array
        for (var i = 0; i < arrayLength; i++) {
          var item = array[i];
          if (substrRegex.test(item.name)) {
            // typeahead expects suggestions to be a js object
            matches.push({
              itemtype: item.itemtype,
              name: item.name,
              className: item.class,
              is_constructor: !!item.is_constructor,
              final: item.final,
              idx: i
            });
          }
        }

        callback(matches);
      };
    }
  });

  return searchView;
};

},{}]},{},[2])(2)
});
