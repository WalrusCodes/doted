let canvas = null;

// Shows error message.
function showError(msg) {
  const el = document.getElementById("errorMessage");
  el.innerText = msg;
  el.style.display = "inline";
}

// Clears error message.
function clearError() {
  const el = document.getElementById("errorMessage");
  el.style.display = "none";
}

// Loads image from picked file.
//
// Called when file is picked in the file picker.
function handleFileInput(fileList) {
  clearError();

  if (fileList.length != 1) {
    showError("please select 1 file");
    return;
  }

  const file = fileList[0];
  if (!file.type.startsWith("image/")) {
    showError("file is not an image");
    return;
  }

  fabric.Image.fromURL(URL.createObjectURL(file), function (img) {
    if (img.width === 0) {
      showError("failed to load image");
      return;
    }
    // Pick scaling to height or width so that the image fits within canvas.
    if (img.width / canvas.width > img.height / canvas.height) {
      img.scaleToWidth(canvas.width, true);
    } else {
      img.scaleToHeight(canvas.height, true);
    }
    img.set("selectable", false);
    canvas.add(img);
  });
}

// Called on page load, sets up handlers & canvas.
function init() {
  const button = document.getElementById("loadImageButton");
  const fileInput = document.getElementById("fileInput");
  const canvasObj = document.getElementById("canvas");
  // TODO: size automatically to fill the window?
  canvasObj.width = 800;
  canvasObj.height = 400;
  // Clicking on "Load image" button opens the hidden filepicker.
  button.addEventListener("click", () => fileInput.click(), false);
  // Picking a file calls handleFileInput.
  fileInput.addEventListener(
    "change",
    () => handleFileInput(fileInput.files),
    false
  );
  // Create Fabric.js Canvas object, point it at our <canvas>.
  canvas = new fabric.Canvas("canvas");
  canvas.add(new fabric.Rect({ width: 10, height: 20 }));
}

window.addEventListener("load", () => init(), false);
