var unet = null;
const imw = 224;
const imh = 224;
const imageExamples = {
  headshoulderdata: "00010.jpg,00011.jpg,00012.jpg,00013.jpg,00014.jpg,02628.jpg,02631.jpg,02632.jpg,02618.jpg".split(
    ","
  ),
  humanparsingdata: "2500_1064.jpg,dataset10k_4596.jpg,dataset10k_9634.jpg,dataset10k_992.jpg,dataset10k_9982.jpg,dataset10k_9990.jpg,dataset10k_9991.jpg,dataset10k_9993.jpg,fash_494.jpg".split(
    ","
  ),
  persondata: "10203.jpg,10206.jpg,10210.jpg,10212.jpg,10245.jpg,10247.jpg,10259.jpg,10286.jpg,10299.jpg".split(
    ","
  )
};

const videoExamples = {
  headshoulderdata: ["test.mp4"],
  humanparsingdata: [],
  persondata: []
};

var modelFolder = "headshoulderdata";

async function reloadModel(newModel) {
  processing = false;
  stopVideo();
  modelFolder = newModel;
  init();
}

async function loadUNet() {
  statusDiv.textContent = "loading model...";
  const unet = await tf.loadModel(modelFolder + "/model.json");
  statusDiv.textContent = "warming up...";
  const predictedClass = tf.tidy(() => {
    var tfImage = tf.fromPixels(canvasElement);
    //tfImage = tfImage.slice([0, 0, 0], [imh, imw, 3]);
    var batchedImage = tfImage.expandDims(0);
    batchedImage = batchedImage.toFloat().div(tf.scalar(255));
    const result = unet.predict(batchedImage);
    return result;
  });
  const l = await predictedClass.data();
  predictedClass.dispose();
  statusDiv.textContent = "model ready";
  return unet;
}

function adjustVideoSize(width, height) {
  const aspectRatio = width / height;
  //console.log(aspectRatio);
  if (width >= height) {
    webcamElement.width = aspectRatio * webcamElement.height;
  } else if (width < height) {
    webcamElement.height = webcamElement.width / aspectRatio;
  }
}

async function setupVideo(src) {
  return new Promise((resolve, reject) => {
    webcamElement.addEventListener(
      "loadeddata",
      async () => {
        this.adjustVideoSize(
          webcamElement.videoWidth,
          webcamElement.videoHeight
        );
        resolve();
      },
      false
    );
    webcamElement.addEventListener(
      "ended",
      function() {
        if (processing) fpsdiv.textContent = "END";
        processing = false;
      },
      false
    );
    webcamElement.src = src;
    if (webcamElement.canPlayType("video/mp4") === "")
      alert(
        "Your browser does not play WEBM videos. Please try Chrome or Firefox"
      );
  });
}

function pickWebCam() {
  processing = false;
  stopVideo();
  setupWebcam().then(() => {
    processing = true;
    processWebCam();
  });
}

function stopVideo() {
  if (webcamElement.srcObject && webcamElement.srcObject.getTracks()[0])
    webcamElement.srcObject.getTracks()[0].stop();
  if (!webcamElement.paused) webcamElement.pause();
}

async function setupWebcam() {
  return new Promise((resolve, reject) => {
    const navigatorAny = navigator;
    navigator.getUserMedia =
      navigator.getUserMedia ||
      navigatorAny.webkitGetUserMedia ||
      navigatorAny.mozGetUserMedia ||
      navigatorAny.msGetUserMedia;
    if (navigator.getUserMedia) {
      navigator.getUserMedia(
        { video: true },
        stream => {
          webcamElement.srcObject = stream;
          webcamElement.addEventListener(
            "loadeddata",
            async () => {
              this.adjustVideoSize(
                webcamElement.videoWidth,
                webcamElement.videoHeight
              );
              resolve();
            },
            false
          );
        },
        error => {
          alert("no webcam");
          resolve();
        }
      );
    } else {
      reject();
    }
  });
}

function cropImage(img) {
  const size = Math.min(img.shape[0], img.shape[1]);
  const centerHeight = img.shape[0] / 2;
  const beginHeight = centerHeight - imh / 2;
  const centerWidth = img.shape[1] / 2;
  const beginWidth = centerWidth - imw / 2;
  return img.slice([beginHeight, beginWidth, 0], [imh, imw, 3]);
}

//var imgdata = canvasElement2.getContext('2d').createImageData(imw,imh);
//var data = imgdata.data;

function drawResult(l) {
  //console.log('drawResult');
  var blendImgData = canvasElement
    .getContext("2d")
    .getImageData(0, 0, imw, imh);
  var blendData = blendImgData.data;
  var idx = 0;
  var idx4 = 0;
  /*for (var i=0;i<imh*imw;i++)
	{
		data[idx4] = 0;
		data[idx4+1] = 0;
		data[idx4+2] = 0;
		data[idx4+3] = 255;
		idx4 += 4;
	}
	idx4 = 0;*/
  for (var j = 0; j < imh; j++) {
    for (var i = 0; i < imw; i++) {
      var pixel = l[idx];
      var val = 0;
      if (pixel >= 0.8) val = 255;
      if (val === 0) {
        blendData[idx4] = 0;
        blendData[idx4 + 1] = 0;
        blendData[idx4 + 2] = 0;
        blendData[idx4 + 3] = 0;
      }
      /*data[idx4] = val;
			data[idx4+1] = val;
			data[idx4+2] = val;
			data[idx4+3] = 255;*/
      idx++;
      idx4 += 4;
    }
  }
  //canvasElement2.getContext('2d').putImageData(imgdata,0,0);
  canvasElement3.getContext("2d").putImageData(blendImgData, 0, 0);
}

