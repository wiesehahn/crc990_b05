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


// the path and name for the reference dataset.
// used in create_reference to save dataset as asset.
// used in create_classification_model to load dataset
var assetID_path = 'users/wiesehahn/jambi/';
var assetID_reference = 'reference/reference_20190618';



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
////////////////////04 VALIDATE CLASSIFICATION MODEL/////////////////////////////////////


// --------------------------------------------------------------------------------------
// -------------------VALIDATE MODEL-----------------------------------------------------

// classify the validation data.
var validation_classification = validationPartition.classify(model);


// export classified validation data
var assetID = ee.String(assetID_path).cat(ee.String('validation/validation_')).cat(ee.String(assetID_reference));

Export.table.toAsset({
  collection: validation_classification,
  description: 'export_classified_validation',
  assetId: assetID.getInfo() });



