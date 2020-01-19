'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('canvas');
  window.addEventListener('resize', () => runLayout(canvas));
  runLayout(canvas);
});

function runLayout(canvasElem) {
  canvas.width = document.documentElement.clientWidth;
  canvas.height = document.documentElement.clientHeight;
  

  console.log(canvas.width, canvas.height)

  const rectangles = [new Rect(10, 140, 10, 110)];

  const ctx = canvas.getContext('2d');
  rectangles.forEach(rect => ctx.fillRect(rect.x, rect.y, rect.width, rect.height));
}

class Rect {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }
}
