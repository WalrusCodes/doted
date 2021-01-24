let canvas = null;
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

  // TODO: remove the object URL if one was created in the past.
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

// Handles a doubleclick on canvas.
function handleDoubleClick(options) {
  if (!isEditPointsMode()) {
    // TODO: here we'll want to have point insertion and removal for the
    // outline:
    // * clicking on existing point should remove it unless there's only 3
    //   points left.
    // * clicking on empty space should find the closest line, then the point
    //   on this line, then insert it there.
    return;
  }
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
  canvas.add(
    new fabric.Circle({
      left: x - 10,
      top: y - 10,
      radius: 10,
      hasControls: false,
      // Padding for the control border when the point is selected.
      padding: 3,
      fill: "rgba(0, 0, 0, 0.5)",
      stroke: "white",
      strokeWidth: 2,
      // Don't show the border around a point when it's selected.
      hasBorders: false,
    })
  );
}

// Initializes and configures fabricjs canvas.
function initCanvas() {
  const canvasObj = document.getElementById("canvas");
  // TODO: size automatically to fill the window?
  canvasObj.width = 800;
  canvasObj.height = 400;

  // Create Fabric.js Canvas object, point it at our canvas by id.
  canvas = new fabric.Canvas("canvas");

  // Handle a doubleclick on canvas - if we click an existing point, remove it,
  // otherwise, create it.
  canvas.on("mouse:dblclick", handleDoubleClick);

  // When a selection is made (by clicking and dragging), Fabric creates a
  // temporary group. We disable controls on it so that it can't be scaled or
  // rotated. It still can be dragged around to move multiple points.
  canvas.on("selection:created", (ev) => {
    if (isEditPointsMode()) {
      ev.target.set("hasControls", false);
    }
  });

  // TODO: add/update when image gets loaded.
  const points = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];

  const p = new fabric.Polygon(points, {
    left: 10,
    top: 10,
    evented: false,
    selectable: false,
    fill: "rgba(0,0,0,0)",
    strokeWidth: 4,
    stroke: "gray",
    strokeDashArray: [3, 3],
    objectCaching: false,
    cornerStyle: "circle",
    cornerColor: "rgba(0,0,255,0.5)",
    // Don't show the border around a point when it's selected.
    hasBorders: false,
  });
  canvas.add(p);
}

