(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

},{"./element.html":3,"document-register-element":2}],2:[function(require,module,exports){
/*! (C) WebReflection Mit Style License */
(function(e,t,n,r){"use strict";function z(e,t){for(var n=0,r=e.length;n<r;n++)Y(e[n],t)}function W(e){for(var t=0,n=e.length,r;t<n;t++)r=e[t],U(r,p[V(r)])}function X(e){return function(t){b.call(A,t)&&(Y(t,e),z(t.querySelectorAll(d),e))}}function V(e){var t=e.getAttribute("is"),n=e.nodeName,r=m.call(h,t?f+t.toUpperCase():a+n);return t&&-1<r&&!$(n,t)?-1:r}function $(e,t){return-1<d.indexOf(e+'[is="'+t+'"]')}function J(e){var t=e.currentTarget,n=e.attrChange,r=e.prevValue,i=e.newValue;t.attributeChangedCallback&&e.attrName!=="style"&&t.attributeChangedCallback(e.attrName,n===e.ADDITION?null:r,n===e.REMOVAL?null:i)}function K(e){var t=X(e);return function(e){t(e.target)}}function Q(e,t){var n=this;M.call(n,e,t),j.call(n,{target:n})}function G(e,t){k(e,t),q?q.observe(e,D):(B&&(e.setAttribute=Q,e[i]=I(e),e.addEventListener(u,j)),e.addEventListener(o,J)),e.createdCallback&&(e.created=!0,e.createdCallback(),e.created=!1)}function Y(e,t){var n,r=V(e),i="attached",s="detached";-1<r&&(R(e,p[r]),r=0,t===i&&!e[i]?(e[s]=!1,e[i]=!0,r=1):t===s&&!e[s]&&(e[i]=!1,e[s]=!0,r=1),r&&(n=e[t+"Callback"])&&n.call(e))}if(r in t)return;var i="__"+r+(Math.random()*1e5>>0),s="extends",o="DOMAttrModified",u="DOMSubtreeModified",a="<",f="=",l=/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/,c=["ANNOTATION-XML","COLOR-PROFILE","FONT-FACE","FONT-FACE-SRC","FONT-FACE-URI","FONT-FACE-FORMAT","FONT-FACE-NAME","MISSING-GLYPH"],h=[],p=[],d="",v=t.documentElement,m=h.indexOf||function(e){for(var t=this.length;t--&&this[t]!==e;);return t},g=n.prototype,y=g.hasOwnProperty,b=g.isPrototypeOf,w=n.defineProperty,E=n.getOwnPropertyDescriptor,S=n.getOwnPropertyNames,x=n.getPrototypeOf,T=n.setPrototypeOf,N=!!n.__proto__,C=n.create||function Z(e){return e?(Z.prototype=e,new Z):this},k=T||(N?function(e,t){return e.__proto__=t,e}:S&&E?function(){function e(e,t){for(var n,r=S(t),i=0,s=r.length;i<s;i++)n=r[i],y.call(e,n)||w(e,n,E(t,n))}return function(t,n){do e(t,n);while(n=x(n));return t}}():function(e,t){for(var n in t)e[n]=t[n];return e}),L=e.MutationObserver||e.WebKitMutationObserver,A=(e.HTMLElement||e.Element||e.Node).prototype,O=A.cloneNode,M=A.setAttribute,_=t.createElement,D=L&&{attributes:!0,characterData:!0,attributeOldValue:!0},P=L||function(e){B=!1,v.removeEventListener(o,P)},H=!1,B=!0,j,F,I,q,R,U;T||N?(R=function(e,t){b.call(t,e)||G(e,t)},U=G):(R=function(e,t){e[i]||(e[i]=n(!0),G(e,t))},U=R),L||(v.addEventListener(o,P),v.setAttribute(i,1),v.removeAttribute(i),B&&(j=function(e){var t=this,n,r,s;if(t===e.target){n=t[i],t[i]=r=I(t);for(s in r){if(!(s in n))return F(0,t,s,n[s],r[s],"ADDITION");if(r[s]!==n[s])return F(1,t,s,n[s],r[s],"MODIFICATION")}for(s in n)if(!(s in r))return F(2,t,s,n[s],r[s],"REMOVAL")}},F=function(e,t,n,r,i,s){var o={attrChange:e,currentTarget:t,attrName:n,prevValue:r,newValue:i};o[s]=e,J(o)},I=function(e){for(var t,n,r={},i=e.attributes,s=0,o=i.length;s<o;s++)t=i[s],n=t.name,n!=="setAttribute"&&(r[n]=t.value);return r})),t[r]=function(n,r){w=n.toUpperCase(),H||(H=!0,L?(q=function(e,t){function n(e,t){for(var n=0,r=e.length;n<r;t(e[n++]));}return new L(function(r){for(var i,s,o=0,u=r.length;o<u;o++)i=r[o],i.type==="childList"?(n(i.addedNodes,e),n(i.removedNodes,t)):(s=i.target,s.attributeChangedCallback&&i.attributeName!=="style"&&s.attributeChangedCallback(i.attributeName,i.oldValue,s.getAttribute(i.attributeName)))})}(X("attached"),X("detached")),q.observe(t,{childList:!0,subtree:!0})):(t.addEventListener("DOMNodeInserted",K("attached")),t.addEventListener("DOMNodeRemoved",K("detached"))),t.addEventListener("readystatechange",function(e){z(t.querySelectorAll(d),"attached")}),t.createElement=function(e,n){var r=_.apply(t,arguments),i=m.call(h,(n?f:a)+(n||e).toUpperCase()),s=-1<i;return n&&(r.setAttribute("is",n=n.toLowerCase()),s&&(s=$(e.toUpperCase(),n))),s&&U(r,p[i]),r},A.cloneNode=function(e){var t=O.call(this,!!e),n=V(t);return-1<n&&U(t,p[n]),e&&W(t.querySelectorAll(d)),t});if(-2<m.call(h,f+w)+m.call(h,a+w))throw new Error("A "+n+" type is already registered");if(!l.test(w)||-1<m.call(c,w))throw new Error("The type "+n+" is invalid");var i=function(){return t.createElement(v,u&&w)},o=r||g,u=y.call(o,s),v=u?r[s].toUpperCase():w,b=h.push((u?f:a)+w)-1,w;return d=d.concat(d.length?",":"",u?v+'[is="'+n.toLowerCase()+'"]':v),i.prototype=p[b]=y.call(o,"prototype")?o.prototype:C(A),z(t.querySelectorAll(d),"attached"),i}})(window,document,Object,"registerElement");
},{}],3:[function(require,module,exports){
module.exports = '<template id="brick-select-template">\n' +
    '  <button class="handle"><span></span></button>\n' +
    '\n' +
    '  <div class="dialogue" role="dialog">\n' +
    '    <div class="panel">\n' +
    '      <header>\n' +
    '        <h1></h1>\n' +
    '      </header>\n' +
    '      <ul class="menu">\n' +
    '      </ul>\n' +
    '      <footer class="single">\n' +
    '        <button class="close">Close</button>\n' +
    '      </footer>\n' +
    '      <footer class="multiple">\n' +
    '        <button class="cancel">Cancel</button>\n' +
    '        <button class="commit">Select</button>\n' +
    '      </footer>\n' +
    '    </div>\n' +
    '  </div>\n' +
    '</template>\n' +
    '\n' +
    '<template id="brick-select-option-template">\n' +
    '  <li class="menu-item">\n' +
    '    <span class="label"></span><i class="icon"></i>\n' +
    '    <div class="feedback"></div>\n' +
    '  </li>\n' +
    '</template>\n' +
    '';
},{}]},{},[1]);
