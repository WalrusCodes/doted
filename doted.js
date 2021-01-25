let canvas = null;
// fabric.Image object if one already is inserted.
let insertedImage = null;

const MAX_DISTANCE_TO_ADD_OFFSET_POINT = 50;

const IMAGE_MARGIN = 10;

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
    const cWidth = canvas.width - 2 * IMAGE_MARGIN;
    const cHeight = canvas.height - 2 * IMAGE_MARGIN;
    // Pick scaling to height or width so that the image fits within canvas.
    if (img.width / cWidth > img.height / cHeight) {
      img.scaleToWidth(cWidth, true);
    } else {
      img.scaleToHeight(cHeight, true);
    }
    img.set("left", IMAGE_MARGIN);
    img.set("top", IMAGE_MARGIN);
    img.set("selectable", false);
    // Don't change mouse cursor, don't apply events.
    img.set("evented", false);
    canvas.add(img);
    img.sendToBack();
    // Remove the old image if one exists.
    // TODO: instead of having a global, find by type?
    if (insertedImage !== null) {
      canvas.remove(insertedImage);
    }
    insertedImage = img;

    // If outline hasn't been modified manually yet, adjust it to image
    // boundary.
    const poly = canvas.getObjects("polygon")[0];
    if (!poly.modifiedManually) {
      poly.points = buildDefaultPoints(
        img.left,
        img.top,
        img.width * img.scaleX,
        img.height * img.scaleY
      );
      updatePolygonControls(poly);
    }
  });
}

// Cribbed from
// https://stackoverflow.com/questions/849211/shortest-distance-between-a-point-and-a-line-segment
function distToSegmentSquared(p, v, w) {
  function sqr(x) {
    return x * x;
  }

  function dist2(v, w) {
    return sqr(v.x - w.x) + sqr(v.y - w.y);
  }

  const l2 = dist2(v, w);
  if (l2 == 0) return dist2(p, v);

  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return dist2(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
}

function distToSegment(p, v, w) {
  return Math.sqrt(distToSegmentSquared(p, v, w));
}

// Finds which of polygon segments is closest to the given point.
//
// Returns index for the line (index, index+1) that's closest to given clicked
// point. If the point is too far from any lines, returns -1.
function findPolySegmentClosestToPoint(poly, p) {
  let dists = poly.points.map((pt1, index) => {
    const pt2 = poly.points[(index + 1) % poly.points.length];
    const dist = distToSegment(p, pt1, pt2);
    return { dist: dist, index: index };
  });
  dists.sort((a, b) => a.dist - b.dist);
  if (dists[0].dist < MAX_DISTANCE_TO_ADD_OFFSET_POINT) {
    return dists[0].index;
  } else {
    return -1;
  }
}

// Handles adding/removing points from outline.
function modifyOutlinePoints(options) {
  const poly = options.target;
  if (!poly) {
    // Didn't click on the object.
    return;
  }
  // Calculate pointer inside the canvas.
  const pointer = canvas.getPointer(options.e, true);
  const corner = poly._findTargetCorner(pointer, false);
  if (corner) {
    // Delete a point if we have at least 4 points.
    if (poly.points.length >= 4) {
      const index = poly.controls[corner].pointIndex;
      poly.points.splice(index, 1);
      updatePolygonControls(poly);
    }
  } else {
    const mouseLocalPosition = poly
      .toLocalPoint(pointer, "center", "center")
      .add(poly.pathOffset);
    const index = findPolySegmentClosestToPoint(poly, mouseLocalPosition);
    if (index < 0) return;
    poly.points.splice(index + 1, 0, mouseLocalPosition);
    updatePolygonControls(poly);
  }
}

// Handles adding/removing non-outline points.
function modifyPoints(options) {
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

// Handles a doubleclick on canvas.
function handleDoubleClick(options) {
  if (isEditPointsMode()) {
    modifyPoints(options);
  } else {
    modifyOutlinePoints(options);
  }
}

// Builds points array for canvas size minus a margin.
function buildDefaultPoints(left, top, width, height) {
  return [
    { x: left, y: top },
    { x: left + width, y: top },
    { x: left + width, y: top + height },
    { x: left, y: top + height },
  ];
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

  // Create a default outline. If it hasn't been altered by the time image gets
  // loaded, we'll adjust it to the size of the image.
  const points = buildDefaultPoints(
    IMAGE_MARGIN,
    IMAGE_MARGIN,
    canvas.width - 2 * IMAGE_MARGIN,
    canvas.height - 2 * IMAGE_MARGIN
  );

  const p = new fabric.Polygon(points, {
    left: IMAGE_MARGIN,
    top: IMAGE_MARGIN,
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
    // Custom property to track whether the outline was modified manually or
    // not.
    modifiedManually: false,
  });
  canvas.add(p);
}

// Generates an SVG and prompts the user to download it.
function saveSvg() {
  // Create a simple canvas with a simpler outline polygon and point
  // presentation before exporting it to SVG.
  const canvasOut = new fabric.Canvas("", {
    width: canvas.width,
    height: canvas.height,
  });

  canvas.forEachObject((obj) => {
    if (obj.type === "circle") {
      // TODO: make the hole radius configurable.
      const radius = 10;
      canvasOut.add(
        new fabric.Circle({
          left: obj.left + obj.radius - radius,
          top: obj.top + obj.radius - radius,
          radius: radius,
          fill: "rgba(0, 0, 0, 0)",
          stroke: "black",
        })
      );
    } else if (obj.type === "polygon") {
      canvasOut.add(
        new fabric.Polygon(obj.points, {
          left: obj.left,
          top: obj.top,
          fill: "rgba(0,0,0,0)",
          strokeWidth: 1,
          stroke: "black",
        })
      );
    }
  });
  const blob = new Blob([canvasOut.toSVG()], { type: "image/svg+xml" });
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

  poly.modifiedManually = true;

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
  // setTimeout(() => {
  //   editModeOutline.click();
  // }, 500);
  //
  // setTimeout(() => {
  //   const poly = canvas.getObjects("polygon")[0];
  //   poly.points.push({ x: 50, y: 25 });
  //   updatePolygonControls(poly);
  //   console.log(poly.points);
  // }, 1000);
}

window.addEventListener("load", () => init(), false);
