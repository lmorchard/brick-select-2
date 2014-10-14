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
},{}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvZWxlbWVudC5qcyIsIm5vZGVfbW9kdWxlcy9kb2N1bWVudC1yZWdpc3Rlci1lbGVtZW50L2J1aWxkL2RvY3VtZW50LXJlZ2lzdGVyLWVsZW1lbnQuanMiLCJzcmMvZWxlbWVudC5odG1sIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdXQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInJlcXVpcmUoJ2RvY3VtZW50LXJlZ2lzdGVyLWVsZW1lbnQnKTtcblxudmFyIGltcG9ydERvYyA9IGRvY3VtZW50LmltcGxlbWVudGF0aW9uLmNyZWF0ZUhUTUxEb2N1bWVudCgnJyk7XG5pbXBvcnREb2MuYm9keS5pbm5lckhUTUwgPSByZXF1aXJlKCcuL2VsZW1lbnQuaHRtbCcpO1xuXG52YXIgQnJpY2tTZWxlY3RFbGVtZW50UHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShIVE1MU2VsZWN0RWxlbWVudC5wcm90b3R5cGUpO1xuXG5Ccmlja1NlbGVjdEVsZW1lbnRQcm90b3R5cGUuY3JlYXRlZENhbGxiYWNrID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLm5zID0geyB9O1xuXG4gIC8vIEhBQ0s6IEhpZGUgdGhlIDxzZWxlY3Q+IGFuZCBqdXN0IGxlYXZlIHRoZSBwcm94eSB2aXNpYmxlLlxuICB0aGlzLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG59O1xuXG5Ccmlja1NlbGVjdEVsZW1lbnRQcm90b3R5cGUuYXR0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHByb3h5ID0gdGhpcy5ucy5wcm94eSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2JyaWNrLXNlbGVjdC1wcm94eScpO1xuICB0aGlzLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHByb3h5LCB0aGlzKTtcbiAgcHJveHkucHJveHlGb3JTZWxlY3QodGhpcyk7XG59O1xuXG5Ccmlja1NlbGVjdEVsZW1lbnRQcm90b3R5cGUuZGV0YWNoZWRDYWxsYmFjayA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKHRoaXMubnMucHJveHkpO1xufTtcblxud2luZG93LkJyaWNrU2VsZWN0RWxlbWVudCA9IGRvY3VtZW50LnJlZ2lzdGVyRWxlbWVudCgnYnJpY2stc2VsZWN0Jywge1xuICBwcm90b3R5cGU6IEJyaWNrU2VsZWN0RWxlbWVudFByb3RvdHlwZSxcbiAgZXh0ZW5kczogJ3NlbGVjdCdcbn0pO1xuXG52YXIgQnJpY2tTZWxlY3RQcm94eUVsZW1lbnRQcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKEhUTUxFbGVtZW50LnByb3RvdHlwZSk7XG5cbi8vIEF0dHJpYnV0ZXNcbnZhciBhdHRycyA9IHtcbiAgXCJmb3JcIjogZnVuY3Rpb24gKG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgdmFyIG5hbWUgPSBuZXdWYWw7XG4gICAgdmFyIHNlbGVjdCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ3NlbGVjdFtuYW1lPVwiJyArIG5hbWUgKyAnXCJdJyk7XG4gICAgaWYgKHRoaXMubnMuc2VsZWN0ICE9PSBzZWxlY3QpIHtcbiAgICAgIHRoaXMucHJveHlGb3JTZWxlY3Qoc2VsZWN0KTtcbiAgICB9XG4gIH1cbn07XG5cbi8vIFByb3BlcnRpZXNcbnZhciBwcm9wcyA9IHtcbiAgXCJzZWxlY3RcIjoge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIHRoaXMubnMuc2VsZWN0O1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiAoZWwpIHtcbiAgICAgIHJldHVybiB0aGlzLnByb3h5Rm9yU2VsZWN0KGVsKTtcbiAgICB9XG4gIH1cbn07XG5cbi8vIE1hZ2ljYWwgcHJvcGVydHkgYm9pbGVycGxhdGluZyBiYXNlZCBvbiBhdHRyaWJ1dGVzXG5mdW5jdGlvbiBtYWtlUHJvcCAobmFtZSkge1xuICByZXR1cm4ge1xuICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIHRoaXMubnNbbmFtZV07XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIChuZXdWYWwpIHtcbiAgICAgIHJldHVybiB0aGlzLmF0dHJpYnV0ZUNoYW5nZWRDYWxsYmFjayhuYW1lLCB0aGlzLm5zW25hbWVdLCBuZXdWYWwpO1xuICAgIH1cbiAgfTtcbn1cbmZvciAodmFyIG5hbWUgaW4gYXR0cnMpIHtcbiAgaWYgKCFwcm9wcy5oYXNPd25Qcm9wZXJ0eShuYW1lKSkge1xuICAgIHByb3BzW25hbWVdID0gbWFrZVByb3AobmFtZSk7XG4gIH1cbn1cblxuT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoQnJpY2tTZWxlY3RQcm94eUVsZW1lbnRQcm90b3R5cGUsIHByb3BzKTtcblxuLy8gTGlmZWN5Y2xlIG1ldGhvZHNcblxudmFyIFRNUExfUk9PVCA9ICd0ZW1wbGF0ZSNicmljay1zZWxlY3QtdGVtcGxhdGUnO1xudmFyIFRNUExfSVRFTSA9ICd0ZW1wbGF0ZSNicmljay1zZWxlY3Qtb3B0aW9uLXRlbXBsYXRlJztcblxuQnJpY2tTZWxlY3RQcm94eUVsZW1lbnRQcm90b3R5cGUuY3JlYXRlZENhbGxiYWNrID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLm5zID0geyB9O1xuXG4gIHZhciB0ZW1wbGF0ZSA9IGltcG9ydERvYy5xdWVyeVNlbGVjdG9yKFRNUExfUk9PVCk7XG5cbiAgdmFyIHJvb3QgPSB0aGlzLnJvb3QgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgcm9vdC5jbGFzc05hbWUgPSAnYnJpY2stc2VsZWN0LXByb3h5LXJvb3QnO1xuICByb290LmFwcGVuZENoaWxkKHRlbXBsYXRlLmNvbnRlbnQuY2xvbmVOb2RlKHRydWUpKTtcblxuICB2YXIgdGl0bGUgPSB0aGlzLmdldEF0dHJpYnV0ZSgndGl0bGUnKTtcbiAgaWYgKHRpdGxlKSB7XG4gICAgcm9vdC5xdWVyeVNlbGVjdG9yKCdoZWFkZXIgaDEnKS50ZXh0Q29udGVudCA9IHRpdGxlO1xuICB9IGVsc2Uge1xuICAgIHZhciBoZWFkZXIgPSByb290LnF1ZXJ5U2VsZWN0b3IoJ2hlYWRlcicpO1xuICAgIGhlYWRlci5wYXJlbnROb2RlLnJlbW92ZUNoaWxkKGhlYWRlcik7XG4gIH1cblxuICByb290LnF1ZXJ5U2VsZWN0b3IoJ2J1dHRvbi5oYW5kbGUgc3BhbicpLnRleHRDb250ZW50ID0gdGl0bGU7XG5cbiAgZm9yICh2YXIgayBpbiBhdHRycykge1xuICAgIGlmICh0aGlzLmhhc0F0dHJpYnV0ZShrKSkge1xuICAgICAgYXR0cnNba10uY2FsbCh0aGlzLCBudWxsLCB0aGlzLmdldEF0dHJpYnV0ZShrKSk7XG4gICAgfVxuICB9XG59O1xuXG5Ccmlja1NlbGVjdFByb3h5RWxlbWVudFByb3RvdHlwZS5hdHRhY2hlZENhbGxiYWNrID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciByb290ID0gdGhpcy5yb290O1xuXG4gIHRoaXMuYXBwZW5kQ2hpbGQodGhpcy5yb290KTtcblxuICB0aGlzLnVwZGF0ZVNlbGVjdEZyb21EaWFsb2coKTtcblxuICAvLyBJbnRlcmNlcHQgPGxhYmVsPiBjbGlja3MgdG8gc2hvdyBzZWxlY3QgZGlhbG9nXG4gIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKGV2KSB7XG4gICAgaWYgKCFzZWxmLnNlbGVjdCkgeyByZXR1cm47IH1cbiAgICB2YXIgc2VsID0gJ2xhYmVsW2Zvcj1cIicgKyBzZWxmLnNlbGVjdC5nZXRBdHRyaWJ1dGUoJ25hbWUnKSArICdcIl0nO1xuICAgIHJldHVybiBkZWxlZ2F0ZShzZWwsIGZ1bmN0aW9uIChldikge1xuICAgICAgc2VsZi5zaG93KCk7XG4gICAgICByZXR1cm4gc3RvcEV2ZW50KGV2KTtcbiAgICB9KShldik7XG4gIH0pO1xuXG4gIC8vIENsaWNrcyBvbiB0aGUgdmlzaWJsZSBzZWxlY3QgaGFuZGxlIGJ1dHRvbiBzaG93cyB0aGUgZGlhbG9nXG4gIHJvb3QucXVlcnlTZWxlY3RvcignYnV0dG9uLmhhbmRsZScpXG4gICAgLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKGV2KSB7XG4gICAgICBzZWxmLnNob3coKTtcbiAgICAgIHJldHVybiBzdG9wRXZlbnQoZXYpO1xuICAgIH0pO1xuXG4gIHJvb3QucXVlcnlTZWxlY3RvcignYnV0dG9uLmNsb3NlJylcbiAgICAuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbiAoZXYpIHtcbiAgICAgIHNlbGYuaGlkZSgpO1xuICAgICAgcmV0dXJuIHN0b3BFdmVudChldik7XG4gICAgfSk7XG5cbiAgcm9vdC5xdWVyeVNlbGVjdG9yKCdidXR0b24uY2FuY2VsJylcbiAgICAuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbiAoZXYpIHtcbiAgICAgIHNlbGYuaGlkZSgpO1xuICAgICAgcmV0dXJuIHN0b3BFdmVudChldik7XG4gICAgfSk7XG5cbiAgcm9vdC5xdWVyeVNlbGVjdG9yKCdidXR0b24uY29tbWl0JylcbiAgICAuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCBmdW5jdGlvbiAoZXYpIHtcbiAgICAgIHNlbGYuaGlkZSgpO1xuICAgICAgc2VsZi51cGRhdGVTZWxlY3RGcm9tRGlhbG9nKCk7XG4gICAgICByZXR1cm4gc3RvcEV2ZW50KGV2KTtcbiAgICB9KTtcblxuICByb290LmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgZnVuY3Rpb24gKGV2KSB7XG4gICAgaWYgKGV2LnRhcmdldCA9PT0gc2VsZi5yb290LnF1ZXJ5U2VsZWN0b3IoJy5kaWFsb2d1ZScpKSB7XG4gICAgICBzZWxmLmhpZGUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZGVsZWdhdGUoJy5tZW51LWl0ZW0nLCBmdW5jdGlvbiAoZXYpIHtcbiAgICAgICAgc2VsZi5hbmltYXRlTWVudUl0ZW1DbGljayh0aGlzLCBldik7XG4gICAgICAgIGlmIChzZWxmLnNlbGVjdCAmJiBzZWxmLnNlbGVjdC5oYXNBdHRyaWJ1dGUoJ211bHRpcGxlJykpIHtcbiAgICAgICAgICBzZWxmLnRvZ2dsZVNlbGVjdGVkKHRoaXMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHNlbGYuc2V0U2VsZWN0ZWQodGhpcyk7XG4gICAgICAgICAgc2VsZi5oaWRlKCk7XG4gICAgICAgICAgc2VsZi51cGRhdGVTZWxlY3RGcm9tRGlhbG9nKCk7XG4gICAgICAgIH1cbiAgICAgIH0pKGV2KTtcbiAgICB9XG4gICAgcmV0dXJuIHN0b3BFdmVudChldik7XG4gIH0pO1xuXG59O1xuXG5Ccmlja1NlbGVjdFByb3h5RWxlbWVudFByb3RvdHlwZS5kZXRhY2hlZENhbGxiYWNrID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLnJvb3QucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0aGlzLnJvb3QpO1xufTtcblxuQnJpY2tTZWxlY3RQcm94eUVsZW1lbnRQcm90b3R5cGUuYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrID0gZnVuY3Rpb24gKGF0dHIsIG9sZFZhbCwgbmV3VmFsKSB7XG4gIGlmIChhdHRyIGluIGF0dHJzKSB7XG4gICAgYXR0cnNbYXR0cl0uY2FsbCh0aGlzLCBvbGRWYWwsIG5ld1ZhbCk7XG4gIH1cbn07XG5cbi8vIEN1c3RvbSBtZXRob2RzXG5cbkJyaWNrU2VsZWN0UHJveHlFbGVtZW50UHJvdG90eXBlLnNob3cgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMudXBkYXRlRGlhbG9nRnJvbVNlbGVjdCgpO1xuXG4gIHZhciBkaWFsb2d1ZSA9IHRoaXMucm9vdC5xdWVyeVNlbGVjdG9yKCcuZGlhbG9ndWUnKTtcbiAgZGlhbG9ndWUuc2V0QXR0cmlidXRlKCdzaG93JywgJ2luJyk7XG5cbiAgZnVuY3Rpb24gYW5pbUVuZCAoKSB7XG4gICAgdGhpcy5yZW1vdmVFdmVudExpc3RlbmVyKCdhbmltYXRpb25lbmQnLCBhbmltRW5kKTtcbiAgICB0aGlzLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3dlYmtpdEFuaW1hdGlvbkVuZCcsIGFuaW1FbmQpO1xuICAgIGRpYWxvZ3VlLnNldEF0dHJpYnV0ZSgnc2hvdycsICcnKTtcbiAgfVxuICBkaWFsb2d1ZS5xdWVyeVNlbGVjdG9yKCcucGFuZWwnKS5hZGRFdmVudExpc3RlbmVyKCdhbmltYXRpb25lbmQnLCBhbmltRW5kKTtcbiAgZGlhbG9ndWUucXVlcnlTZWxlY3RvcignLnBhbmVsJykuYWRkRXZlbnRMaXN0ZW5lcignd2Via2l0QW5pbWF0aW9uRW5kJywgYW5pbUVuZCk7XG59O1xuXG5Ccmlja1NlbGVjdFByb3h5RWxlbWVudFByb3RvdHlwZS5oaWRlID0gZnVuY3Rpb24gKCkge1xuICB2YXIgZGlhbG9ndWUgPSB0aGlzLnJvb3QucXVlcnlTZWxlY3RvcignLmRpYWxvZ3VlJyk7XG4gIGRpYWxvZ3VlLnNldEF0dHJpYnV0ZSgnc2hvdycsICdvdXQnKTtcblxuICBmdW5jdGlvbiBhbmltRW5kIChldikge1xuICAgIGlmIChldi50YXJnZXQgIT09IHRoaXMpIHsgcmV0dXJuOyB9XG4gICAgdGhpcy5yZW1vdmVFdmVudExpc3RlbmVyKCdhbmltYXRpb25lbmQnLCBhbmltRW5kKTtcbiAgICB0aGlzLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3dlYmtpdEFuaW1hdGlvbkVuZCcsIGFuaW1FbmQpO1xuICAgIGRpYWxvZ3VlLnJlbW92ZUF0dHJpYnV0ZSgnc2hvdycpO1xuICB9XG4gIGRpYWxvZ3VlLmFkZEV2ZW50TGlzdGVuZXIoJ2FuaW1hdGlvbmVuZCcsIGFuaW1FbmQsIGZhbHNlKTtcbiAgZGlhbG9ndWUuYWRkRXZlbnRMaXN0ZW5lcignd2Via2l0QW5pbWF0aW9uRW5kJywgYW5pbUVuZCwgZmFsc2UpO1xufTtcblxuQnJpY2tTZWxlY3RQcm94eUVsZW1lbnRQcm90b3R5cGUucHJveHlGb3JTZWxlY3QgPSBmdW5jdGlvbiAoc2VsZWN0KSB7XG4gIHRoaXMubnMuc2VsZWN0ID0gc2VsZWN0O1xuICBpZiAoc2VsZWN0KSB7XG4gICAgdmFyIG5hbWUgPSBzZWxlY3QuZ2V0QXR0cmlidXRlKCduYW1lJyk7XG4gICAgdGhpcy5zZXRBdHRyaWJ1dGUoJ2ZvcicsIHRoaXMubnNbJ2ZvciddID0gbmFtZSk7XG4gICAgdGhpcy51cGRhdGVEaWFsb2dGcm9tU2VsZWN0KCk7XG4gIH1cbiAgcmV0dXJuIHNlbGVjdDtcbn07XG5cbkJyaWNrU2VsZWN0UHJveHlFbGVtZW50UHJvdG90eXBlLnNldFNlbGVjdGVkID0gZnVuY3Rpb24gKGVsKSB7XG4gIHRoaXMuY2xlYXJTZWxlY3RlZCgpO1xuICBlbC5jbGFzc0xpc3QuYWRkKCdzZWxlY3RlZCcpO1xufTtcblxuQnJpY2tTZWxlY3RQcm94eUVsZW1lbnRQcm90b3R5cGUudG9nZ2xlU2VsZWN0ZWQgPSBmdW5jdGlvbiAoZWwpIHtcbiAgZWwuY2xhc3NMaXN0LnRvZ2dsZSgnc2VsZWN0ZWQnKTtcbn07XG5cbkJyaWNrU2VsZWN0UHJveHlFbGVtZW50UHJvdG90eXBlLmNsZWFyU2VsZWN0ZWQgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzZWxlY3RlZCA9IHRoaXMucm9vdC5xdWVyeVNlbGVjdG9yQWxsKCdsaScpO1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHNlbGVjdGVkLmxlbmd0aDsgaSsrKSB7XG4gICAgc2VsZWN0ZWRbaV0uY2xhc3NMaXN0LnJlbW92ZSgnc2VsZWN0ZWQnKTtcbiAgfVxufTtcblxuQnJpY2tTZWxlY3RQcm94eUVsZW1lbnRQcm90b3R5cGUudXBkYXRlRGlhbG9nRnJvbVNlbGVjdCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIG1lbnUgPSB0aGlzLnJvb3QucXVlcnlTZWxlY3RvcigndWwubWVudScpO1xuXG4gIC8vIENsZWFyIG91dCBhbnkgZXhpc3RpbmcgaXRlbXMuXG4gIHdoaWxlIChtZW51LmZpcnN0Q2hpbGQpIHtcbiAgICBtZW51LnJlbW92ZUNoaWxkKG1lbnUuZmlyc3RDaGlsZCk7XG4gIH1cblxuICAvLyBCYWlsIG91dCBpZiB0aGVyZSdzIG5vIGFzc29jaWF0ZWQgPHNlbGVjdD5cbiAgaWYgKCF0aGlzLm5zLnNlbGVjdCkgeyByZXR1cm47IH1cblxuICBpZiAodGhpcy5ucy5zZWxlY3QuaGFzQXR0cmlidXRlKCdtdWx0aXBsZScpKSB7XG4gICAgdGhpcy5zZXRBdHRyaWJ1dGUoJ211bHRpcGxlJywgdHJ1ZSk7XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5yZW1vdmVBdHRyaWJ1dGUoJ211bHRpcGxlJyk7XG4gIH1cblxuICAvLyBDbG9uZSBkaWFsb2cgbWVudSBpdGVtcyBmcm9tIDxvcHRpb25zPnMgaW4gdGhlIDxzZWxlY3Q+LlxuICB2YXIgaXRlbVRlbXBsYXRlQ29udGVudCA9IGltcG9ydERvYy5xdWVyeVNlbGVjdG9yKFRNUExfSVRFTSkuY29udGVudDtcbiAgdmFyIG9wdGlvbnMgPSB0aGlzLm5zLnNlbGVjdC5xdWVyeVNlbGVjdG9yQWxsKCdvcHRpb24nKTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcHRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIG9wdGlvbiA9IG9wdGlvbnNbaV07XG4gICAgdmFyIGl0ZW0gPSBpdGVtVGVtcGxhdGVDb250ZW50LmNsb25lTm9kZSh0cnVlKS5xdWVyeVNlbGVjdG9yKCdsaScpO1xuICAgIHZhciBpc1NlbGVjdGVkID0gb3B0aW9uLmhhc0F0dHJpYnV0ZSgnc2VsZWN0ZWQnKTtcbiAgICBpdGVtLmNsYXNzTGlzdFtpc1NlbGVjdGVkID8gJ2FkZCcgOiAncmVtb3ZlJ10oJ3NlbGVjdGVkJyk7XG4gICAgaXRlbS5zZXRBdHRyaWJ1dGUoJ2RhdGEtdmFsdWUnLCBvcHRpb24uZ2V0QXR0cmlidXRlKCd2YWx1ZScpKTtcbiAgICBpdGVtLnF1ZXJ5U2VsZWN0b3IoJy5sYWJlbCcpLmlubmVySFRNTCA9IG9wdGlvbi5pbm5lckhUTUw7XG4gICAgbWVudS5hcHBlbmRDaGlsZChpdGVtKTtcbiAgfVxuXG4gIHRoaXMudXBkYXRlSGFuZGxlVGV4dCgpO1xufTtcblxuQnJpY2tTZWxlY3RQcm94eUVsZW1lbnRQcm90b3R5cGUudXBkYXRlU2VsZWN0RnJvbURpYWxvZyA9IGZ1bmN0aW9uICgpIHtcbiAgLy8gQmFpbCBpZiB0aGVyZSdzIG5vIGFzc29jaWF0ZWQgPHNlbGVjdD5cbiAgaWYgKCF0aGlzLm5zLnNlbGVjdCkgeyByZXR1cm47IH1cblxuICAvLyBEZXNlbGVjdCBhbGwgb3B0aW9ucywgbWFwIGJ5IHZhbHVlLlxuICB2YXIgb3B0aW9ucyA9IHRoaXMubnMuc2VsZWN0LnF1ZXJ5U2VsZWN0b3JBbGwoJ29wdGlvbicpO1xuICB2YXIgb3B0aW9uc0J5VmFsdWUgPSB7fTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBvcHRpb25zLmxlbmd0aDsgaSsrKSB7XG4gICAgdmFyIG9wdGlvbiA9IG9wdGlvbnNbaV07XG4gICAgb3B0aW9uLnJlbW92ZUF0dHJpYnV0ZSgnc2VsZWN0ZWQnKTtcbiAgICBvcHRpb25zQnlWYWx1ZVtvcHRpb24uZ2V0QXR0cmlidXRlKCd2YWx1ZScpXSA9IG9wdGlvbjtcbiAgfVxuXG4gIC8vIFdhbGsgdGhyb3VnaCBhbGwgdGhlIHNlbGVjdGVkIGl0ZW1zIGluIHRoZSBkaWFsb2dcbiAgdmFyIHNlbGVjdGVkID0gdGhpcy5yb290LnF1ZXJ5U2VsZWN0b3JBbGwoJ2xpLnNlbGVjdGVkJyk7XG4gIGZvciAodmFyIGogPSAwOyBqIDwgc2VsZWN0ZWQubGVuZ3RoOyBqKyspIHtcbiAgICB2YXIgaXRlbSA9IHNlbGVjdGVkW2pdO1xuICAgIHZhciB2YWx1ZSA9IGl0ZW0uZ2V0QXR0cmlidXRlKCdkYXRhLXZhbHVlJyk7XG5cbiAgICAvLyBGbGFnIHRoZSBzZWxlY3RlZCBsaWdodCA8b3B0aW9uPiwgaWYgYXZhaWxhYmxlLlxuICAgIGlmIChvcHRpb25zQnlWYWx1ZVt2YWx1ZV0pIHtcbiAgICAgIG9wdGlvbnNCeVZhbHVlW3ZhbHVlXS5zZXRBdHRyaWJ1dGUoJ3NlbGVjdGVkJywgdHJ1ZSk7XG4gICAgfVxuICB9XG5cbiAgdGhpcy51cGRhdGVIYW5kbGVUZXh0KCk7XG5cbiAgdGhpcy5ucy5zZWxlY3QuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoJ2NoYW5nZScsIHtcbiAgICB2aWV3OiB3aW5kb3csXG4gICAgYnViYmxlczogdHJ1ZSxcbiAgICBjYW5jZWxhYmxlOiB0cnVlXG4gIH0pKTtcbn07XG5cbi8vIFVwZGF0ZSB0aGUgaGFuZGxlIGJ1dHRvbiBsYWJlbCB3aXRoIHRoZSBsaXN0IG9mIHNlbGVjdGlvbnNcbkJyaWNrU2VsZWN0UHJveHlFbGVtZW50UHJvdG90eXBlLnVwZGF0ZUhhbmRsZVRleHQgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBuYW1lcyA9IFtdO1xuICB2YXIgc2VsZWN0ZWQgPSB0aGlzLnJvb3QucXVlcnlTZWxlY3RvckFsbCgnbGkuc2VsZWN0ZWQnKTtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBzZWxlY3RlZC5sZW5ndGg7IGkrKykge1xuICAgIG5hbWVzLnB1c2goc2VsZWN0ZWRbaV0ucXVlcnlTZWxlY3RvcignLmxhYmVsJykudGV4dENvbnRlbnQpO1xuICB9XG4gIHRoaXMucm9vdC5xdWVyeVNlbGVjdG9yKCdidXR0b24uaGFuZGxlIHNwYW4nKVxuICAgICAgLnRleHRDb250ZW50ID0gbmFtZXMuam9pbignLCAnKTtcbn07XG5cbkJyaWNrU2VsZWN0UHJveHlFbGVtZW50UHJvdG90eXBlLmFuaW1hdGVNZW51SXRlbUNsaWNrID0gZnVuY3Rpb24gKGl0ZW0sIGV2KSB7XG4gIHZhciBhbmltYXRlID0gdGhpcy5yb290LnF1ZXJ5U2VsZWN0b3IoJy5mZWVkYmFjay5hbmltYXRlJyk7XG4gIGlmIChhbmltYXRlKSB7IGFuaW1hdGUuY2xhc3NMaXN0LnJlbW92ZSgnYW5pbWF0ZScpOyB9XG5cbiAgdmFyIHNlbGVjdGVkID0gaXRlbS5xdWVyeVNlbGVjdG9yKCcuZmVlZGJhY2snKTtcbiAgaWYgKHNlbGVjdGVkKSB7XG4gICAgICAvLyBVc2UgbW91c2UgY2xpY2sgcG9zaXRpb24gYXMgb3JpZ2luIG9mIHRoZSBcInJpcHBsZVwiIGVmZmVjdFxuICAgICAgdmFyIHcgPSBzZWxlY3RlZC5wYXJlbnROb2RlLm9mZnNldFdpZHRoKjI7XG4gICAgICBzZWxlY3RlZC5zdHlsZS53aWR0aCA9IHcrJ3B4JztcbiAgICAgIHNlbGVjdGVkLnN0eWxlLmhlaWdodCA9IHcrJ3B4JztcbiAgICAgIHNlbGVjdGVkLnN0eWxlLnRvcCA9ICh3LzIqLTEpKyh0aGlzLm9mZnNldEhlaWdodC8yKSsncHgnO1xuICAgICAgc2VsZWN0ZWQuc3R5bGUubGVmdCA9IChldi5sYXllclgtKHcvMikpKydweCc7XG4gICAgICBzZWxlY3RlZC5jbGFzc0xpc3QuYWRkKCdhbmltYXRlJyk7XG4gIH1cbn07XG5cbi8vIFByb3BlcnR5IGhhbmRsZXJzXG5cbkJyaWNrU2VsZWN0UHJveHlFbGVtZW50UHJvdG90eXBlLmF0dHJpYnV0ZUNoYW5nZWRDYWxsYmFjayA9IGZ1bmN0aW9uIChhdHRyLCBvbGRWYWwsIG5ld1ZhbCkge1xuICBpZiAoIShhdHRyIGluIGF0dHJzKSkgeyByZXR1cm47IH1cbiAgYXR0cnNbYXR0cl0uY2FsbCh0aGlzLCBvbGRWYWwsIG5ld1ZhbCk7XG59O1xuXG4vLyBSZWdpc3RlciB0aGUgZWxlbWVudFxuXG53aW5kb3cuQnJpY2tTZWxlY3RQcm94eUVsZW1lbnQgPSBkb2N1bWVudC5yZWdpc3RlckVsZW1lbnQoJ2JyaWNrLXNlbGVjdC1wcm94eScsIHtcbiAgcHJvdG90eXBlOiBCcmlja1NlbGVjdFByb3h5RWxlbWVudFByb3RvdHlwZVxufSk7XG5cbi8vIFV0aWxpdHkgZnVuY3Rpb25zXG5cbmZ1bmN0aW9uIGRlbGVnYXRlKHNlbGVjdG9yLCBoYW5kbGVyKSB7XG4gIHJldHVybiBmdW5jdGlvbihlKSB7XG4gICAgdmFyIHRhcmdldCA9IGUudGFyZ2V0O1xuICAgIHZhciBkZWxlZ2F0ZUVsID0gZS5jdXJyZW50VGFyZ2V0O1xuICAgIHZhciBtYXRjaGVzID0gZGVsZWdhdGVFbC5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9yKTtcbiAgICBmb3IgKHZhciBlbCA9IHRhcmdldDsgZWwucGFyZW50Tm9kZSAmJiBlbCAhPT0gZGVsZWdhdGVFbDsgZWwgPSBlbC5wYXJlbnROb2RlKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1hdGNoZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKG1hdGNoZXNbaV0gPT09IGVsKSB7XG4gICAgICAgICAgaGFuZGxlci5jYWxsKGVsLCBlKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH07XG59XG5cbmZ1bmN0aW9uIHN0b3BFdmVudCAoZXYpIHtcbiAgZXYuc3RvcFByb3BhZ2F0aW9uKCk7XG4gIGV2LnByZXZlbnREZWZhdWx0KCk7XG4gIHJldHVybiBmYWxzZTtcbn1cbiIsIi8qISAoQykgV2ViUmVmbGVjdGlvbiBNaXQgU3R5bGUgTGljZW5zZSAqL1xuKGZ1bmN0aW9uKGUsdCxuLHIpe1widXNlIHN0cmljdFwiO2Z1bmN0aW9uIHooZSx0KXtmb3IodmFyIG49MCxyPWUubGVuZ3RoO248cjtuKyspWShlW25dLHQpfWZ1bmN0aW9uIFcoZSl7Zm9yKHZhciB0PTAsbj1lLmxlbmd0aCxyO3Q8bjt0Kyspcj1lW3RdLFUocixwW1YocildKX1mdW5jdGlvbiBYKGUpe3JldHVybiBmdW5jdGlvbih0KXtiLmNhbGwoQSx0KSYmKFkodCxlKSx6KHQucXVlcnlTZWxlY3RvckFsbChkKSxlKSl9fWZ1bmN0aW9uIFYoZSl7dmFyIHQ9ZS5nZXRBdHRyaWJ1dGUoXCJpc1wiKSxuPWUubm9kZU5hbWUscj1tLmNhbGwoaCx0P2YrdC50b1VwcGVyQ2FzZSgpOmErbik7cmV0dXJuIHQmJi0xPHImJiEkKG4sdCk/LTE6cn1mdW5jdGlvbiAkKGUsdCl7cmV0dXJuLTE8ZC5pbmRleE9mKGUrJ1tpcz1cIicrdCsnXCJdJyl9ZnVuY3Rpb24gSihlKXt2YXIgdD1lLmN1cnJlbnRUYXJnZXQsbj1lLmF0dHJDaGFuZ2Uscj1lLnByZXZWYWx1ZSxpPWUubmV3VmFsdWU7dC5hdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2smJmUuYXR0ck5hbWUhPT1cInN0eWxlXCImJnQuYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKGUuYXR0ck5hbWUsbj09PWUuQURESVRJT04/bnVsbDpyLG49PT1lLlJFTU9WQUw/bnVsbDppKX1mdW5jdGlvbiBLKGUpe3ZhciB0PVgoZSk7cmV0dXJuIGZ1bmN0aW9uKGUpe3QoZS50YXJnZXQpfX1mdW5jdGlvbiBRKGUsdCl7dmFyIG49dGhpcztNLmNhbGwobixlLHQpLGouY2FsbChuLHt0YXJnZXQ6bn0pfWZ1bmN0aW9uIEcoZSx0KXtrKGUsdCkscT9xLm9ic2VydmUoZSxEKTooQiYmKGUuc2V0QXR0cmlidXRlPVEsZVtpXT1JKGUpLGUuYWRkRXZlbnRMaXN0ZW5lcih1LGopKSxlLmFkZEV2ZW50TGlzdGVuZXIobyxKKSksZS5jcmVhdGVkQ2FsbGJhY2smJihlLmNyZWF0ZWQ9ITAsZS5jcmVhdGVkQ2FsbGJhY2soKSxlLmNyZWF0ZWQ9ITEpfWZ1bmN0aW9uIFkoZSx0KXt2YXIgbixyPVYoZSksaT1cImF0dGFjaGVkXCIscz1cImRldGFjaGVkXCI7LTE8ciYmKFIoZSxwW3JdKSxyPTAsdD09PWkmJiFlW2ldPyhlW3NdPSExLGVbaV09ITAscj0xKTp0PT09cyYmIWVbc10mJihlW2ldPSExLGVbc109ITAscj0xKSxyJiYobj1lW3QrXCJDYWxsYmFja1wiXSkmJm4uY2FsbChlKSl9aWYociBpbiB0KXJldHVybjt2YXIgaT1cIl9fXCIrcisoTWF0aC5yYW5kb20oKSoxZTU+PjApLHM9XCJleHRlbmRzXCIsbz1cIkRPTUF0dHJNb2RpZmllZFwiLHU9XCJET01TdWJ0cmVlTW9kaWZpZWRcIixhPVwiPFwiLGY9XCI9XCIsbD0vXltBLVpdW0EtWjAtOV0qKD86LVtBLVowLTldKykrJC8sYz1bXCJBTk5PVEFUSU9OLVhNTFwiLFwiQ09MT1ItUFJPRklMRVwiLFwiRk9OVC1GQUNFXCIsXCJGT05ULUZBQ0UtU1JDXCIsXCJGT05ULUZBQ0UtVVJJXCIsXCJGT05ULUZBQ0UtRk9STUFUXCIsXCJGT05ULUZBQ0UtTkFNRVwiLFwiTUlTU0lORy1HTFlQSFwiXSxoPVtdLHA9W10sZD1cIlwiLHY9dC5kb2N1bWVudEVsZW1lbnQsbT1oLmluZGV4T2Z8fGZ1bmN0aW9uKGUpe2Zvcih2YXIgdD10aGlzLmxlbmd0aDt0LS0mJnRoaXNbdF0hPT1lOyk7cmV0dXJuIHR9LGc9bi5wcm90b3R5cGUseT1nLmhhc093blByb3BlcnR5LGI9Zy5pc1Byb3RvdHlwZU9mLHc9bi5kZWZpbmVQcm9wZXJ0eSxFPW4uZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yLFM9bi5nZXRPd25Qcm9wZXJ0eU5hbWVzLHg9bi5nZXRQcm90b3R5cGVPZixUPW4uc2V0UHJvdG90eXBlT2YsTj0hIW4uX19wcm90b19fLEM9bi5jcmVhdGV8fGZ1bmN0aW9uIFooZSl7cmV0dXJuIGU/KFoucHJvdG90eXBlPWUsbmV3IFopOnRoaXN9LGs9VHx8KE4/ZnVuY3Rpb24oZSx0KXtyZXR1cm4gZS5fX3Byb3RvX189dCxlfTpTJiZFP2Z1bmN0aW9uKCl7ZnVuY3Rpb24gZShlLHQpe2Zvcih2YXIgbixyPVModCksaT0wLHM9ci5sZW5ndGg7aTxzO2krKyluPXJbaV0seS5jYWxsKGUsbil8fHcoZSxuLEUodCxuKSl9cmV0dXJuIGZ1bmN0aW9uKHQsbil7ZG8gZSh0LG4pO3doaWxlKG49eChuKSk7cmV0dXJuIHR9fSgpOmZ1bmN0aW9uKGUsdCl7Zm9yKHZhciBuIGluIHQpZVtuXT10W25dO3JldHVybiBlfSksTD1lLk11dGF0aW9uT2JzZXJ2ZXJ8fGUuV2ViS2l0TXV0YXRpb25PYnNlcnZlcixBPShlLkhUTUxFbGVtZW50fHxlLkVsZW1lbnR8fGUuTm9kZSkucHJvdG90eXBlLE89QS5jbG9uZU5vZGUsTT1BLnNldEF0dHJpYnV0ZSxfPXQuY3JlYXRlRWxlbWVudCxEPUwmJnthdHRyaWJ1dGVzOiEwLGNoYXJhY3RlckRhdGE6ITAsYXR0cmlidXRlT2xkVmFsdWU6ITB9LFA9THx8ZnVuY3Rpb24oZSl7Qj0hMSx2LnJlbW92ZUV2ZW50TGlzdGVuZXIobyxQKX0sSD0hMSxCPSEwLGosRixJLHEsUixVO1R8fE4/KFI9ZnVuY3Rpb24oZSx0KXtiLmNhbGwodCxlKXx8RyhlLHQpfSxVPUcpOihSPWZ1bmN0aW9uKGUsdCl7ZVtpXXx8KGVbaV09bighMCksRyhlLHQpKX0sVT1SKSxMfHwodi5hZGRFdmVudExpc3RlbmVyKG8sUCksdi5zZXRBdHRyaWJ1dGUoaSwxKSx2LnJlbW92ZUF0dHJpYnV0ZShpKSxCJiYoaj1mdW5jdGlvbihlKXt2YXIgdD10aGlzLG4scixzO2lmKHQ9PT1lLnRhcmdldCl7bj10W2ldLHRbaV09cj1JKHQpO2ZvcihzIGluIHIpe2lmKCEocyBpbiBuKSlyZXR1cm4gRigwLHQscyxuW3NdLHJbc10sXCJBRERJVElPTlwiKTtpZihyW3NdIT09bltzXSlyZXR1cm4gRigxLHQscyxuW3NdLHJbc10sXCJNT0RJRklDQVRJT05cIil9Zm9yKHMgaW4gbilpZighKHMgaW4gcikpcmV0dXJuIEYoMix0LHMsbltzXSxyW3NdLFwiUkVNT1ZBTFwiKX19LEY9ZnVuY3Rpb24oZSx0LG4scixpLHMpe3ZhciBvPXthdHRyQ2hhbmdlOmUsY3VycmVudFRhcmdldDp0LGF0dHJOYW1lOm4scHJldlZhbHVlOnIsbmV3VmFsdWU6aX07b1tzXT1lLEoobyl9LEk9ZnVuY3Rpb24oZSl7Zm9yKHZhciB0LG4scj17fSxpPWUuYXR0cmlidXRlcyxzPTAsbz1pLmxlbmd0aDtzPG87cysrKXQ9aVtzXSxuPXQubmFtZSxuIT09XCJzZXRBdHRyaWJ1dGVcIiYmKHJbbl09dC52YWx1ZSk7cmV0dXJuIHJ9KSksdFtyXT1mdW5jdGlvbihuLHIpe3c9bi50b1VwcGVyQ2FzZSgpLEh8fChIPSEwLEw/KHE9ZnVuY3Rpb24oZSx0KXtmdW5jdGlvbiBuKGUsdCl7Zm9yKHZhciBuPTAscj1lLmxlbmd0aDtuPHI7dChlW24rK10pKTt9cmV0dXJuIG5ldyBMKGZ1bmN0aW9uKHIpe2Zvcih2YXIgaSxzLG89MCx1PXIubGVuZ3RoO288dTtvKyspaT1yW29dLGkudHlwZT09PVwiY2hpbGRMaXN0XCI/KG4oaS5hZGRlZE5vZGVzLGUpLG4oaS5yZW1vdmVkTm9kZXMsdCkpOihzPWkudGFyZ2V0LHMuYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrJiZpLmF0dHJpYnV0ZU5hbWUhPT1cInN0eWxlXCImJnMuYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKGkuYXR0cmlidXRlTmFtZSxpLm9sZFZhbHVlLHMuZ2V0QXR0cmlidXRlKGkuYXR0cmlidXRlTmFtZSkpKX0pfShYKFwiYXR0YWNoZWRcIiksWChcImRldGFjaGVkXCIpKSxxLm9ic2VydmUodCx7Y2hpbGRMaXN0OiEwLHN1YnRyZWU6ITB9KSk6KHQuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTU5vZGVJbnNlcnRlZFwiLEsoXCJhdHRhY2hlZFwiKSksdC5hZGRFdmVudExpc3RlbmVyKFwiRE9NTm9kZVJlbW92ZWRcIixLKFwiZGV0YWNoZWRcIikpKSx0LmFkZEV2ZW50TGlzdGVuZXIoXCJyZWFkeXN0YXRlY2hhbmdlXCIsZnVuY3Rpb24oZSl7eih0LnF1ZXJ5U2VsZWN0b3JBbGwoZCksXCJhdHRhY2hlZFwiKX0pLHQuY3JlYXRlRWxlbWVudD1mdW5jdGlvbihlLG4pe3ZhciByPV8uYXBwbHkodCxhcmd1bWVudHMpLGk9bS5jYWxsKGgsKG4/ZjphKSsobnx8ZSkudG9VcHBlckNhc2UoKSkscz0tMTxpO3JldHVybiBuJiYoci5zZXRBdHRyaWJ1dGUoXCJpc1wiLG49bi50b0xvd2VyQ2FzZSgpKSxzJiYocz0kKGUudG9VcHBlckNhc2UoKSxuKSkpLHMmJlUocixwW2ldKSxyfSxBLmNsb25lTm9kZT1mdW5jdGlvbihlKXt2YXIgdD1PLmNhbGwodGhpcywhIWUpLG49Vih0KTtyZXR1cm4tMTxuJiZVKHQscFtuXSksZSYmVyh0LnF1ZXJ5U2VsZWN0b3JBbGwoZCkpLHR9KTtpZigtMjxtLmNhbGwoaCxmK3cpK20uY2FsbChoLGErdykpdGhyb3cgbmV3IEVycm9yKFwiQSBcIituK1wiIHR5cGUgaXMgYWxyZWFkeSByZWdpc3RlcmVkXCIpO2lmKCFsLnRlc3Qodyl8fC0xPG0uY2FsbChjLHcpKXRocm93IG5ldyBFcnJvcihcIlRoZSB0eXBlIFwiK24rXCIgaXMgaW52YWxpZFwiKTt2YXIgaT1mdW5jdGlvbigpe3JldHVybiB0LmNyZWF0ZUVsZW1lbnQodix1JiZ3KX0sbz1yfHxnLHU9eS5jYWxsKG8scyksdj11P3Jbc10udG9VcHBlckNhc2UoKTp3LGI9aC5wdXNoKCh1P2Y6YSkrdyktMSx3O3JldHVybiBkPWQuY29uY2F0KGQubGVuZ3RoP1wiLFwiOlwiXCIsdT92KydbaXM9XCInK24udG9Mb3dlckNhc2UoKSsnXCJdJzp2KSxpLnByb3RvdHlwZT1wW2JdPXkuY2FsbChvLFwicHJvdG90eXBlXCIpP28ucHJvdG90eXBlOkMoQSkseih0LnF1ZXJ5U2VsZWN0b3JBbGwoZCksXCJhdHRhY2hlZFwiKSxpfX0pKHdpbmRvdyxkb2N1bWVudCxPYmplY3QsXCJyZWdpc3RlckVsZW1lbnRcIik7IiwibW9kdWxlLmV4cG9ydHMgPSAnPHRlbXBsYXRlIGlkPVwiYnJpY2stc2VsZWN0LXRlbXBsYXRlXCI+XFxuJyArXG4gICAgJyAgPGJ1dHRvbiBjbGFzcz1cImhhbmRsZVwiPjxzcGFuPjwvc3Bhbj48L2J1dHRvbj5cXG4nICtcbiAgICAnXFxuJyArXG4gICAgJyAgPGRpdiBjbGFzcz1cImRpYWxvZ3VlXCIgcm9sZT1cImRpYWxvZ1wiPlxcbicgK1xuICAgICcgICAgPGRpdiBjbGFzcz1cInBhbmVsXCI+XFxuJyArXG4gICAgJyAgICAgIDxoZWFkZXI+XFxuJyArXG4gICAgJyAgICAgICAgPGgxPjwvaDE+XFxuJyArXG4gICAgJyAgICAgIDwvaGVhZGVyPlxcbicgK1xuICAgICcgICAgICA8dWwgY2xhc3M9XCJtZW51XCI+XFxuJyArXG4gICAgJyAgICAgIDwvdWw+XFxuJyArXG4gICAgJyAgICAgIDxmb290ZXIgY2xhc3M9XCJzaW5nbGVcIj5cXG4nICtcbiAgICAnICAgICAgICA8YnV0dG9uIGNsYXNzPVwiY2xvc2VcIj5DbG9zZTwvYnV0dG9uPlxcbicgK1xuICAgICcgICAgICA8L2Zvb3Rlcj5cXG4nICtcbiAgICAnICAgICAgPGZvb3RlciBjbGFzcz1cIm11bHRpcGxlXCI+XFxuJyArXG4gICAgJyAgICAgICAgPGJ1dHRvbiBjbGFzcz1cImNhbmNlbFwiPkNhbmNlbDwvYnV0dG9uPlxcbicgK1xuICAgICcgICAgICAgIDxidXR0b24gY2xhc3M9XCJjb21taXRcIj5TZWxlY3Q8L2J1dHRvbj5cXG4nICtcbiAgICAnICAgICAgPC9mb290ZXI+XFxuJyArXG4gICAgJyAgICA8L2Rpdj5cXG4nICtcbiAgICAnICA8L2Rpdj5cXG4nICtcbiAgICAnPC90ZW1wbGF0ZT5cXG4nICtcbiAgICAnXFxuJyArXG4gICAgJzx0ZW1wbGF0ZSBpZD1cImJyaWNrLXNlbGVjdC1vcHRpb24tdGVtcGxhdGVcIj5cXG4nICtcbiAgICAnICA8bGkgY2xhc3M9XCJtZW51LWl0ZW1cIj5cXG4nICtcbiAgICAnICAgIDxzcGFuIGNsYXNzPVwibGFiZWxcIj48L3NwYW4+PGkgY2xhc3M9XCJpY29uXCI+PC9pPlxcbicgK1xuICAgICcgICAgPGRpdiBjbGFzcz1cImZlZWRiYWNrXCI+PC9kaXY+XFxuJyArXG4gICAgJyAgPC9saT5cXG4nICtcbiAgICAnPC90ZW1wbGF0ZT5cXG4nICtcbiAgICAnJzsiXX0=
