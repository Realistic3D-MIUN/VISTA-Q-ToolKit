const _ = require('lodash');
const express = require('express');
const Joi = require('joi');
const formidable = require('formidable');
const path = require('path');
const fs = require('fs');
const {spawn} = require('child_process');
const router = express.Router();

router.get('/getACR_Scale/', (req, res) => {
  const ratingScale = ["5 - Excellent", "4 - Good", "3 - Fair", "2 - Poor", "1 - Bad"];
  res.json(ratingScale);
});

router.get('/getDSIS_Scale/', (req, res) => {
  const ratingScale = ["5 - Imperceptible", "4 - Perceptible But Not Annoying", "3 - Slightly Annoying", "2 - Annoying", "1 - Very Annoying"];
  res.json(ratingScale);
});


//===========================
// Monocular Data
//===========================
router.post('/write_mono_results', function (req, res) {
    const { testID, sceneID, rating } = req.body;
    const csvFilePath = path.join(__dirname, './../public/Results/Mono_Test_Results.csv');
    const header = 'testID,sample_id,rating,date_time\n';
    let csvRows = '';
    const dateTime = new Date().toISOString();
  
    if (Array.isArray(sceneID) && Array.isArray(rating) && sceneID.length === rating.length) {
      for (let i = 0; i < sceneID.length; i++) {
        csvRows += `${testID},${sceneID[i]},${rating[i]},${dateTime}\n`;
      }
    } else {
      csvRows = `${testID},${sceneID},${rating},${dateTime}\n`;
    }
    fs.access(csvFilePath, fs.constants.F_OK, (err) => {
      let dataToAppend = csvRows;
      if (err) {
        dataToAppend = header + csvRows;
      }
      fs.appendFile(csvFilePath, dataToAppend, (err) => {
        if (err) {
          console.error('Error writing to CSV:', err);
          return res.status(500).json({ message: 'Error writing results' });
        }
        res.json({ message: 'Results saved successfully' });
      });
    });
  });
  

  router.post('/write_mono_video_results', function (req, res) {
    const { testID, sceneID, rating } = req.body;
    const csvFilePath = path.join(__dirname, './../public/Results/Mono_Video_Test_Results.csv');
    const header = 'testID,sample_id,rating,date_time\n';
    let csvRows = '';
    const dateTime = new Date().toISOString();
    if (Array.isArray(sceneID) && Array.isArray(rating) && sceneID.length === rating.length) {
      for (let i = 0; i < sceneID.length; i++) {
        csvRows += `${testID},${sceneID[i]},${rating[i]},${dateTime}\n`;
      }
    } else {
      csvRows = `${testID},${sceneID},${rating},${dateTime}\n`;
    }
    fs.access(csvFilePath, fs.constants.F_OK, (err) => {
      let dataToAppend = csvRows;
      if (err) {
        dataToAppend = header + csvRows;
      }
      fs.appendFile(csvFilePath, dataToAppend, (err) => {
        if (err) {
          console.error('Error writing to CSV:', err);
          return res.status(500).json({ message: 'Error writing results' });
        }
        res.json({ message: 'Results saved successfully' });
      });
    });
  });


  router.post('/write_mono_360_results', function (req, res) {
    const { testID, sceneID, rating } = req.body;
    const csvFilePath = path.join(__dirname, './../public/Results/Mono_360_Test_Results.csv');
    const header = 'testID,sample_id,rating,date_time\n';
    let csvRows = '';
    const dateTime = new Date().toISOString();
    if (Array.isArray(sceneID) && Array.isArray(rating) && sceneID.length === rating.length) {
      for (let i = 0; i < sceneID.length; i++) {
        csvRows += `${testID},${sceneID[i]},${rating[i]},${dateTime}\n`;
      }
    } else {
      csvRows = `${testID},${sceneID},${rating},${dateTime}\n`;
    }
    fs.access(csvFilePath, fs.constants.F_OK, (err) => {
      let dataToAppend = csvRows;
      if (err) {
        dataToAppend = header + csvRows;
      }
      fs.appendFile(csvFilePath, dataToAppend, (err) => {
        if (err) {
          console.error('Error writing to CSV:', err);
          return res.status(500).json({ message: 'Error writing results' });
        }
        res.json({ message: 'Results saved successfully' });
      });
    });
  });


  router.post('/write_mono_360_video_results', function (req, res) {
    const { testID, sceneID, rating } = req.body;
    const csvFilePath = path.join(__dirname, './../public/Results/Mono_360_Video_Test_Results.csv');
    const header = 'testID,sample_id,rating,date_time\n';
    let csvRows = '';
    const dateTime = new Date().toISOString();
    if (Array.isArray(sceneID) && Array.isArray(rating) && sceneID.length === rating.length) {
      for (let i = 0; i < sceneID.length; i++) {
        csvRows += `${testID},${sceneID[i]},${rating[i]},${dateTime}\n`;
      }
    } else {
      csvRows = `${testID},${sceneID},${rating},${dateTime}\n`;
    }
    fs.access(csvFilePath, fs.constants.F_OK, (err) => {
      let dataToAppend = csvRows;
      if (err) {
        dataToAppend = header + csvRows;
      }
      fs.appendFile(csvFilePath, dataToAppend, (err) => {
        if (err) {
          console.error('Error writing to CSV:', err);
          return res.status(500).json({ message: 'Error writing results' });
        }
        res.json({ message: 'Results saved successfully' });
      });
    });
  });
  
  
