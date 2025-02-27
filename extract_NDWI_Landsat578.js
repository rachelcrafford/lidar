// This script generates raster files of mean NDWI during a Feb-May time period from 2001-2021,
// including Landsat 5, 7, and 8 imagery to fill the gaps for the earlier years.

// Set the area of interest (AOI)
var AOI = ee.Geometry.Rectangle([-91.966, 31.254, -91.495, 31.540]);

// Function to scale and mask Landsat 8 (C2) surface reflectance images.
function prepSrL8(image) {
  var qaMask = image.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);
  var saturationMask = image.select('QA_RADSAT').eq(0);
  return image.updateMask(qaMask).updateMask(saturationMask);
}

// Function to scale and mask Landsat 7 (C2) surface reflectance images.
function prepSrL7(image) {
  var qaMask = image.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);
  var saturationMask = image.select('QA_RADSAT').eq(0);
  return image.updateMask(qaMask).updateMask(saturationMask);
}

// Function to scale and mask Landsat 5 (C2) surface reflectance images.
function prepSrL5(image) {
  var qaMask = image.select('QA_PIXEL').bitwiseAnd(parseInt('11111', 2)).eq(0);
  var saturationMask = image.select('QA_RADSAT').eq(0);
  return image.updateMask(qaMask).updateMask(saturationMask);
}

// Function to calculate NDWI and add it as a band.
var addNDWI = function(image) {
  var ndwi = image.normalizedDifference(['SR_B3', 'SR_B5']).rename('NDWI').toDouble();
  return image.addBands(ndwi);
};

// Define the time period of interest (February to May)
var startMonth = 2;  // February
var endMonth = 5;    // May

// Define the years of interest (2001 to 2021)
var startYear = 2001;
var endYear = 2021;

// Create an empty collection to store the NDWI images for each year
var ndwiCollection = ee.ImageCollection([]);

// Loop over the years
for (var year = startYear; year <= endYear; year++) {
  var ndwi_year;

  // For Landsat 8 (2013-2021)
  if (year >= 2013) {
    ndwi_year = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
      .filterBounds(AOI)
      .filter(ee.Filter.calendarRange(startMonth, endMonth, 'month'))  // February to May
      .filter(ee.Filter.calendarRange(year, year, 'year'))  // Specific year
      .map(prepSrL8)
      .map(addNDWI)
      .select('NDWI')
      .mean()
      .set('year', year);
  } 
  // For Landsat 7 (2001-2012)
  else if (year >= 2001 && year <= 2012) {
    ndwi_year = ee.ImageCollection('LANDSAT/LE07/C02/T1_L2')
      .filterBounds(AOI)
      .filter(ee.Filter.calendarRange(startMonth, endMonth, 'month'))  // February to May
      .filter(ee.Filter.calendarRange(year, year, 'year'))  // Specific year
      .map(prepSrL7)
      .map(addNDWI)
      .select('NDWI')
      .mean()
      .set('year', year);
  } 
  // For Landsat 5 (2001-2011)
  if (year <= 2011) {
    ndwi_year = ee.ImageCollection('LANDSAT/LT05/C02/T1_L2')
      .filterBounds(AOI)
      .filter(ee.Filter.calendarRange(startMonth, endMonth, 'month'))  // February to May
      .filter(ee.Filter.calendarRange(year, year, 'year'))  // Specific year
      .map(prepSrL5)
      .map(addNDWI)
      .select('NDWI')
      .mean()
      .set('year', year);
  }
  
  // Add the NDWI image for this year to the collection
  ndwiCollection = ndwiCollection.merge(ee.ImageCollection([ndwi_year]));
}

// Visualization parameters for NDWI
var ndwiParams = {
  min: -1.0,
  max: 1.0,
  palette: ['blue', 'white', 'green']  // Adjust the palette as needed
};

// Center the map and visualize NDWI for a specific year (e.g., 2021)
Map.centerObject(AOI, 9);
var ndwi2021 = ndwiCollection.filter(ee.Filter.eq('year', 2021)).first();
Map.addLayer(ndwi2021.clip(AOI), ndwiParams, 'NDWI 2021');

// Correct export process for each year's NDWI image to Google Drive
var ndwiList = ndwiCollection.toList(ndwiCollection.size());
var exportYears = ee.List.sequence(startYear, endYear);

exportYears.evaluate(function(yearList) {
  yearList.forEach(function(year, index) {
    var ndwiImage = ee.Image(ndwiList.get(index));
    Export.image.toDrive({
      image: ndwiImage.clip(AOI),
      description: 'NDWI_Feb_May_' + year,
      folder: 'GEE',
      region: AOI,
      scale: 30,
      crs: 'EPSG:26912',
      maxPixels: 200000000
    });
  });
});
