

//--------------------------------CLASSIFICATIONS-------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------

var classification2016 = ee.Image.load('users/wiesehahn/classification2016_20190617');
var classification2018 = ee.Image.load('users/wiesehahn/jambi/classification/classification_20190618');

var oilpalm_probability_2016 = ee.Image.load('users/wiesehahn/oilpalm_probability2016_20190617');
var oilpalm_probability_2018 = ee.Image.load('users/wiesehahn/jambi/classification/oilpalm_probability_20190618');

 var probability_2016 = oilpalm_probability_2016.updateMask(oilpalm_probability_2016.gt(20)).updateMask(oilpalm_probability_2016.lt(80));
 var medium_probability_2016 = probability_2016.updateMask(probability_2016.lte(40).or(probability_2016.gt(60)));
 var low_probability_2016 = probability_2016.updateMask(probability_2016.gt(40).and(probability_2016.lt(60)));
 
 
 var probability_2018 = oilpalm_probability_2018.updateMask(oilpalm_probability_2018.gt(20)).updateMask(oilpalm_probability_2018.lt(80));
 var medium_probability_2018 = probability_2018.updateMask(probability_2018.lte(40).or(probability_2018.gt(60)));
 var low_probability_2018 = probability_2018.updateMask(probability_2018.gt(40).and(probability_2018.lt(60)));
 
 

//--------------------------------STYLE AND LEGEND------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------


// style and legend for 12 classes (rubber not in reference data)
var colors = ['66ccff',
'1D591D', 
'309330',
'CEA0CE', 
'FFD1FF', 
'B5D27D',
'11B38E',
'fbedd9', 
'FB4C4C',
'1196B3',
'e6e06a',
'67739d',
'adff99',
'ffcc99'];

var names = ["0 - Water",
  "1 - Primary Forest",
  "2 - Secondary Forest",
  "3 - Mature Oil Palm",
  "4 - Immature Oil palm",
  "5 - Shrub/orchard",
  "6 - Plantation Forest",
  "7 - Bare soil/ground",
  "8 - Built-up area",
  "9 - Rubber",
  "10 - Coconut plantation",
  "11 - Rice field",
  "12 - Tea plantation",
  "13 - Dryland agriculture"]; 

var palette = ee.List(colors);

// add legend
var legend = ui.Panel({style: {position: 'bottom-left'}}); 
  legend.add(ui.Label({   
  value: "Land Cover Classification",   
  style: {     
    fontWeight: 'bold',     
    fontSize: '16px',     
    margin: '0 0 4px 0',     
    padding: '0px'   
    } 
  })); 
  
// Iterate classification legend entries 
var entry; for (var x = 0; x<14; x++){   
  entry = [     
    ui.Label({style:{color:colors[x],margin: '0 0 4px 0'}, value: 'o'}),
    ui.Label({       
      value: names[x],       
      style: {         
        margin: '0 0 4px 4px'  
      }     
    })   
    ];   
    legend.add(ui.Panel(entry, ui.Panel.Layout.Flow('horizontal'))); } 



//--------------------------------VALIDATION DATA-------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------

var validation_data = ee.Collection.loadTable('users/wiesehahn/jambi/validation/validation_reference_20190618');

// create error matrix
var errorMatrix = validation_data.errorMatrix('class', 'classification');

// add column to style by predicted class
var features = validation_data.map(function(f) {
  var klass = f.get("classification");
  return f
      .set({style: {fillColor: palette.get(klass) }});
});

// add column to filter for differences between predicted and referenced data
var features = features.map(function(f) {
  var ref_class = ee.Number(f.get('class')).toInt();
  var pred_class = ee.Number(f.get('classification')).toInt();
  return f.set({
    errorneous: ref_class.neq(pred_class)
  });
});

var validation_wrong = features.filter(ee.Filter.eq('errorneous', 1));
var validation_right = features.filter(ee.Filter.eq('errorneous', 0));



//--------------------------------VISUALIZATION---------------------------------------------------------------------
//------------------------------------------------------------------------------------------------------------------

// validation
print('Statistics refer to last classification');
print('Validation Error Matrix', errorMatrix);
print('Validation overall accuracy: ', errorMatrix.accuracy());
print('Consumers Accuracy', errorMatrix.consumersAccuracy());
print('Producers Accuracy',errorMatrix.producersAccuracy());

 // mapping
 Map.add(legend);
 Map.centerObject(classification2016,9);
 
 // classifications 
 Map.addLayer(classification2018, {min: 0, max: 13, palette: colors}, 'classification 2018/2019 - S1+ S2 (13 classes)', true);
 Map.addLayer(classification2016, {min: 0, max: 13, palette: colors}, 'classification 2016/2017 - S1+ S2 (13 classes)', true);

 
 // mask classifications by probabilities 
 
 /*
 Map.addLayer(medium_probability_2018, {palette: ['FFFFFF'], opacity: 0.5}, 'mask medium probablity', false);
 Map.addLayer(low_probability_2018, {palette: ['FFFFFF'], opacity: 0.75}, 'mask low probability', false);
 Map.addLayer(oilpalm_probability_2018.updateMask(oilpalm_probability_2018.gt(20)).updateMask(oilpalm_probability_2018.lt(80)), 
              {min: 20, max: 80, palette: ['FFFFFF'], opacity: 1}, 'mask low probabilities completly', false);
 Map.addLayer(oilpalm_probability_2018.updateMask(oilpalm_probability_2018.gte(80)), 
              {min: 80, max: 100, palette: ['cc00cc']}, 'high oilpalm probability', false);
 Map.addLayer(oilpalm_probability_2018.updateMask(oilpalm_probability_2018.lte(20)), 
              {min: 0, max: 20, palette: ['000000']}, 'high other probability', false); 
  */
  
 Map.addLayer(oilpalm_probability_2016, {min: 0, max: 100}, 'oilpalm probability 2016', false);
 Map.addLayer(oilpalm_probability_2018, {min: 0, max: 100}, 'oilpalm probability 2018', false);
 
 
 // reference data
 Map.addLayer(validation_wrong.style({pointSize:5, width: 2, color: "#ff073a", styleProperty: "style"}),{},'validation wrong', false);
 Map.addLayer(validation_right.style({pointSize:5, width: 2, color: "#FFFFFF", styleProperty: "style"}),{},'validation right', false);
 
