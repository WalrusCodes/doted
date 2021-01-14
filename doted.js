function init() {
  const button = document.getElementById("loadImageButton");
  const inp = document.getElementById("fileInput");
  button.addEventListener("click", () => inp.click(), false);

  let c = new fabric.Canvas("canvas");
  c.add(new fabric.Rect({ width: 10, height: 20 }));
}

window.addEventListener("load", () => init(), false);
