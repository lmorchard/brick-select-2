require('document-register-element');

var importDoc = document.implementation.createHTMLDocument('');
importDoc.body.innerHTML = require('./element.html');

var BrickSelectElementPrototype = Object.create(HTMLSelectElement.prototype);

BrickSelectElementPrototype.createdCallback = function () {
  this.ns = { };

  // HACK: Hide the <select> and just leave the proxy visible.
  this.style.display = 'none';
};

BrickSelectElementPrototype.attachedCallback = function () {
  var proxy = this.ns.proxy = document.createElement('brick-select-proxy');
  this.parentNode.insertBefore(proxy, this);
  proxy.proxyForSelect(this);
};

BrickSelectElementPrototype.detachedCallback = function () {
  this.parentNode.removeChild(this.ns.proxy);
};

window.BrickSelectElement = document.registerElement('brick-select', {
  prototype: BrickSelectElementPrototype,
  extends: 'select'
});

var BrickSelectProxyElementPrototype = Object.create(HTMLElement.prototype);

// Attributes
var attrs = {
  "for": function (oldVal, newVal) {
    var name = newVal;
    var select = document.querySelector('select[name="' + name + '"]');
    if (this.ns.select !== select) {
      this.proxyForSelect(select);
    }
  }
};

// Properties
var props = {
  "select": {
    get: function () {
      return this.ns.select;
    },
    set: function (el) {
      return this.proxyForSelect(el);
    }
  }
};

// Magical property boilerplating based on attributes
function makeProp (name) {
  return {
    get: function () {
      return this.ns[name];
    },
    set: function (newVal) {
      return this.attributeChangedCallback(name, this.ns[name], newVal);
    }
  };
}
for (var name in attrs) {
  if (!props.hasOwnProperty(name)) {
    props[name] = makeProp(name);
  }
}

Object.defineProperties(BrickSelectProxyElementPrototype, props);

// Lifecycle methods

var TMPL_ROOT = 'template#brick-select-template';
var TMPL_ITEM = 'template#brick-select-option-template';

BrickSelectProxyElementPrototype.createdCallback = function () {
  this.ns = { };

  var template = importDoc.querySelector(TMPL_ROOT);

  var root = this.root = document.createElement('div');
  root.className = 'brick-select-proxy-root';
  root.appendChild(template.content.cloneNode(true));

  var title = this.getAttribute('title');
  if (title) {
    root.querySelector('header h1').textContent = title;
  } else {
    var header = root.querySelector('header');
    header.parentNode.removeChild(header);
  }

  root.querySelector('button.handle span').textContent = title;

  for (var k in attrs) {
    if (this.hasAttribute(k)) {
      attrs[k].call(this, null, this.getAttribute(k));
    }
  }
};

BrickSelectProxyElementPrototype.attachedCallback = function () {
  var self = this;
  var root = this.root;

  this.appendChild(this.root);

  this.updateSelectFromDialog();

  // Intercept <label> clicks to show select dialog
  document.addEventListener('click', function (ev) {
    if (!self.select) { return; }
    var sel = 'label[for="' + self.select.getAttribute('name') + '"]';
    return delegate(sel, function (ev) {
      self.show();
      return stopEvent(ev);
    })(ev);
  });

  // Clicks on the visible select handle button shows the dialog
  root.querySelector('button.handle')
    .addEventListener('click', function (ev) {
      self.show();
      return stopEvent(ev);
    });

  root.querySelector('button.close')
    .addEventListener('click', function (ev) {
      self.hide();
      return stopEvent(ev);
    });

  root.querySelector('button.cancel')
    .addEventListener('click', function (ev) {
      self.hide();
      return stopEvent(ev);
    });

  root.querySelector('button.commit')
    .addEventListener('click', function (ev) {
      self.hide();
      self.updateSelectFromDialog();
      return stopEvent(ev);
    });

  root.addEventListener('click', function (ev) {
    if (ev.target === self.root.querySelector('.dialogue')) {
      self.hide();
    } else {
      delegate('.menu-item', function (ev) {
        self.animateMenuItemClick(this, ev);
        if (self.select && self.select.hasAttribute('multiple')) {
          self.toggleSelected(this);
        } else {
          self.setSelected(this);
          self.hide();
          self.updateSelectFromDialog();
        }
      })(ev);
    }
    return stopEvent(ev);
  });

};

BrickSelectProxyElementPrototype.detachedCallback = function () {
  this.root.parentNode.removeChild(this.root);
};

BrickSelectProxyElementPrototype.attributeChangedCallback = function (attr, oldVal, newVal) {
  if (attr in attrs) {
    attrs[attr].call(this, oldVal, newVal);
  }
};

// Custom methods

BrickSelectProxyElementPrototype.show = function () {
  this.updateDialogFromSelect();

  var dialogue = this.root.querySelector('.dialogue');
  dialogue.setAttribute('show', 'in');

  function animEnd () {
    this.removeEventListener('animationend', animEnd);
    this.removeEventListener('webkitAnimationEnd', animEnd);
    dialogue.setAttribute('show', '');
  }
  dialogue.querySelector('.panel').addEventListener('animationend', animEnd);
  dialogue.querySelector('.panel').addEventListener('webkitAnimationEnd', animEnd);
};

