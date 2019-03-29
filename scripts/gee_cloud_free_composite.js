// Load Jambi province from feature table, imported to google fusion tables from GADM dataset
var roi = ee.FeatureCollection('ft:1O0ylwNlk2Mmqx7P0zSqqwhJA778oBciIt8Myhnxs', 'geometry');

var s2 = ee.ImageCollection("COPERNICUS/S2")
     .filterDate('2018-01-01', '2019-03-31');

// Bits 10 and 11 are clouds and cirrus, respectively.
var cloudBitMask = ee.Number(2).pow(10).int();
var cirrusBitMask = ee.Number(2).pow(11).int();

function maskS2clouds(image) {
  var qa = image.select('QA60');
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0).and(
             qa.bitwiseAnd(cirrusBitMask).eq(0));
  var mask2 = image.select('B2').lt(155000).and(
             image.select('B3').lt(2000).and(
             image.select('B9').lt(900)));
  return image.updateMask(mask).updateMask(mask2).divide(10000);
}

var cloudMasked = s2.filterBounds(roi).map(maskS2clouds);
var median = cloudMasked.median();
var clipped = median.clipToCollection(roi);

var visParams = {bands: ['B8', 'B4', 'B3'], min: 0.1, max: 0.4, gamma:1.5};

Map.centerObject(roi,8);
Map.addLayer(roi, {}, 'Jambi province');
Map.addLayer(clipped, visParams, 'median');
