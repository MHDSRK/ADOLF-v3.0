(function () {
  var root = document.documentElement
  try {
    var saved = localStorage.getItem("wacrm.mode")
    root.dataset.mode = saved === "light" || saved === "dark" ? saved : "dark"
  } catch (_error) {
    root.dataset.mode = "dark"
  }
})()