//===========================
// Stereo Data
//===========================
router.post('/write_stereo_results', function (req, res) {
  const { testID, sceneID, rating } = req.body;
  const csvFilePath = path.join(__dirname, './../public/Results/Stereo_Test_Results.csv');
  const header = 'testID,sample_id,rating,date_time\n';
  let csvRows = '';
  const dateTime = new Date().toISOString();
  if (Array.isArray(sceneID) && Array.isArray(rating) && sceneID.length === rating.length) {
    for (let i = 0; i < sceneID.length; i++) {
      csvRows += `${testID},${sceneID[i]},${rating[i]},${dateTime}\n`;
    }
  } else {
    csvRows = `${testID},${sceneID},${rating},${dateTime}\n`;
  }
  fs.access(csvFilePath, fs.constants.F_OK, (err) => {
    let dataToAppend = csvRows;
    if (err) {
      dataToAppend = header + csvRows;
    }
    fs.appendFile(csvFilePath, dataToAppend, (err) => {
      if (err) {
        console.error('Error writing to CSV:', err);
        return res.status(500).json({ message: 'Error writing results' });
      }
      res.json({ message: 'Results saved successfully' });
    });
  });
});


router.post('/write_stereo_video_results', function (req, res) {
    const { testID, sceneID, rating } = req.body;
    const csvFilePath = path.join(__dirname, './../public/Results/Stereo_Video_Test_Results.csv');
    const header = 'testID,sample_id,rating,date_time\n';
    let csvRows = '';
    const dateTime = new Date().toISOString();
    if (Array.isArray(sceneID) && Array.isArray(rating) && sceneID.length === rating.length) {
      for (let i = 0; i < sceneID.length; i++) {
        csvRows += `${testID},${sceneID[i]},${rating[i]},${dateTime}\n`;
      }
    } else {
      csvRows = `${testID},${sceneID},${rating},${dateTime}\n`;
    }
    fs.access(csvFilePath, fs.constants.F_OK, (err) => {
      let dataToAppend = csvRows;
      if (err) {
        dataToAppend = header + csvRows;
      }
      fs.appendFile(csvFilePath, dataToAppend, (err) => {
        if (err) {
          console.error('Error writing to CSV:', err);
          return res.status(500).json({ message: 'Error writing results' });
        }
        res.json({ message: 'Results saved successfully' });
      });
    });
  });
  

router.post('/write_mono_double_results', function (req, res) {
  const { testID, sceneID1, sceneID2, rating } = req.body;
  const csvFilePath = path.join(__dirname, './../public/Results/Mono_Double_Test_Results.csv');
  const header = 'testID,sample_id_1,sample_id_2,rating,date_time\n';
  let csvRows = '';
  const dateTime = new Date().toISOString();
  if (Array.isArray(sceneID1) && Array.isArray(sceneID2) && Array.isArray(rating) && 
      sceneID1.length === sceneID2.length && sceneID2.length === rating.length) {
    for (let i = 0; i < sceneID1.length; i++) {
      csvRows += `${testID},${sceneID1[i]},${sceneID2[i]},${rating[i]},${dateTime}\n`;
    }
  } else {
    csvRows = `${testID},${sceneID1},${sceneID2},${rating},${dateTime}\n`;
  }
  fs.access(csvFilePath, fs.constants.F_OK, (err) => {
    let dataToAppend = csvRows;
    if (err) {
      dataToAppend = header + csvRows;
    }
    fs.appendFile(csvFilePath, dataToAppend, (err) => {
      if (err) {
        console.error('Error writing to CSV:', err);
        return res.status(500).json({ message: 'Error writing results' });
      }
      res.json({ message: 'Results saved successfully' });
    });
  });
});