BrickSelectProxyElementPrototype.hide = function () {
  var dialogue = this.root.querySelector('.dialogue');
  dialogue.setAttribute('show', 'out');

  function animEnd (ev) {
    if (ev.target !== this) { return; }
    this.removeEventListener('animationend', animEnd);
    this.removeEventListener('webkitAnimationEnd', animEnd);
    dialogue.removeAttribute('show');
  }
  dialogue.addEventListener('animationend', animEnd, false);
  dialogue.addEventListener('webkitAnimationEnd', animEnd, false);
};

BrickSelectProxyElementPrototype.proxyForSelect = function (select) {
  this.ns.select = select;
  if (select) {
    var name = select.getAttribute('name');
    this.setAttribute('for', this.ns['for'] = name);
    this.updateDialogFromSelect();
  }
  return select;
};

BrickSelectProxyElementPrototype.setSelected = function (el) {
  this.clearSelected();
  el.classList.add('selected');
};

BrickSelectProxyElementPrototype.toggleSelected = function (el) {
  el.classList.toggle('selected');
};

BrickSelectProxyElementPrototype.clearSelected = function () {
  var selected = this.root.querySelectorAll('li');
  for (var i = 0; i < selected.length; i++) {
    selected[i].classList.remove('selected');
  }
};

BrickSelectProxyElementPrototype.updateDialogFromSelect = function () {
  var menu = this.root.querySelector('ul.menu');

  // Clear out any existing items.
  while (menu.firstChild) {
    menu.removeChild(menu.firstChild);
  }

  // Bail out if there's no associated <select>
  if (!this.ns.select) { return; }

  if (this.ns.select.hasAttribute('multiple')) {
    this.setAttribute('multiple', true);
  } else {
    this.removeAttribute('multiple');
  }

  // Clone dialog menu items from <options>s in the <select>.
  var itemTemplateContent = importDoc.querySelector(TMPL_ITEM).content;
  var options = this.ns.select.querySelectorAll('option');
  for (var i = 0; i < options.length; i++) {
    var option = options[i];
    var item = itemTemplateContent.cloneNode(true).querySelector('li');
    var isSelected = option.hasAttribute('selected');
    item.classList[isSelected ? 'add' : 'remove']('selected');
    item.setAttribute('data-value', option.getAttribute('value'));
    item.querySelector('.label').innerHTML = option.innerHTML;
    menu.appendChild(item);
  }

  this.updateHandleText();
};

BrickSelectProxyElementPrototype.updateSelectFromDialog = function () {
  // Bail if there's no associated <select>
  if (!this.ns.select) { return; }

  // Deselect all options, map by value.
  var options = this.ns.select.querySelectorAll('option');
  var optionsByValue = {};
  for (var i = 0; i < options.length; i++) {
    var option = options[i];
    option.removeAttribute('selected');
    optionsByValue[option.getAttribute('value')] = option;
  }

  // Walk through all the selected items in the dialog
  var selected = this.root.querySelectorAll('li.selected');
  for (var j = 0; j < selected.length; j++) {
    var item = selected[j];
    var value = item.getAttribute('data-value');

    // Flag the selected light <option>, if available.
    if (optionsByValue[value]) {
      optionsByValue[value].setAttribute('selected', true);
    }
  }

  this.updateHandleText();

  this.ns.select.dispatchEvent(new Event('change', {
    view: window,
    bubbles: true,
    cancelable: true
  }));
};

// Update the handle button label with the list of selections
BrickSelectProxyElementPrototype.updateHandleText = function () {
  var names = [];
  var selected = this.root.querySelectorAll('li.selected');
  for (var i = 0; i < selected.length; i++) {
    names.push(selected[i].querySelector('.label').textContent);
  }
  this.root.querySelector('button.handle span')
      .textContent = names.join(', ');
};

BrickSelectProxyElementPrototype.animateMenuItemClick = function (item, ev) {
  var animate = this.root.querySelector('.feedback.animate');
  if (animate) { animate.classList.remove('animate'); }

  var selected = item.querySelector('.feedback');
  if (selected) {
      // Use mouse click position as origin of the "ripple" effect
      var w = selected.parentNode.offsetWidth*2;
      selected.style.width = w+'px';
      selected.style.height = w+'px';
      selected.style.top = (w/2*-1)+(this.offsetHeight/2)+'px';
      selected.style.left = (ev.layerX-(w/2))+'px';
      selected.classList.add('animate');
  }
};

// Property handlers

BrickSelectProxyElementPrototype.attributeChangedCallback = function (attr, oldVal, newVal) {
  if (!(attr in attrs)) { return; }
  attrs[attr].call(this, oldVal, newVal);
};

// Register the element

window.BrickSelectProxyElement = document.registerElement('brick-select-proxy', {
  prototype: BrickSelectProxyElementPrototype
});

// Utility functions

function delegate(selector, handler) {
  return function(e) {
    var target = e.target;
    var delegateEl = e.currentTarget;
    var matches = delegateEl.querySelectorAll(selector);
    for (var el = target; el.parentNode && el !== delegateEl; el = el.parentNode) {
      for (var i = 0; i < matches.length; i++) {
        if (matches[i] === el) {
          handler.call(el, e);
          return;
        }
      }
    }
  };
}

function stopEvent (ev) {
  ev.stopPropagation();
  ev.preventDefault();
  return false;
}