// Generates an SVG and prompts the user to download it.
function saveSvg() {
  const blob = new Blob([canvas.toSVG()], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "doted.svg";
  const handler = () => {
    setTimeout(() => {
      URL.revokeObjectURL(url);
      this.removeEventListener("click", handler);
    }, 150);
  };
  a.addEventListener("click", handler, false);
  a.click();
}

function isEditPointsMode() {
  const editModePoints = document.getElementById("editModePoints");
  return editModePoints.checked;
}

// Locates the controls for the outline polygon.
//
// Cribbed from fabricjs demos.
function outlinePolygonPositionHandler(_dim, _finalMatrix, fabricObject) {
  // console.log(`opp: ${this.pointIndex}`);
  var x = fabricObject.points[this.pointIndex].x - fabricObject.pathOffset.x,
    y = fabricObject.points[this.pointIndex].y - fabricObject.pathOffset.y;
  return fabric.util.transformPoint(
    { x: x, y: y },
    fabric.util.multiplyTransformMatrices(
      fabricObject.canvas.viewportTransform,
      fabricObject.calcTransformMatrix()
    )
  );
}

// Handler for when polygon controls are being dragged around. It's hella
// tricky as we need to adjust the size of the polygon and keep it in the same
// place as the points are being dragged around.
//
// Cribbed from fabricjs demos.
function actionHandler(_eventData, transform, x, y) {
  // Polygon being moved around.
  const poly = transform.target;

  // Index of the point being moved around.
  const pIndex = poly.controls[poly.__corner].pointIndex;

  // Pick a different point that we use for calculations to go to absolute
  // coordinates and back.
  const otherIndex = pIndex > 0 ? pIndex - 1 : pIndex + 1;
  const absolutePoint = fabric.util.transformPoint(
    {
      x: poly.points[otherIndex].x - poly.pathOffset.x,
      y: poly.points[otherIndex].y - poly.pathOffset.y,
    },
    poly.calcTransformMatrix()
  );
  const mouseLocalPosition = poly.toLocalPoint(
    new fabric.Point(x, y),
    "center",
    "center"
  );
  let polygonBaseSize = poly._getNonTransformedDimensions();
  const size = poly._getTransformedDimensions(0, 0);
  poly.points[pIndex] = {
    x: (mouseLocalPosition.x * polygonBaseSize.x) / size.x + poly.pathOffset.x,
    y: (mouseLocalPosition.y * polygonBaseSize.y) / size.y + poly.pathOffset.y,
  };
  poly._setPositionDimensions({});

  // Recalculate polygon size after we've moved the point.
  polygonBaseSize = poly._getNonTransformedDimensions();

  // Move the polygon.
  var newX =
    (poly.points[otherIndex].x - poly.pathOffset.x) / polygonBaseSize.x;
  var newY =
    (poly.points[otherIndex].y - poly.pathOffset.y) / polygonBaseSize.y;
  poly.setPositionByOrigin(absolutePoint, newX + 0.5, newY + 0.5);

  return true;
}

// Sets polygon control points to match the vertices.
function updatePolygonControls(poly) {
  // We redefine the controls to be each point of the polygon.
  poly.controls = poly.points.reduce(function (acc, _point, index) {
    acc["p" + index] = new fabric.Control({
      // calculate positions for the handles
      positionHandler: outlinePolygonPositionHandler,
      // What to do when the control is moved around.
      actionHandler: actionHandler,
      // Override default action of "scale".
      actionName: "modifyPolygon",
      pointIndex: index,
    });
    return acc;
  }, {});
  canvas.requestRenderAll();
}

// Changes edit mode between point editing and outline editing.
function changeEditMode() {
  if (isEditPointsMode()) {
    // Go to Edit Points mode.
    canvas.selection = true;
    // Make all selectable, polygons non-selectable.
    canvas.forEachObject((obj) => {
      if (obj.type === "circle") {
        obj.set("evented", true);
        obj.set("selectable", true);
      } else if (obj.type === "polygon") {
        obj.set("evented", false);
        obj.set("selectable", false);
      }
    });
    // Unselect the outline object if selected.
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  } else {
    // Go to Edit Outline mode.
    canvas.selection = false;

    // Make all points non-selectable, polygons selectable.
    canvas.forEachObject((obj) => {
      if (obj.type === "circle") {
        obj.set("evented", false);
        obj.set("selectable", false);
      } else if (obj.type === "polygon") {
        obj.set("evented", true);
        obj.set("selectable", true);
      }
    });

    const poly = canvas.getObjects("polygon")[0];
    updatePolygonControls(poly);
    canvas.setActiveObject(poly);
  }
}

// Called on page load, sets up handlers & canvas.
function init() {
  const loadBtn = document.getElementById("loadImageButton");
  // Clicking on "Load image" button opens the hidden filepicker.
  loadBtn.addEventListener("click", () => fileInput.click(), false);

  const saveSvgBtn = document.getElementById("saveSvgButton");
  saveSvgBtn.addEventListener("click", () => saveSvg(), false);

  const fileInput = document.getElementById("fileInput");

  initCanvas();
  // Picking a file calls handleFileInput.
  fileInput.addEventListener(
    "change",
    () => handleFileInput(fileInput.files),
    false
  );

  const editModePoints = document.getElementById("editModePoints");
  editModePoints.checked = true;
  editModePoints.addEventListener("change", () => changeEditMode(), false);
  const editModeOutline = document.getElementById("editModeOutline");
  editModeOutline.addEventListener("change", () => changeEditMode(), false);

  // XXX: for development:
  /*
  setTimeout(() => {
    editModeOutline.click();
  }, 500);

  setTimeout(() => {
    const poly = canvas.getObjects("polygon")[0];
    poly.points.push({ x: 50, y: 25 });
    updatePolygonControls(poly);
    console.log(poly.points);
  }, 1000);
  */
}

window.addEventListener("load", () => init(), false);
