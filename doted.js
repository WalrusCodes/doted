let canvas = null;
let addHoleMode = false;
// fabric.Image object if one already is inserted.
let insertedImage = null;

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
    // Don't change mouse cursor, don't apply events.
    img.set("evented", false);
    canvas.add(img);
    img.sendToBack();
    // Remove the old image if one exists.
    if (insertedImage !== null) {
      canvas.remove(insertedImage);
    }
    insertedImage = img;
  });
}

// Initializes and configures fabricjs canvas.
function initCanvas() {
  const canvasObj = document.getElementById("canvas");
  // TODO: size automatically to fill the window?
  canvasObj.width = 800;
  canvasObj.height = 400;

  // Create Fabric.js Canvas object, point it at our canvas by id.
  canvas = new fabric.Canvas("canvas");
  // For now, disable group selection.
  canvas.selection = false;
  // canvas.add(new fabric.Rect({ width: 10, height: 20 }));

  // Handle a doubleclick on canvas - if we click an existing point, remove it,
  // otherwise, create it.
  canvas.on("mouse:dblclick", (options) => {
    if (options.target !== null) {
      // Existing point double-clicked - remove it.
      canvas.remove(options.target);
      return;
    }
    // Otherwise, sanity check that the click was within canvas, and create a
    // point.
    const { x, y } = options.pointer;
    if (x < 0 || x > canvas.width || y < 0 || y > canvas.height) {
      return;
    }
    const c = new fabric.Circle({
      left: x - 10,
      top: y - 10,
      radius: 10,
      hasControls: false,
      // Padding for the control border when the point is selected.
      padding: 3,
      fill: "rgba(0, 0, 0, 0.5)",
      stroke: "white",
      strokeWidth: 2,
    });
    canvas.add(c);
  });
}

// Called on page load, sets up handlers & canvas.
function init() {
  const loadBtn = document.getElementById("loadImageButton");
  const fileInput = document.getElementById("fileInput");

  initCanvas();
  // Clicking on "Load image" button opens the hidden filepicker.
  loadBtn.addEventListener("click", () => fileInput.click(), false);
  // Picking a file calls handleFileInput.
  fileInput.addEventListener(
    "change",
    () => handleFileInput(fileInput.files),
    false
  );
}

window.addEventListener("load", () => init(), false);
