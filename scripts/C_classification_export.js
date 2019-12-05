/////////////////////////////////////////////////////////////////////////////////////////
////////////////////00 VARIABLE SETTINGS/////////////////////////////////////////////////


// --------------------------------------------------------------------------------------
// -------------------VARIABLE SELECTION-------------------------------------------------

// set bandnames to use in classification as prediction variables.
// choose from ['B2','B3','B4','B5','B6','B7','B8','B8A','B11','B12','NDVI','NDWI','NBRI','NDMI','SAVI'
//             ,'VV','VH','VV_VH','VV_variance','VH_variance'].
var usedBands = ['B5','B11','B12','NDVI','NBRI',
                  'VV','VH','VV_VH'
];


// set date range for composite creation.
// sentinel1 
var s1_start = ee.Date('2018-01-01');
var s1_end = ee.Date('2019-12-31');
// sentinel2
var s2_start = ee.Date('2018-01-01');
var s2_end = ee.Date('2019-12-31');


// region of interest, area for classification
// import region of interest (jambi) from kml file pushed to fusion tables. 
var roi = ee.FeatureCollection('ft:1O0ylwNlk2Mmqx7P0zSqqwhJA778oBciIt8Myhnxs', 'geometry');

// the path and name for the reference dataset.
// used in create_reference to save dataset as asset.
// used in create_classification_model to load dataset
var assetID_path = 'users/wiesehahn/jambi/';
var assetID_reference = 'reference/reference_20190618';

// for map export name will be path/classification_date (e.g.users/wiesehahn/classification_20190521)
var assetID_date = '20190618';



/////////////////////////////////////////////////////////////////////////////////////////
////////////////////UTILS////////////////////////////////////////////////////////////////


// function mask S2 clouds
var maskClouds = function(image) {
  var qa = image.select('QA60');
  // Bits 10 and 11 are clouds and cirrus, respectively.
  var cloudBitMask = ee.Number(2).pow(10).int();
  var cirrusBitMask = ee.Number(2).pow(11).int();
  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0).and(
             qa.bitwiseAnd(cirrusBitMask).eq(0));
  // further mask bright areas indicating clouds which are not included in fisrt mask.
  // suggested here https://forobs.jrc.ec.europa.eu/recaredd/S2_composite.php
  var mask2 = image.select('B3').lt(2000).and(
              image.select('B9').lt(900)).and(
              image.select('B2').lt(1550));
  // Return the masked and scaled data.
  return image.updateMask(mask).updateMask(mask2).divide(10000);
};



// function to create S1 image from collection
var s1col2img = function(collection, start, end) {
  // funcion to add index (vv:vh normalized ratio)
  var addIndex = function(image) {
    var vv_vh = (image.select('VV').subtract(image.select('VH'))).divide(image.select('VV').add(image.select('VH'))).rename('VV_VH'); 
  return(image.addBands(vv_vh).float());
  };
  
  // function to mask out image edges using angles, <=30deg and >=45deg
  var mask_gt30 = function(image){
    var ang = image.select(['angle']);
    return image.updateMask(ang.gt(30.63993));
  };
  var mask_lt45 = function(image){
    var ang = image.select(['angle']);
    return image.updateMask(ang.lt(45.53993));
  };

  var period = collection.filterDate(start, end);
  
  var period_masked = period.map(mask_gt30).map(mask_lt45);
  
  var mean = period_masked.mean();
  
  var mean_index = addIndex(mean);

  var out = mean_index.clip(roi);
  
  return out;
};

 
 
/////////////////////////////////////////////////////////////////////////////////////////
////////////////////01 CREATE COMPONENTS/////////////////////////////////////////////////


//-----------------------------------------------------------------------------------------
// -------------------SENTINEL-2 IMAGE COLLECTION------------------------------------------


// filter S2 collection and calculate median
var s2 = ee.ImageCollection('COPERNICUS/S2')
  .filterDate(s2_start, s2_end)
  .filterBounds(roi)
  .map(maskClouds)
  .mean()
  .clipToCollection(roi);

// add indices
var addIndices = function(image) {
    var ndvi = image.normalizedDifference(['B8', 'B4']).rename("NDVI"); // normalized difference vegetation index
    var ndwi = image.normalizedDifference(['B3', 'B8']).rename("NDWI"); // normalized difference water index
    var nbri = image.normalizedDifference(['B8', 'B12']).rename("NBRI"); // normalized burn ratio index
    var ndmi = image.normalizedDifference(['B8', 'B11']).rename("NDMI"); // normalized difference moisture index
    var savi = image.expression('((b("B8") - b("B4")) / (b("B8") + b("B4") + 0.5)) * (1 + 0.5)').rename("SAVI"); // SoilAdjusted Total Vegetation Index 
    
  return(image.addBands(ndvi).addBands(ndwi).addBands(nbri).addBands(ndmi).addBands(savi).float());
};