var result = null;
var fps = 0;

async function init() {
  var key = modelFolder.split("_")[0]; // modelFolder can be '..._separable', we just want the first part
  //console.log(modelFolder, key);
  var listVideos = videoExamples[key];
  videoexamples.textContent = "";
  for (var i = 0; i < listVideos.length; i++) {
    var src = listVideos[i];
    var a = document.createElement("A");
    a.href = "javascript:void(0)";
    a.textContent = listVideos[i]; //.split('.')[0];
    a.dataset.src = "videos/" + src;
    a.className = "videolink";
    videoexamples.appendChild(a);
  }

  var listImages = imageExamples[key];
  imageexamples.textContent = "";
  for (var i = 0; i < listImages.length; i++) {
    var img = document.createElement("img");
    img.src = "images/" + listImages[i];
    img.className = "example";
    img.title = listImages[i];
    imageexamples.appendChild(img);
  }

  unet = await loadUNet();

  // add click handlers after model is loaded
  document.querySelectorAll(".example").forEach(
    img =>
      (img.onclick = function() {
        processing = false;
        stopVideo();
        fpsdiv.textContent = "";
        processImage(this);
      })
  );

  document.querySelectorAll(".videolink").forEach(a =>
    a.addEventListener("click", function() {
      processing = false;
      stopVideo();
      setupVideo(this.dataset.src).then(() => {
        processing = true;
        processWebCam();
      });
    })
  );
}

var processing = false;

async function processWebCam(time) {
  while (processing) {
    var starttime = performance.now();
    const predictedClass = tf.tidy(() => {
      var w = webcamElement.videoWidth;
      var h = webcamElement.videoHeight;
      var dw = (w - h) / 2;
      var dh = 0;
      if (h > w) {
        dw = 0;
        dh = (h - w) / 2;
      }
      canvasElement
        .getContext("2d")
        .drawImage(
          webcamElement,
          dw,
          dh,
          w - 2 * dw,
          h - 2 * dh,
          0,
          0,
          imw,
          imh
        );
      var tfImage = tf.fromPixels(canvasElement);
      //tfImage = tfImage.slice([0, 0, 0], [imh, imw, 3]);
      var batchedImage = tfImage.expandDims(0);
      batchedImage = batchedImage.toFloat().div(tf.scalar(255));
      const result = unet.predict(batchedImage);
      return result;
    });

    const l = await predictedClass.data();
    predictedClass.dispose();
    drawResult(l);
    var duration = performance.now() - starttime;
    fps = 1000 / duration;
    fps = fps.toFixed(1);
    if (processing) fpsdiv.textContent = fps + " FPS";
    await tf.nextFrame();
  }
  //fpsdiv.textContent = 'ENDED';
}

async function processImage(image) {
  var starttime = performance.now();
  const predictedClass = tf.tidy(() => {
    var w = image.naturalWidth;
    var h = image.naturalHeight;
    canvasElement.getContext("2d").drawImage(image, 0, 0, w, h, 0, 0, imw, imh);
    var tfImage = tf.fromPixels(canvasElement);
    //tfImage = tfImage.slice([0, 0, 0], [imh, imw, 3]);
    var batchedImage = tfImage.expandDims(0);
    batchedImage = batchedImage.toFloat().div(tf.scalar(255));
    const result = unet.predict(batchedImage);
    return result;
  });

  const l = await predictedClass.data();
  predictedClass.dispose();
  drawResult(l);

  var duration = performance.now() - starttime;
  duration = duration.toFixed(0);
  fpsdiv.textContent = duration + " ms";
}

function addImage(file) {
  var r = new FileReader();
  r.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      processing = false;
      fpsdiv.textContent = "";
      processImage(this);
    };
    img.onerror = function(e) {
      console.error(e);
    };
    img.src = e.target.result;
  };
  r.readAsDataURL(file);
}

function handleData(dataTransfer) {
  var files = dataTransfer.files;
  for (var i = 0; i < files.length; i++) {
    addImage(files[i]);
  }
}

function setDropZone(elem) {
  elem.addEventListener(
    "dragenter",
    function(evt) {
      evt.preventDefault();
      document.body.style.backgroundColor = "#ccc";
    },
    false
  );
  elem.addEventListener(
    "dragover",
    function(evt) {
      evt.preventDefault();
    },
    false
  );
  elem.addEventListener(
    "dragleave",
    function(evt) {
      evt.preventDefault();
      document.body.style.backgroundColor = "white";
    },
    false
  );
  elem.addEventListener(
    "drop",
    function(evt) {
      evt.preventDefault();
      document.body.style.backgroundColor = "white";
      //console.log("drop");
      handleData(evt.dataTransfer);
    },
    false
  );
}

setDropZone(document.body);
init();
webcamElement.volume = 0;
