(window["webpackJsonp"] = window["webpackJsonp"] || []).push([["ctChunk-reactdevtools"],{

/***/ "./src/plugins/ReactDevtools.tsx":
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "create", function() { return create; });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../../node_modules/react/index.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var react_dom__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("../../node_modules/react-dom/index.js");
/* harmony import */ var react_dom__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(react_dom__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var react_devtools_inline_backend__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__("../../node_modules/react-devtools-inline/backend.js");
/* harmony import */ var react_devtools_inline_backend__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(react_devtools_inline_backend__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _ReactDevtoolsFallback__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__("./src/plugins/ReactDevtoolsFallback.tsx");
/* harmony import */ var react_devtools_inline_frontend__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__("../../node_modules/react-devtools-inline/frontend.js");
/* harmony import */ var react_devtools_inline_frontend__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(react_devtools_inline_frontend__WEBPACK_IMPORTED_MODULE_4__);





const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
function create() {
  // This doesn't really have sense right now due, but we need to deal with this in future
  // For now react-split-pane view is recreating virtual tree on each render
  // Thats why when `state.spec` changed domElement will be recreated and content will be flushed
  let DevTools = _ReactDevtoolsFallback__WEBPACK_IMPORTED_MODULE_3__[/* ReactDevtoolsFallback */ "a"];
  let isMounted = false;
  let isFirstMount = true;
  let _contentWindow = null;
  let devtoolsRoot = null;

  function mount(domElement) {
    if (!isFirstMount) {
      // if devtools were unmounted it is closing the bridge, so we need to reinitialize the bridge on our side
      DevTools = Object(react_devtools_inline_frontend__WEBPACK_IMPORTED_MODULE_4__["initialize"])(_contentWindow);
      Object(react_devtools_inline_backend__WEBPACK_IMPORTED_MODULE_2__["activate"])(_contentWindow);
    }

    if (domElement) {
      // @ts-expect-error unstable is not typed
      devtoolsRoot = react_dom__WEBPACK_IMPORTED_MODULE_1___default.a.unstable_createRoot(domElement);
    }

    devtoolsRoot.render( /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default.a.createElement(DevTools, {
      browserTheme: prefersDarkScheme ? 'dark' : 'light'
    }));
    isMounted = true;
    isFirstMount = false;
  }

  function unmount() {
    isMounted = false;
    devtoolsRoot.unmount();
  }

  function initialize(contentWindow) {
    _contentWindow = contentWindow; // @ts-expect-error global hook for react devtools is not typed

    window.__REACT_DEVTOOLS_TARGET_WINDOW__ = contentWindow;
    Object(react_devtools_inline_backend__WEBPACK_IMPORTED_MODULE_2__["initialize"])(contentWindow); // if devtools is rendered for previous spec we need to rerender them for new component

    if (isMounted) {
      mount();
    } else {
      isFirstMount = true; // when we are initialized the devtools we can preconnect the devtools to the bridge
      // so the devtools will instantly open instead of loading for connection

      DevTools = Object(react_devtools_inline_frontend__WEBPACK_IMPORTED_MODULE_4__["initialize"])(_contentWindow);
      Object(react_devtools_inline_backend__WEBPACK_IMPORTED_MODULE_2__["activate"])(_contentWindow);
    }
  }

  return {
    name: 'React devtools',
    type: 'devtools',
    mount,
    unmount,
    initialize
  };
}

/***/ }),

/***/ "./src/plugins/ReactDevtoolsFallback.tsx":
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "a", function() { return ReactDevtoolsFallback; });
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__("../../node_modules/react/index.js");
/* harmony import */ var react__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(react__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _devtools_fallback_scss__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__("./src/plugins/devtools-fallback.scss");


const ReactDevtoolsFallback = () => {
  return /*#__PURE__*/react__WEBPACK_IMPORTED_MODULE_0___default.a.createElement("p", {
    className: "react-devtools-fallback"
  }, "Select a spec or re-run the current spec to activate devtools.");
};

/***/ }),

/***/ "./src/plugins/devtools-fallback.scss":
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
// extracted by mini-css-extract-plugin


/***/ })

}]);