router.post('/write_mixed_results', function (req, res) {
  const { testID, sceneID, rating, type } = req.body;
  const csvFilePath = path.join(__dirname, './../public/Results/Mixed_Test_Results.csv');
  const header = 'testID,sample_id,rating,type,date_time\n';
  let csvRows = '';
  const dateTime = new Date().toISOString();
  if (Array.isArray(sceneID) && Array.isArray(rating) && Array.isArray(type) &&
      sceneID.length === rating.length && rating.length === type.length) {
    for (let i = 0; i < sceneID.length; i++) {
      csvRows += `${testID},${sceneID[i]},${rating[i]},${type[i]},${dateTime}\n`;
    }
  } else {
    csvRows = `${testID},${sceneID},${rating},${type},${dateTime}\n`;
  }
  fs.access(csvFilePath, fs.constants.F_OK, (err) => {
    let dataToAppend = csvRows;
    if (err) {
      dataToAppend = header + csvRows;
    }
    fs.appendFile(csvFilePath, dataToAppend, (err) => {
      if (err) {
        console.error('Error writing to CSV:', err);
        return res.status(500).json({ message: 'Error writing results' });
      }
      res.json({ message: 'Results saved successfully' });
    });
  });
});

//===========================
// Light Field Data
//===========================
router.post('/write_light_field_results', function (req, res) {
  const { testID, sceneID, rating } = req.body;
  const csvFilePath = path.join(__dirname, './../public/Results/Light_Field_Test_Results.csv');
  const header = 'testID,sample_id,rating,date_time\n';
  let csvRows = '';
  const dateTime = new Date().toISOString();

  if (Array.isArray(sceneID) && Array.isArray(rating) && sceneID.length === rating.length) {
    for (let i = 0; i < sceneID.length; i++) {
      csvRows += `${testID},${sceneID[i]},${rating[i]},${dateTime}\n`;
    }
  } else {
    csvRows = `${testID},${sceneID},${rating},${dateTime}\n`;
  }
  fs.access(csvFilePath, fs.constants.F_OK, (err) => {
    let dataToAppend = csvRows;
    if (err) {
      dataToAppend = header + csvRows;
    }
    fs.appendFile(csvFilePath, dataToAppend, (err) => {
      if (err) {
        console.error('Error writing to CSV:', err);
        return res.status(500).json({ message: 'Error writing results' });
      }
      res.json({ message: 'Results saved successfully' });
    });
  });
});

router.post('/write_light_field_focus_results', function (req, res) {
  const { testID, sceneID, rating } = req.body;
  const csvFilePath = path.join(__dirname, './../public/Results/Light_Field_Focus_Test_Results.csv');
  const header = 'testID,sample_id,rating,date_time\n';
  let csvRows = '';
  const dateTime = new Date().toISOString();

  if (Array.isArray(sceneID) && Array.isArray(rating) && sceneID.length === rating.length) {
    for (let i = 0; i < sceneID.length; i++) {
      csvRows += `${testID},${sceneID[i]},${rating[i]},${dateTime}\n`;
    }
  } else {
    csvRows = `${testID},${sceneID},${rating},${dateTime}\n`;
  }
  fs.access(csvFilePath, fs.constants.F_OK, (err) => {
    let dataToAppend = csvRows;
    if (err) {
      dataToAppend = header + csvRows;
    }
    fs.appendFile(csvFilePath, dataToAppend, (err) => {
      if (err) {
        console.error('Error writing to CSV:', err);
        return res.status(500).json({ message: 'Error writing results' });
      }
      res.json({ message: 'Results saved successfully' });
    });
  });
});


router.get('/images', (req, res) => {
    const directoryPath = path.join(__dirname, '/../public/images/custom_scene/');
    fs.readdir(directoryPath, (err, files) => {
      if (err) {
        return res.status(500).json({ message: 'Unable to scan directory' });
      }
      const imageFiles = files.filter(file => file.endsWith('.png') || file.endsWith('.jpg'));
      res.json(imageFiles);
    });
  });

module.exports = router;