s2 = addIndices(s2);


//------------------------------------------------------------------------------------------
// -------------------SENTINEL-1 IMAGE COLLECTION-------------------------------------------


// filter S1 collection and calculate median
var s1 = ee.ImageCollection('COPERNICUS/S1_GRD')
    .filterDate(s1_start, s1_end)
    .filterBounds(roi)
    // Filter to get images with VV and VH dual polarization.
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
    .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
    .filter(ee.Filter.eq('instrumentMode', 'IW'));


s1 = s1col2img(s1, s1_start, s1_end);
 

// --------------------------------------------------------------------------------------
// -------------------CREATE COMPOSITE IMAGE---------------------------------------------

// merge s1 and s2 bands to composite
var composite = ee.Image.cat([s2, 
                              s1 
                             // ,s1_var // uncomment if in use
                              ]).select(usedBands);



/////////////////////////////////////////////////////////////////////////////////////////
////////////////////03 CREATE CLASSIFICATION MODEL///////////////////////////////////////


// --------------------------------------------------------------------------------------
// -------------------VARIABLE SELECTION-------------------------------------------------

//random forest classifier

// choose a classifier and its settings
var classifier = ee.Classifier.randomForest({numberOfTrees:500,
                                            variablesPerSplit:2,
                                            minLeafPopulation:1,
                                            bagFraction:0.5});


// --------------------------------------------------------------------------------------
// -------------------BUILD MODEL--------------------------------------------------------

// load reference dataset
var assetID = ee.String(assetID_path).cat(ee.String(assetID_reference));
var reference_subset = ee.Collection.loadTable(assetID.getInfo());

// split reference dataset in training and validation data.
var reference_random = reference_subset.randomColumn('random');

var split = 0.7;  // 70% training, 30% validation.
var trainingPartition = reference_random.filter(ee.Filter.lt('random', split));
var validationPartition = reference_random.filter(ee.Filter.gte('random', split));

// train the classifier. 
var model = classifier.train(trainingPartition, 'class', usedBands);



/////////////////////////////////////////////////////////////////////////////////////////
////////////////////03 CREATE PROBABILITY MODEL//////////////////////////////////////////


// --------------------------------------------------------------------------------------
// -------------------VARIABLE SELECTION-------------------------------------------------

//random forest classifier

// choose a classifier and its settings
var classifier_prob = ee.Classifier.randomForest({numberOfTrees:500,
                                           // variablesPerSplit:2,
                                           // minLeafPopulation:2,
                                            bagFraction:0.5});


// --------------------------------------------------------------------------------------
// -------------------BUILD MODEL--------------------------------------------------------

// remap values in two classes (oil palm / non oil palm)
var reference_random_prob = reference_random.remap({
  lookupIn:  [0,1,2,3,4,5,6,7,8,9,10,11,12,13],
  lookupOut: [0,0,0,1,1,0,0,0,0,0,0 ,0 ,0,0 ],
  columnName: 'class'});

var trainingPartition_prob = reference_random_prob.filter(ee.Filter.lt('random', split));
var validationPartition_prob = reference_random_prob.filter(ee.Filter.gte('random', split));


// train the classifier. 
var model_prob = classifier_prob.setOutputMode('PROBABILITY').train(trainingPartition_prob, 'class', usedBands);



/////////////////////////////////////////////////////////////////////////////////////////
////////////////////05 APPLY CLASSIFICATION MODEL////////////////////////////////////////


// --------------------------------------------------------------------------------------
// -------------------CLASSIFICATION-----------------------------------------------------

// classify the image composite
var classified = composite.classify(model); 

// export classification map
var assetID = ee.String(assetID_path).cat(ee.String('classification/classification_')).cat(ee.String(assetID_date));

Export.image.toAsset({
image: classified.uint8(),
description:  'Classification',
assetId: assetID.getInfo(), 
//region: region,
scale: 10,
maxPixels: 1e12,
});



/////////////////////////////////////////////////////////////////////////////////////////
////////////////////05 APPLY PROBABILITY MODEL////////////////////////////////////////


// --------------------------------------------------------------------------------------
// -------------------CLASSIFICATION-----------------------------------------------------

// classify the image composite
var classified_prob = composite.classify(model_prob).multiply(100); 

// export classification map
var assetID = ee.String(assetID_path).cat(ee.String('classification/oilpalm_probability_')).cat(ee.String(assetID_date));

Export.image.toAsset({
image: classified_prob.uint8(),
description:  'Probability',
assetId: assetID.getInfo(), 
//region: region,
scale: 10,
maxPixels: 1e12,
});


Map.centerObject(roi,8);
Map.addLayer(roi);


