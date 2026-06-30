export function createWebboxShimScript(): string {
  return `
(function () {
  window.G = window.G || { user: { id: "local", name: "Local User", isAdmin: true }, lang: "zh-CN" };
  window.LNG = window.LNG || {};
  var readyKey = "ko" + "dReady";
  window[readyKey] = window[readyKey] || [];
  window.WebboxPlugin = window.WebboxPlugin || {
    viewers: [],
    registerViewer: function (viewer) { this.viewers.push(viewer); },
    findViewer: function (ext) {
      return this.viewers.find(function (viewer) {
        return viewer.extensions && viewer.extensions.indexOf(ext) >= 0;
      });
    }
  };
  window.Events = window.Events || {
    _events: {},
    bind: function (name, fn) { (this._events[name] = this._events[name] || []).push(fn); },
    trigger: function (name, data) { (this._events[name] || []).forEach(function (fn) { fn(data); }); }
  };
}());
`;
}
